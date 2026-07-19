import { describe, expect, it } from "vitest";

import {
  evaluatePublicationReadiness,
  evaluateScheduleReadiness,
  type PublicationAssetSnapshot,
  type PublicationCandidate,
  type PublicationImageSnapshot,
  type PublicationIssueCode,
  type PublicationRightSnapshot,
} from "./publication-policy";

const now = new Date("2026-07-19T12:00:00.000Z");
const future = new Date("2026-07-20T12:00:00.000Z");
const image: PublicationImageSnapshot = {
  alt: "Kurgusal film görseli",
  focalPosition: "50% 50%",
  height: 1_200,
  referenceValidated: true,
  src: "/fixtures/catalog/fog-coast.jpg",
  width: 800,
};
const right: PublicationRightSnapshot = {
  allowStreaming: true,
  endsAt: new Date("2026-08-01T00:00:00.000Z"),
  evidenceReference: "fixture-license:tr-2026",
  startsAt: now,
  territory: "TR",
};
const asset: PublicationAssetSnapshot = {
  durationSeconds: 5_880,
  isActive: true,
  providerPlaybackId: "fixture-playback-id",
  state: "READY",
};

function candidate(overrides: Partial<PublicationCandidate> = {}): PublicationCandidate {
  return {
    assets: [asset],
    backdrop: image,
    genreIds: ["genre-dram"],
    poster: image,
    releaseDate: new Date("2026-01-01T00:00:00.000Z"),
    rights: [right],
    runtimeMinutes: 98,
    synopsis: "Yayın politikasını doğrulayan yeterince uzun kurgusal bir özet.",
    title: "Kıyıdaki Sessizlik",
    ...overrides,
  };
}

function decision(
  overrides: Partial<PublicationCandidate> = {},
  at: Date = now,
  supportedTerritories: readonly string[] = ["TR"],
) {
  return evaluatePublicationReadiness({
    at,
    candidate: candidate(overrides),
    supportedTerritories,
  });
}

describe("publication policy", () => {
  it("accepts complete content at the exact rights start with one active ready asset", () => {
    expect(decision()).toEqual({ ready: true });
  });

  it.each([
    ["TITLE_INVALID", { title: " " }],
    ["TITLE_INVALID", { title: "a".repeat(161) }],
    ["SYNOPSIS_INVALID", { synopsis: "a".repeat(9) }],
    ["SYNOPSIS_INVALID", { synopsis: "a".repeat(5_001) }],
    ["RELEASE_DATE_INVALID", { releaseDate: new Date("invalid") }],
    ["RUNTIME_INVALID", { runtimeMinutes: 0 }],
    ["RUNTIME_INVALID", { runtimeMinutes: 1.5 }],
    ["POSTER_INVALID", { poster: null }],
    ["BACKDROP_INVALID", { backdrop: null }],
    ["GENRE_REQUIRED", { genreIds: [] }],
  ] satisfies readonly [PublicationIssueCode, Partial<PublicationCandidate>][])(
    "returns %s for an invalid completeness field",
    (issue, overrides) => {
      expect(decision(overrides)).toEqual({ issues: [issue], ready: false });
    },
  );

  it.each([
    { referenceValidated: false },
    { src: " " },
    { alt: " " },
    { focalPosition: " " },
    { width: 1.5 },
    { width: 0 },
    { height: 1.5 },
    { height: 0 },
  ] satisfies readonly Partial<PublicationImageSnapshot>[])(
    "rejects incomplete or unvalidated image metadata %#",
    (override) => {
      expect(decision({ poster: { ...image, ...override } })).toEqual({
        issues: ["POSTER_INVALID"],
        ready: false,
      });
    },
  );

  it.each([
    [{ territory: "DE" }, ["TR"]],
    [{ allowStreaming: false }, ["TR"]],
    [{ evidenceReference: null }, ["TR"]],
    [{ evidenceReference: " " }, ["TR"]],
    [{ startsAt: new Date("invalid") }, ["TR"]],
    [{ endsAt: new Date("invalid") }, ["TR"]],
    [{ startsAt: new Date("2026-07-19T12:00:00.001Z") }, ["TR"]],
    [{ endsAt: now }, ["TR"]],
  ] satisfies readonly [Partial<PublicationRightSnapshot>, readonly string[]][])(
    "rejects ineligible rights %#",
    (override, supportedTerritories) => {
      expect(decision({ rights: [{ ...right, ...override }] }, now, supportedTerritories)).toEqual({
        issues: ["RIGHTS_UNAVAILABLE"],
        ready: false,
      });
    },
  );

  it("rejects missing rights and accepts an eligible right among ineligible records", () => {
    expect(decision({ rights: [] })).toEqual({
      issues: ["RIGHTS_UNAVAILABLE"],
      ready: false,
    });
    expect(
      decision({
        rights: [
          { ...right, allowStreaming: false },
          { ...right, territory: "TR" },
        ],
      }),
    ).toEqual({ ready: true });
  });

  it.each([
    [[]],
    [[{ ...asset, isActive: false }]],
    [[asset, asset]],
    [[{ ...asset, state: "PREPARING" }]],
    [[{ ...asset, state: "ERRORED" }]],
    [[{ ...asset, state: "DISABLED" }]],
    [[{ ...asset, providerPlaybackId: null }]],
    [[{ ...asset, providerPlaybackId: " " }]],
    [[{ ...asset, durationSeconds: null }]],
    [[{ ...asset, durationSeconds: 1.5 }]],
    [[{ ...asset, durationSeconds: 0 }]],
  ] satisfies readonly [readonly PublicationAssetSnapshot[]][])(
    "rejects an invalid active asset set %#",
    (assets) => {
      expect(decision({ assets })).toEqual({
        issues: ["ACTIVE_READY_ASSET_REQUIRED"],
        ready: false,
      });
    },
  );

  it("reports every independent issue in stable form", () => {
    expect(
      decision({
        assets: [],
        backdrop: null,
        genreIds: [],
        poster: null,
        releaseDate: new Date("invalid"),
        rights: [],
        runtimeMinutes: 0,
        synopsis: "",
        title: "",
      }),
    ).toEqual({
      issues: [
        "TITLE_INVALID",
        "SYNOPSIS_INVALID",
        "RELEASE_DATE_INVALID",
        "RUNTIME_INVALID",
        "POSTER_INVALID",
        "BACKDROP_INVALID",
        "GENRE_REQUIRED",
        "RIGHTS_UNAVAILABLE",
        "ACTIVE_READY_ASSET_REQUIRED",
      ],
      ready: false,
    });
  });

  it("evaluates scheduled publication at its future instant", () => {
    const scheduledRight = {
      ...right,
      endsAt: new Date("2026-07-21T00:00:00.000Z"),
      startsAt: future,
    };

    expect(
      evaluateScheduleReadiness({
        candidate: candidate({ rights: [scheduledRight] }),
        now,
        publishAt: future,
        supportedTerritories: ["TR"],
      }),
    ).toEqual({ ready: true });
  });

  it.each([now, new Date("2026-07-19T11:59:59.999Z"), new Date("invalid")])(
    "requires a finite future schedule at %s",
    (publishAt) => {
      expect(
        evaluateScheduleReadiness({
          candidate: candidate(),
          now,
          publishAt,
          supportedTerritories: ["TR"],
        }),
      ).toEqual({ issues: ["SCHEDULE_MUST_BE_FUTURE"], ready: false });
    },
  );
});
