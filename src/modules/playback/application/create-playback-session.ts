import type { PlaybackRepositoryPort, VideoProviderPort } from "./playback-ports";
import { evaluateWatchability, type WatchabilityDecision } from "../domain/watchability";

const maximumGrantLifetimeSeconds = 5 * 60;

export type PlaybackSession = Readonly<{
  movie: Readonly<{
    durationSeconds: number;
    id: string;
    title: string;
  }>;
  playback: Readonly<{
    expiresAt: string;
    fixtureSourceUrl?: string;
    fixtureTextTracks?: readonly Readonly<{
      default: boolean;
      kind: "captions" | "subtitles";
      label: string;
      languageTag: string;
      src: string;
    }>[];
    playbackId: string;
    provider: "mux";
    token: string;
  }>;
  resumeAtSeconds: 0;
  sessionId: string;
}>;

export type CreatePlaybackSessionResult =
  | Readonly<{ kind: "not-available" }>
  | Readonly<{ kind: "not-found" }>
  | Readonly<{ kind: "provider-unavailable" }>
  | Readonly<{ kind: "success"; session: PlaybackSession }>;

export type PlaybackAvailabilityResult =
  | Readonly<{ available: false; kind: "not-found" }>
  | Readonly<{ available: false; kind: "not-available" }>
  | Readonly<{ available: true }>;

type CreatePlaybackSessionDependencies = Readonly<{
  clock: () => Date;
  createSessionId: () => string;
  providerTimeoutMilliseconds?: number;
  repository: PlaybackRepositoryPort;
  videoProvider: VideoProviderPort;
}>;

function grantLifetimeSeconds(
  decision: Extract<WatchabilityDecision, { allowed: true }>,
  now: Date,
) {
  const rightSecondsRemaining = Math.floor(
    (decision.right.endsAt.getTime() - now.getTime()) / 1_000,
  );
  return Math.min(maximumGrantLifetimeSeconds, rightSecondsRemaining);
}

export function createPlaybackService(dependencies: CreatePlaybackSessionDependencies) {
  const providerTimeoutMilliseconds = dependencies.providerTimeoutMilliseconds ?? 2_000;

  async function createBoundedGrant(
    input: Parameters<VideoProviderPort["createPlaybackGrant"]>[0],
  ) {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        dependencies.videoProvider.createPlaybackGrant(input),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error("Video provider grant timed out")),
            providerTimeoutMilliseconds,
          );
        }),
      ]);
    } finally {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    }
  }

  async function evaluate(movieId: string, territory: string | null) {
    const now = dependencies.clock();
    const candidate = await dependencies.repository.findCandidateByMovieId(movieId);
    if (candidate === null) {
      return { candidate: null, decision: null, now } as const;
    }

    const decision = evaluateWatchability({
      assets: candidate.assets,
      now,
      publicationState: candidate.publicationState,
      publishAt: candidate.publishAt,
      rights: candidate.rights,
      territory,
    });
    return { candidate, decision, now } as const;
  }

  return {
    async inspectAvailability(
      movieId: string,
      territory: string | null,
    ): Promise<PlaybackAvailabilityResult> {
      const evaluated = await evaluate(movieId, territory);
      if (evaluated.candidate === null || evaluated.decision === null) {
        return { available: false, kind: "not-found" };
      }
      return evaluated.decision.allowed
        ? { available: true }
        : { available: false, kind: "not-available" };
    },

    async createSession(
      movieId: string,
      territory: string | null,
    ): Promise<CreatePlaybackSessionResult> {
      const evaluated = await evaluate(movieId, territory);
      if (evaluated.candidate === null || evaluated.decision === null) {
        return { kind: "not-found" };
      }
      if (!evaluated.decision.allowed) {
        return { kind: "not-available" };
      }

      const lifetimeSeconds = grantLifetimeSeconds(evaluated.decision, evaluated.now);
      if (lifetimeSeconds < 1) {
        return { kind: "not-available" };
      }
      const expiresAt = new Date(evaluated.now.getTime() + lifetimeSeconds * 1_000);
      const sessionId = dependencies.createSessionId();

      try {
        const grant = await createBoundedGrant({
          expiresAt,
          lifetimeSeconds,
          playbackId: evaluated.decision.asset.providerPlaybackId,
          sessionId,
        });

        return {
          kind: "success",
          session: {
            movie: {
              durationSeconds: evaluated.decision.asset.durationSeconds,
              id: evaluated.candidate.id,
              title: evaluated.candidate.title,
            },
            playback: {
              expiresAt: expiresAt.toISOString(),
              ...(grant.fixtureSourceUrl === undefined
                ? {}
                : { fixtureSourceUrl: grant.fixtureSourceUrl }),
              ...(grant.fixtureTextTracks === undefined
                ? {}
                : { fixtureTextTracks: grant.fixtureTextTracks }),
              playbackId: evaluated.decision.asset.providerPlaybackId,
              provider: "mux",
              token: grant.token,
            },
            resumeAtSeconds: 0,
            sessionId,
          },
        };
      } catch {
        return { kind: "provider-unavailable" };
      }
    },
  };
}
