import { getGuestResumePosition, writeGuestProgress } from "./guest-progress-store";

export type PlaybackProgressMode = "guest" | "member";
export type ProgressObservationIntent = "flush" | "periodic";

type ProgressFetcher = (input: string, init: RequestInit) => Promise<Response>;

export function createPlaybackProgressController(
  input: Readonly<{
    clock?: () => Date;
    durationSeconds: number;
    fetcher: ProgressFetcher;
    mode: PlaybackProgressMode;
    movieId: string;
    storage: Pick<Storage, "getItem" | "setItem">;
  }>,
) {
  const clock = input.clock ?? (() => new Date());
  let lastPeriodicWriteAt = Number.NEGATIVE_INFINITY;

  return {
    resolveResumeAt(serverResumeAtSeconds: number): number {
      if (input.mode === "guest") {
        return getGuestResumePosition({
          durationSeconds: input.durationSeconds,
          movieId: input.movieId,
          now: clock(),
          storage: input.storage,
        });
      }
      return Number.isFinite(serverResumeAtSeconds) && serverResumeAtSeconds > 0
        ? Math.min(serverResumeAtSeconds, input.durationSeconds)
        : 0;
    },

    async observe(positionSeconds: number, intent: ProgressObservationIntent): Promise<boolean> {
      if (!Number.isFinite(positionSeconds) || positionSeconds <= 0) {
        return false;
      }
      const now = clock();
      if (intent === "periodic" && now.getTime() - lastPeriodicWriteAt < 10_000) {
        return false;
      }
      if (intent === "periodic") {
        lastPeriodicWriteAt = now.getTime();
      }

      if (input.mode === "guest") {
        return writeGuestProgress({
          durationSeconds: input.durationSeconds,
          movieId: input.movieId,
          now,
          positionSeconds,
          storage: input.storage,
        });
      }

      try {
        const response = await input.fetcher(`/api/v1/me/progress/${input.movieId}`, {
          body: JSON.stringify({
            durationSeconds: input.durationSeconds,
            observedAt: now.toISOString(),
            positionSeconds,
          }),
          headers: { "Content-Type": "application/json; charset=utf-8" },
          ...(intent === "flush" ? { keepalive: true } : {}),
          method: "PUT",
        });
        return response.ok;
      } catch {
        return false;
      }
    },
  };
}
