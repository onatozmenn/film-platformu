import { describe, expect, it, vi } from "vitest";

import { writeGuestProgress } from "./guest-progress-store";
import { createPlaybackProgressController } from "./playback-progress-controller";

const movieId = "00000000-0000-4000-8000-000000000001";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("playback progress controller", () => {
  it("keeps member and guest resume sources isolated", () => {
    const storage = memoryStorage();
    const now = new Date("2026-07-19T12:00:00.000Z");
    writeGuestProgress({ durationSeconds: 100, movieId, now, positionSeconds: 30, storage });
    const member = createPlaybackProgressController({
      clock: () => now,
      durationSeconds: 100,
      fetcher: vi.fn(),
      mode: "member",
      movieId,
      storage,
    });
    const guest = createPlaybackProgressController({
      clock: () => now,
      durationSeconds: 100,
      fetcher: vi.fn(),
      mode: "guest",
      movieId,
      storage,
    });

    expect(member.resolveResumeAt(60)).toBe(60);
    expect(guest.resolveResumeAt(60)).toBe(30);
  });

  it("throttles periodic member writes but lets flush observations use keepalive", async () => {
    let now = new Date("2026-07-19T12:00:00.000Z");
    const fetcher = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 204 }),
    );
    const controller = createPlaybackProgressController({
      clock: () => now,
      durationSeconds: 100,
      fetcher,
      mode: "member",
      movieId,
      storage: memoryStorage(),
    });

    await expect(controller.observe(10, "periodic")).resolves.toBe(true);
    now = new Date("2026-07-19T12:00:09.999Z");
    await expect(controller.observe(20, "periodic")).resolves.toBe(false);
    await expect(controller.observe(21, "flush")).resolves.toBe(true);
    now = new Date("2026-07-19T12:00:10.000Z");
    await expect(controller.observe(30, "periodic")).resolves.toBe(true);

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      `/api/v1/me/progress/${movieId}`,
      expect.objectContaining({ keepalive: true, method: "PUT" }),
    );
    expect(fetcher.mock.calls[0]?.[1]).not.toHaveProperty("keepalive");
  });

  it("writes guest progress locally without calling the member endpoint", async () => {
    const storage = memoryStorage();
    const fetcher = vi.fn();
    const now = new Date("2026-07-19T12:00:00.000Z");
    const controller = createPlaybackProgressController({
      clock: () => now,
      durationSeconds: 100,
      fetcher,
      mode: "guest",
      movieId,
      storage,
    });

    await expect(controller.observe(40, "periodic")).resolves.toBe(true);
    expect(controller.resolveResumeAt(0)).toBe(40);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("silently rejects impossible observations and member network failure", async () => {
    const controller = createPlaybackProgressController({
      durationSeconds: 100,
      fetcher: vi.fn(async () => {
        throw new Error("offline");
      }),
      mode: "member",
      movieId,
      storage: memoryStorage(),
    });

    await expect(controller.observe(Number.NaN, "periodic")).resolves.toBe(false);
    await expect(controller.observe(10, "flush")).resolves.toBe(false);
  });
});
