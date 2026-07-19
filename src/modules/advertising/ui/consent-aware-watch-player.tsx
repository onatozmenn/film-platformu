"use client";

import MuxPlayer, { type MuxPlayerRefAttributes } from "@mux/mux-player-react";
import { Play, RotateCcw } from "lucide-react";
import { startTransition, useEffect, useRef, useState } from "react";
import { z } from "zod";

import type { AdvertisingOutcome } from "@/modules/advertising/ui/ad-outcome";
import {
  createPlaybackProgressController,
  type PlaybackProgressMode,
  type ProgressObservationIntent,
} from "@/modules/library/ui/playback-progress-controller";

const adTagUrlSchema = z
  .url()
  .max(2_048)
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "pubads.g.doubleclick.net" &&
      url.pathname === "/gampad/ads"
    );
  }, "Unsupported advertising tag URL");

const advertisingSchema = z
  .object({
    fixtureScenario: z.enum(["blocked", "completed", "empty", "error", "timeout"]).optional(),
    personalized: z.boolean(),
    placement: z.literal("preroll"),
    provider: z.literal("google-ima"),
    tagUrl: adTagUrlSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const hasNonPersonalizedMode = new URL(value.tagUrl).searchParams.get("npa") === "1";
    if (value.personalized === hasNonPersonalizedMode) {
      context.addIssue({
        code: "custom",
        message: "Advertising personalization mode does not match its tag",
        path: ["tagUrl"],
      });
    }
  });

const sessionResponseSchema = z
  .object({
    data: z
      .object({
        advertising: advertisingSchema.nullable(),
        movie: z
          .object({
            durationSeconds: z.number().int().positive(),
            id: z.uuid(),
            title: z.string().min(1).max(160),
          })
          .strict(),
        playback: z
          .object({
            expiresAt: z.iso.datetime(),
            fixtureSourceUrl: z.string().startsWith("/fixtures/playback/").optional(),
            fixtureTextTracks: z
              .array(
                z
                  .object({
                    default: z.boolean(),
                    kind: z.enum(["captions", "subtitles"]),
                    label: z.string().min(1).max(80),
                    languageTag: z.string().regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u),
                    src: z.string().startsWith("/fixtures/playback/").endsWith(".vtt"),
                  })
                  .strict(),
              )
              .max(10)
              .optional(),
            playbackId: z.string().min(1).max(120),
            provider: z.literal("mux"),
            token: z.string().min(1).max(8_192),
          })
          .strict(),
        resumeAtSeconds: z
          .number()
          .finite()
          .nonnegative()
          .max(12 * 60 * 60),
        sessionId: z.string().regex(/^ps_[a-zA-Z0-9]+$/u),
      })
      .strict(),
  })
  .strict();
const problemSchema = z.object({ requestId: z.string().min(1).max(128) });

type PlaybackSession = z.infer<typeof sessionResponseSchema>["data"];
type PlayerState =
  | Readonly<{
      kind:
        | "awaiting-preroll"
        | "buffering"
        | "loading"
        | "playing-preroll"
        | "preparing-preroll"
        | "requesting";
    }>
  | Readonly<{ kind: "ready" }>
  | Readonly<{ kind: "retryable" | "unavailable"; requestId: string | null }>;
type PrerollMode = "fixture" | "google-ima" | null;

function isPrerollState(state: PlayerState): boolean {
  return (
    state.kind === "awaiting-preroll" ||
    state.kind === "playing-preroll" ||
    state.kind === "preparing-preroll"
  );
}

function contentState(player: MuxPlayerRefAttributes | null): PlayerState {
  return player !== null && player.readyState >= 1 ? { kind: "ready" } : { kind: "loading" };
}

function reportOutcomeOnce(
  reported: { current: boolean },
  sessionId: string,
  outcome: AdvertisingOutcome,
): void {
  if (reported.current) {
    return;
  }
  reported.current = true;
  void import("@/modules/advertising/ui/report-ad-outcome").then(
    ({ reportAdvertisingOutcome }) => reportAdvertisingOutcome({ outcome, sessionId }),
    () => false,
  );
}

function stateCopy(state: PlayerState): string | null {
  switch (state.kind) {
    case "requesting":
      return "Gösterim izni hazırlanıyor";
    case "preparing-preroll":
      return "Kısa gösterim hazırlanıyor";
    case "awaiting-preroll":
      return "Gösterime hazır";
    case "loading":
      return "Film yükleniyor";
    case "buffering":
      return "Bağlantı dengeleniyor";
    case "retryable":
      return "Film yüklenemedi";
    case "unavailable":
      return "Bu film şu anda oynatılamıyor";
    case "playing-preroll":
    case "ready":
      return null;
  }
}

