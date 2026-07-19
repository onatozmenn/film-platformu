import { describe, expect, it } from "vitest";

import {
  getGuestResumePosition,
  guestProgressStorageKey,
  writeGuestProgress,
} from "./guest-progress-store";

const movieId = "00000000-0000-4000-8000-000000000001";
const now = new Date("2026-07-19T12:00:00.000Z");

function memoryStorage(initial: string | null = null) {
  let stored = initial;
  return {
    getItem: () => stored,
    setItem: (_key: string, value: string) => {
      stored = value;
    },
    value: () => stored,
  };
}

describe("guest progress store", () => {
  it("round-trips compatible finite progress in a versioned shape", () => {
    const storage = memoryStorage();

    expect(
      writeGuestProgress({ durationSeconds: 100, movieId, now, positionSeconds: 40, storage }),
    ).toBe(true);
    expect(getGuestResumePosition({ durationSeconds: 105, movieId, now, storage })).toBe(40);
    expect(JSON.parse(storage.value() ?? "{}")).toMatchObject({
      entries: { [movieId]: { durationSeconds: 100, positionSeconds: 40 } },
      version: 1,
    });
  });

  it("does not resume completed or duration-incompatible progress", () => {
    const storage = memoryStorage();

    writeGuestProgress({ durationSeconds: 100, movieId, now, positionSeconds: 95, storage });
    expect(getGuestResumePosition({ durationSeconds: 100, movieId, now, storage })).toBe(0);
    writeGuestProgress({ durationSeconds: 100, movieId, now, positionSeconds: 40, storage });
    expect(getGuestResumePosition({ durationSeconds: 106, movieId, now, storage })).toBe(0);
  });

  it("fails closed for malformed, oversized, invalid-ID, and non-finite records", () => {
    const malformed = memoryStorage("{");
    const oversized = memoryStorage("x".repeat(64 * 1_024 + 1));

    expect(getGuestResumePosition({ durationSeconds: 100, movieId, now, storage: malformed })).toBe(
      0,
    );
    expect(getGuestResumePosition({ durationSeconds: 100, movieId, now, storage: oversized })).toBe(
      0,
    );
    expect(
      writeGuestProgress({
        durationSeconds: 100,
        movieId: "not-a-uuid",
        now,
        positionSeconds: 40,
        storage: malformed,
      }),
    ).toBe(false);
    expect(
      writeGuestProgress({
        durationSeconds: 100,
        movieId,
        now,
        positionSeconds: Number.NaN,
        storage: malformed,
      }),
    ).toBe(false);
  });

  it("ignores unknown versions without mutating session or token storage", () => {
    const storage = memoryStorage(
      JSON.stringify({
        entries: {
          [movieId]: { durationSeconds: 100, observedAt: now.toISOString(), positionSeconds: 40 },
        },
        version: 2,
      }),
    );

    expect(getGuestResumePosition({ durationSeconds: 100, movieId, now, storage })).toBe(0);
    expect(guestProgressStorageKey).toBe("film-platform:guest-progress:v1");
  });
});
