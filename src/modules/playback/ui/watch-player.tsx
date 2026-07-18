"use client";

import MuxPlayer from "@mux/mux-player-react";
import { RotateCcw } from "lucide-react";
import { startTransition, useEffect, useState } from "react";
import { z } from "zod";

const sessionResponseSchema = z
  .object({
    data: z
      .object({
        advertising: z.null(),
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
        resumeAtSeconds: z.literal(0),
        sessionId: z.string().regex(/^ps_[a-zA-Z0-9]+$/u),
      })
      .strict(),
  })
  .strict();
const problemSchema = z.object({ requestId: z.string().min(1).max(128) });

type PlaybackSession = z.infer<typeof sessionResponseSchema>["data"];
type PlayerState =
  | Readonly<{ kind: "buffering" | "loading" | "requesting" }>
  | Readonly<{ kind: "ready" }>
  | Readonly<{ kind: "retryable" | "unavailable"; requestId: string | null }>;

function stateCopy(state: PlayerState): string | null {
  switch (state.kind) {
    case "requesting":
      return "Gösterim izni hazırlanıyor";
    case "loading":
      return "Film yükleniyor";
    case "buffering":
      return "Bağlantı dengeleniyor";
    case "retryable":
      return "Film yüklenemedi";
    case "unavailable":
      return "Bu film şu anda oynatılamıyor";
    case "ready":
      return null;
  }
}

export function WatchPlayer({ movieId, title }: Readonly<{ movieId: string; title: string }>) {
  const [attempt, setAttempt] = useState(0);
  const [session, setSession] = useState<PlaybackSession | null>(null);
  const [state, setState] = useState<PlayerState>({ kind: "requesting" });

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;
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
        startTransition(() => {
          setSession(parsed.data.data);
          setState({ kind: "loading" });
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
  }, [attempt, movieId]);

  const copy = stateCopy(state);

  return (
    <div className="watch-player-frame">
      {session === null ? null : (
        <MuxPlayer
          accentColor="#d8ff3e"
          autoPlay={false}
          className="watch-player"
          disableCookies
          disableTracking
          metadataVideoId={movieId}
          metadataVideoTitle={title}
          playsInline
          preload="metadata"
          {...(session.playback.fixtureSourceUrl === undefined
            ? {
                playbackId: session.playback.playbackId,
                tokens: { playback: session.playback.token },
              }
            : { src: session.playback.fixtureSourceUrl })}
          onCanPlay={() => setState({ kind: "ready" })}
          onError={() => setState({ kind: "retryable", requestId: null })}
          onPlaying={() => setState({ kind: "ready" })}
          onWaiting={() => setState({ kind: "buffering" })}
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

      {copy === null ? null : (
        <div className="watch-player-state" role="status">
          <p>{copy}</p>
          {state.kind === "retryable" ? (
            <button
              className="secondary-action"
              type="button"
              onClick={() => {
                setSession(null);
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