export function ConsentAwareWatchPlayer({
  movieId,
  progressMode = "guest",
  title,
}: Readonly<{ movieId: string; progressMode?: PlaybackProgressMode; title: string }>) {
  const [attempt, setAttempt] = useState(0);
  const [adTagUrl, setAdTagUrl] = useState<string | undefined>();
  const [prerollMode, setPrerollMode] = useState<PrerollMode>(null);
  const [resumeAtSeconds, setResumeAtSeconds] = useState(0);
  const [session, setSession] = useState<PlaybackSession | null>(null);
  const [state, setState] = useState<PlayerState>({ kind: "requesting" });
  const adContainerRef = useRef<HTMLDivElement>(null);
  const adOutcomeReportedRef = useRef(false);
  const playerRef = useRef<MuxPlayerRefAttributes>(null);
  const progressControllerRef = useRef<ReturnType<typeof createPlaybackProgressController> | null>(
    null,
  );

  const observeProgress = (intent: ProgressObservationIntent) => {
    const currentTime = playerRef.current?.currentTime;
    if (currentTime === undefined) {
      return;
    }
    void progressControllerRef.current?.observe(currentTime, intent);
  };

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;
    progressControllerRef.current = null;
    const timeout = window.setTimeout(() => {
      controller.abort();
      if (isMounted) {
        startTransition(() => setState({ kind: "retryable", requestId: null }));
      }
    }, 8_000);

    void (async () => {
      try {
        const response = await fetch("/api/v1/playback/sessions", {
          body: JSON.stringify({ movieId }),
          cache: "no-store",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          method: "POST",
          signal: controller.signal,
        });
        const requestId = response.headers.get("x-request-id");
        const payload = (await response.json()) as unknown;

        if (!response.ok) {
          const problem = problemSchema.safeParse(payload);
          const safeRequestId = problem.success ? problem.data.requestId : requestId;
          startTransition(() =>
            setState(
              response.status === 403 || response.status === 404
                ? { kind: "unavailable", requestId: safeRequestId }
                : { kind: "retryable", requestId: safeRequestId },
            ),
          );
          return;
        }

        const parsed = sessionResponseSchema.safeParse(payload);
        if (!parsed.success) {
          startTransition(() => setState({ kind: "retryable", requestId }));
          return;
        }
        const progressController = createPlaybackProgressController({
          durationSeconds: parsed.data.data.movie.durationSeconds,
          fetcher: (input, init) => fetch(input, init),
          mode: progressMode,
          movieId,
          storage: {
            getItem: (key) => window.localStorage.getItem(key),
            setItem: (key, value) => window.localStorage.setItem(key, value),
          },
        });
        const resolvedResumeAt = progressController.resolveResumeAt(
          parsed.data.data.resumeAtSeconds,
        );
        progressControllerRef.current = progressController;
        startTransition(() => {
          adOutcomeReportedRef.current = false;
          setAdTagUrl(undefined);
          setPrerollMode(null);
          setResumeAtSeconds(resolvedResumeAt);
          setSession(parsed.data.data);
          setState({
            kind: parsed.data.data.advertising === null ? "loading" : "preparing-preroll",
          });
        });
      } catch {
        if (isMounted && !controller.signal.aborted) {
          startTransition(() => setState({ kind: "retryable", requestId: null }));
        }
      } finally {
        window.clearTimeout(timeout);
      }
    })();

    return () => {
      isMounted = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [attempt, movieId, progressMode]);

  useEffect(() => {
    if (session === null) {
      return;
    }
    const flush = () => {
      const currentTime = playerRef.current?.currentTime;
      if (currentTime !== undefined) {
        void progressControllerRef.current?.observe(currentTime, "flush");
      }
    };
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };
    document.addEventListener("visibilitychange", flushWhenHidden);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flushWhenHidden);
      window.removeEventListener("pagehide", flush);
    };
  }, [session]);

  useEffect(() => {
    const currentSession = session;
    const advertising = currentSession?.advertising;
    if (currentSession === null || advertising === undefined || advertising === null) {
      return;
    }
    let active = true;

    void import("@/modules/advertising/ui/preroll-client")
      .then(async ({ prepareGoogleImaPreroll }) => {
        if (advertising.fixtureScenario !== undefined) {
          return "fixture" as const;
        }
        const outcome = await prepareGoogleImaPreroll();
        return outcome === "ready" ? ("google-ima" as const) : outcome;
      })
      .then((outcome) => {
        if (!active) {
          return;
        }
        startTransition(() => {
          if (outcome === "fixture") {
            setPrerollMode("fixture");
            setState({ kind: "awaiting-preroll" });
            return;
          }
          if (outcome === "google-ima") {
            setAdTagUrl(advertising.tagUrl);
            setPrerollMode("google-ima");
            setState({ kind: "awaiting-preroll" });
            return;
          }
          reportOutcomeOnce(adOutcomeReportedRef, currentSession.sessionId, outcome);
          setState(contentState(playerRef.current));
        });
      })
      .catch(() => {
        if (active) {
          reportOutcomeOnce(adOutcomeReportedRef, currentSession.sessionId, "blocked");
          startTransition(() => setState(contentState(playerRef.current)));
        }
      });

    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    const currentSession = session;
    if (currentSession === null || prerollMode !== "google-ima" || adTagUrl === undefined) {
      return;
    }
    const media = playerRef.current?.media;
    if (media === null || media === undefined) {
      return;
    }
    const handleAdStart = () => setState({ kind: "playing-preroll" });
    const handleAdComplete = () => {
      reportOutcomeOnce(adOutcomeReportedRef, currentSession.sessionId, "completed");
      setState(contentState(playerRef.current));
    };
    const handleAdError = () => {
      reportOutcomeOnce(adOutcomeReportedRef, currentSession.sessionId, "error");
      setState(contentState(playerRef.current));
    };
    const handleAdSkip = () => {
      reportOutcomeOnce(adOutcomeReportedRef, currentSession.sessionId, "skipped");
      setState(contentState(playerRef.current));
    };

    media.addEventListener("adbreakstart", handleAdStart);
    media.addEventListener("adbreakend", handleAdComplete);
    media.addEventListener("aderror", handleAdError);
    media.addEventListener("adskip", handleAdSkip);
    return () => {
      media.removeEventListener("adbreakstart", handleAdStart);
      media.removeEventListener("adbreakend", handleAdComplete);
      media.removeEventListener("aderror", handleAdError);
      media.removeEventListener("adskip", handleAdSkip);
    };
  }, [adTagUrl, prerollMode, session]);

  const startPreroll = () => {
    const currentSession = session;
    const advertising = currentSession?.advertising;
    if (
      currentSession === null ||
      advertising === undefined ||
      advertising === null ||
      prerollMode === null
    ) {
      return;
    }
    setState({ kind: "playing-preroll" });

    void (async () => {
      if (prerollMode === "fixture") {
        const container = adContainerRef.current;
        if (container === null || advertising.fixtureScenario === undefined) {
          reportOutcomeOnce(adOutcomeReportedRef, currentSession.sessionId, "error");
          setState(contentState(playerRef.current));
          return;
        }
        const { playFixturePreroll } = await import("@/modules/advertising/ui/preroll-client");
        const outcome = await playFixturePreroll({
          container,
          scenario: advertising.fixtureScenario,
        });
        reportOutcomeOnce(adOutcomeReportedRef, currentSession.sessionId, outcome);
      }

      try {
        await playerRef.current?.play();
        setState(contentState(playerRef.current));
      } catch {
        reportOutcomeOnce(adOutcomeReportedRef, currentSession.sessionId, "error");
        setState({ kind: "ready" });
      }
    })();
  };

  const copy = stateCopy(state);

  return (
    <div className="watch-player-frame">
      {session === null ? null : (
        <MuxPlayer
          ref={playerRef}
          accentColor="#d8ff3e"
          autoPlay={false}
          className="watch-player"
          disableCookies
          disableTracking
          metadataVideoId={movieId}
          metadataVideoTitle={title}
          playsInline
          preload="metadata"
          startTime={resumeAtSeconds}
          {...(adTagUrl === undefined ? {} : { adTagUrl, allowAdBlocker: true })}
          {...(session.playback.fixtureSourceUrl === undefined
            ? {
                playbackId: session.playback.playbackId,
                tokens: { playback: session.playback.token },
              }
            : { src: session.playback.fixtureSourceUrl })}
          onCanPlay={() =>
            setState((current) => (isPrerollState(current) ? current : { kind: "ready" }))
          }
          onError={() => setState({ kind: "retryable", requestId: null })}
          onEnded={() => observeProgress("flush")}
          onPause={() => observeProgress("flush")}
          onPlaying={() =>
            setState((current) => (isPrerollState(current) ? current : { kind: "ready" }))
          }
          onTimeUpdate={() => observeProgress("periodic")}
          onWaiting={() =>
            setState((current) => (isPrerollState(current) ? current : { kind: "buffering" }))
          }
        >
          {session.playback.fixtureTextTracks?.map((track) => (
            <track
              default={track.default}
              key={`${track.languageTag}-${track.kind}`}
              kind={track.kind}
              label={track.label}
              src={track.src}
              srcLang={track.languageTag}
            />
          ))}
        </MuxPlayer>
      )}

      <div className="watch-ad-layer" ref={adContainerRef} />

      {copy === null ? null : (
        <div className="watch-player-state" role="status">
          <p>{copy}</p>
          {state.kind === "awaiting-preroll" ? (
            <button className="primary-action" type="button" onClick={startPreroll}>
              <Play aria-hidden="true" fill="currentColor" size={18} strokeWidth={2} />
              Filmi başlat
            </button>
          ) : null}
          {state.kind === "retryable" ? (
            <button
              className="secondary-action"
              type="button"
              onClick={() => {
                adOutcomeReportedRef.current = false;
                setAdTagUrl(undefined);
                setPrerollMode(null);
                setResumeAtSeconds(0);
                setSession(null);
                progressControllerRef.current = null;
                setState({ kind: "requesting" });
                setAttempt((current) => current + 1);
              }}
            >
              <RotateCcw aria-hidden="true" size={18} strokeWidth={2} />
              Yeniden dene
            </button>
          ) : null}
          {state.kind === "retryable" || state.kind === "unavailable" ? (
            state.requestId === null ? null : (
              <small>Destek kodu: {state.requestId}</small>
            )
          ) : null}
        </div>
      )}
    </div>
  );
}
