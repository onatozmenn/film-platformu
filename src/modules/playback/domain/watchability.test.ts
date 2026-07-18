import { describe, expect, it } from "vitest";

import {
  evaluateWatchability,
  type PlaybackAssetState,
  type PlaybackPublicationState,
  type WatchabilityInput,
} from "./watchability";

const now = new Date("2026-07-19T12:00:00.000Z");
const readyAsset = {
  durationSeconds: 5_880,
  id: "asset-ready",
  isActive: true,
  providerAssetId: "provider-asset-ready",
  providerPlaybackId: "provider-playback-ready",
  state: "READY",
} as const;

function eligibleInput(overrides: Partial<WatchabilityInput> = {}): WatchabilityInput {
  return {
    assets: [readyAsset],
    now,
    publicationState: "PUBLISHED",
    publishAt: null,
    rights: [
      {
        allowStreaming: true,
        endsAt: new Date("2026-08-01T00:00:00.000Z"),
        id: "right-tr",
        startsAt: now,
        territory: "TR",
      },
    ],
    territory: "TR",
    ...overrides,
  };
}

describe("watchability", () => {
  it("allows an exact rights start and exact-due publication with one ready asset", () => {
    const decision = evaluateWatchability(eligibleInput({ publishAt: now }));

    expect(decision).toMatchObject({
      allowed: true,
      asset: { id: "asset-ready" },
      right: { id: "right-tr" },
    });
  });

  it.each([
    ["future", new Date("2026-07-19T12:00:00.001Z"), new Date("2026-08-01T00:00:00.000Z")],
    ["exact end", new Date("2026-07-01T00:00:00.000Z"), now],
    ["expired", new Date("2026-07-01T00:00:00.000Z"), new Date("2026-07-19T11:59:59.999Z")],
  ] as const)("denies a %s rights window", (_label, startsAt, endsAt) => {
    const decision = evaluateWatchability(
      eligibleInput({
        rights: [{ allowStreaming: true, endsAt, id: "right-tr", startsAt, territory: "TR" }],
      }),
    );

    expect(decision).toEqual({ allowed: false, reason: "RIGHTS_UNAVAILABLE" });
  });

  it("denies missing, explicitly denied, and wrong-territory rights", () => {
    expect(evaluateWatchability(eligibleInput({ rights: [] }))).toEqual({
      allowed: false,
      reason: "RIGHTS_UNAVAILABLE",
    });
    expect(
      evaluateWatchability(
        eligibleInput({
          rights: [
            {
              allowStreaming: false,
              endsAt: new Date("2026-08-01T00:00:00.000Z"),
              id: "right-tr",
              startsAt: now,
              territory: "TR",
            },
          ],
        }),
      ),
    ).toEqual({ allowed: false, reason: "RIGHTS_UNAVAILABLE" });
    expect(evaluateWatchability(eligibleInput({ territory: "DE" }))).toEqual({
      allowed: false,
      reason: "RIGHTS_UNAVAILABLE",
    });
  });

  it("denies an unresolved trusted territory before inspecting rights", () => {
    expect(evaluateWatchability(eligibleInput({ territory: null }))).toEqual({
      allowed: false,
      reason: "TERRITORY_UNAVAILABLE",
    });
  });

  it.each(["DRAFT", "SCHEDULED", "UNPUBLISHED"] as const)(
    "denies %s publication state",
    (publicationState: PlaybackPublicationState) => {
      expect(evaluateWatchability(eligibleInput({ publicationState }))).toEqual({
        allowed: false,
        reason: "PUBLICATION_UNAVAILABLE",
      });
    },
  );

  it("denies a published film before its publish time", () => {
    expect(
      evaluateWatchability(eligibleInput({ publishAt: new Date("2026-07-19T12:00:00.001Z") })),
    ).toEqual({ allowed: false, reason: "PUBLICATION_UNAVAILABLE" });
  });

  it.each(["PREPARING", "ERRORED", "DISABLED"] as const)(
    "denies a %s active asset",
    (state: PlaybackAssetState) => {
      expect(evaluateWatchability(eligibleInput({ assets: [{ ...readyAsset, state }] }))).toEqual({
        allowed: false,
        reason: "ASSET_UNAVAILABLE",
      });
    },
  );

  it("denies missing, inactive, duplicate-active, incomplete, and invalid-duration assets", () => {
    const assetCases = [
      [],
      [{ ...readyAsset, isActive: false }],
      [readyAsset, { ...readyAsset, id: "asset-duplicate" }],
      [{ ...readyAsset, providerPlaybackId: null }],
      [{ ...readyAsset, durationSeconds: 0 }],
    ];

    for (const assets of assetCases) {
      expect(evaluateWatchability(eligibleInput({ assets }))).toEqual({
        allowed: false,
        reason: "ASSET_UNAVAILABLE",
      });
    }
  });
});
