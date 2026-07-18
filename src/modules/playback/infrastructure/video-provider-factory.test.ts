import { describe, expect, it } from "vitest";

import { createVideoProvider } from "./video-provider-factory";

const grantInput = {
  expiresAt: new Date("2026-07-19T12:05:00.000Z"),
  lifetimeSeconds: 300,
  playbackId: "fake-playback-kiyidaki-sessizlik",
  sessionId: "ps_opaque",
} as const;

describe("video provider factory", () => {
  it("uses the deterministic fake only outside production", async () => {
    await expect(
      createVideoProvider({ kind: "fake" }, "test").createPlaybackGrant(grantInput),
    ).resolves.toMatchObject({ fixtureSourceUrl: "/fixtures/playback/guest-feature.mp4" });
    await expect(
      createVideoProvider({ kind: "fake" }, "production").createPlaybackGrant(grantInput),
    ).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });
});
