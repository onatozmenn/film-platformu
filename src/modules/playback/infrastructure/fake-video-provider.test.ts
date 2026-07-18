import { describe, expect, it } from "vitest";

import { fakeVideoProvider } from "./fake-video-provider";

describe("fake video provider", () => {
  it("returns an owned local source and opaque deterministic token", async () => {
    await expect(
      fakeVideoProvider.createPlaybackGrant({
        expiresAt: new Date("2026-07-19T12:05:00.000Z"),
        lifetimeSeconds: 300,
        playbackId: "fake-playback-kiyidaki-sessizlik",
        sessionId: "ps_opaque",
      }),
    ).resolves.toEqual({
      fixtureSourceUrl: "/fixtures/playback/guest-feature.mp4",
      fixtureTextTracks: [
        {
          default: true,
          kind: "captions",
          label: "Türkçe",
          languageTag: "tr",
          src: "/fixtures/playback/guest-feature-tr.vtt",
        },
      ],
      token: "fake_ps_opaque",
    });
  });

  it("models provider failure and asset lookup deterministically", async () => {
    await expect(
      fakeVideoProvider.createPlaybackGrant({
        expiresAt: new Date("2026-07-19T12:05:00.000Z"),
        lifetimeSeconds: 300,
        playbackId: "fake-playback-provider-error",
        sessionId: "ps_opaque",
      }),
    ).rejects.toMatchObject({ code: "UNAVAILABLE" });
    await expect(fakeVideoProvider.getAsset("unknown")).resolves.toBeNull();
    await expect(fakeVideoProvider.getAsset("fake-asset-draft-preparing")).resolves.toMatchObject({
      state: "PREPARING",
    });
  });

  it("accepts only strict synthetic verified-event fixtures", async () => {
    await expect(
      fakeVideoProvider.verifyWebhook(
        JSON.stringify({
          durationSeconds: 5_880,
          eventId: "event-ready",
          eventType: "ASSET_READY",
          playbackId: "fake-playback-ready",
          providerAssetId: "fake-asset-ready",
        }),
        new Headers(),
        new Date(),
      ),
    ).resolves.toMatchObject({ eventId: "event-ready", eventType: "ASSET_READY" });
    await expect(
      fakeVideoProvider.verifyWebhook("not-json", new Headers(), new Date()),
    ).rejects.toMatchObject({ code: "INVALID_WEBHOOK" });
  });
});
