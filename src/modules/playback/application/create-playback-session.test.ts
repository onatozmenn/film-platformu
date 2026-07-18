import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  PlaybackCandidate,
  PlaybackGrant,
  PlaybackRepositoryPort,
  VideoProviderPort,
} from "./playback-ports";
import { createPlaybackService } from "./create-playback-session";

const now = new Date("2026-07-19T12:00:00.000Z");
const activeRight = {
  allowStreaming: true,
  endsAt: new Date("2026-07-19T12:02:03.900Z"),
  id: "right-tr",
  startsAt: new Date("2026-07-01T00:00:00.000Z"),
  territory: "TR",
} as const;
const candidate: PlaybackCandidate = {
  assets: [
    {
      durationSeconds: 5_880,
      id: "asset-ready",
      isActive: true,
      providerAssetId: "provider-asset-ready",
      providerPlaybackId: "provider-playback-ready",
      state: "READY",
    },
  ],
  id: "00000000-0000-4000-8000-000000000001",
  publicationState: "PUBLISHED",
  publishAt: null,
  rights: [activeRight],
  title: "Kıyıdaki Sessizlik",
};

function dependencies(
  overrides: {
    candidate?: PlaybackCandidate | null;
    providerError?: Error;
  } = {},
) {
  const clock = vi.fn(() => now);
  const repository: PlaybackRepositoryPort = {
    findCandidateByMovieId: vi.fn(async () =>
      overrides.candidate === undefined ? candidate : overrides.candidate,
    ),
  };
  const videoProvider: VideoProviderPort = {
    createPlaybackGrant: vi.fn(async () => {
      if (overrides.providerError !== undefined) {
        throw overrides.providerError;
      }
      return { fixtureSourceUrl: "/fixtures/playback/guest-feature.mp4", token: "grant-token" };
    }),
    getAsset: vi.fn(async () => null),
    verifyWebhook: vi.fn(async () => ({
      eventId: "event-id",
      eventType: "UNSUPPORTED" as const,
      providerEventType: "unsupported",
    })),
  };

  return { clock, repository, videoProvider };
}

afterEach(() => vi.useRealTimers());

describe("playback service", () => {
  it("creates an opaque private session capped by the rights end using one clock read", async () => {
    const ports = dependencies();
    const service = createPlaybackService({
      ...ports,
      createSessionId: () => "ps_opaque",
    });

    const result = await service.createSession(candidate.id, "TR");

    expect(result).toEqual({
      kind: "success",
      session: {
        movie: {
          durationSeconds: 5_880,
          id: candidate.id,
          title: "Kıyıdaki Sessizlik",
        },
        playback: {
          expiresAt: "2026-07-19T12:02:03.000Z",
          fixtureSourceUrl: "/fixtures/playback/guest-feature.mp4",
          playbackId: "provider-playback-ready",
          provider: "mux",
          token: "grant-token",
        },
        resumeAtSeconds: 0,
        sessionId: "ps_opaque",
      },
    });
    expect(ports.clock).toHaveBeenCalledOnce();
    expect(ports.videoProvider.createPlaybackGrant).toHaveBeenCalledWith({
      expiresAt: new Date("2026-07-19T12:02:03.000Z"),
      lifetimeSeconds: 123,
      playbackId: "provider-playback-ready",
      sessionId: "ps_opaque",
    });
  });

  it("caps a long rights window at five minutes", async () => {
    const ports = dependencies({
      candidate: {
        ...candidate,
        rights: [
          {
            ...activeRight,
            endsAt: new Date("2026-08-01T00:00:00.000Z"),
          },
        ],
      },
    });
    const service = createPlaybackService({ ...ports, createSessionId: () => "ps_opaque" });

    await service.createSession(candidate.id, "TR");

    expect(ports.videoProvider.createPlaybackGrant).toHaveBeenCalledWith(
      expect.objectContaining({
        expiresAt: new Date("2026-07-19T12:05:00.000Z"),
        lifetimeSeconds: 300,
      }),
    );
  });

  it("does not call the provider for absent or ineligible content", async () => {
    const absent = dependencies({ candidate: null });
    const denied = dependencies({
      candidate: { ...candidate, publicationState: "UNPUBLISHED" },
    });

    await expect(
      createPlaybackService({ ...absent, createSessionId: () => "unused" }).createSession(
        candidate.id,
        "TR",
      ),
    ).resolves.toEqual({ kind: "not-found" });
    await expect(
      createPlaybackService({ ...denied, createSessionId: () => "unused" }).createSession(
        candidate.id,
        "TR",
      ),
    ).resolves.toEqual({ kind: "not-available" });
    expect(absent.videoProvider.createPlaybackGrant).not.toHaveBeenCalled();
    expect(denied.videoProvider.createPlaybackGrant).not.toHaveBeenCalled();
  });

  it("fails closed with a coarse result when signing fails", async () => {
    const ports = dependencies({ providerError: new Error("private signing detail") });
    const service = createPlaybackService({ ...ports, createSessionId: () => "ps_opaque" });

    await expect(service.createSession(candidate.id, "TR")).resolves.toEqual({
      kind: "provider-unavailable",
    });
  });

  it("fails closed when grant creation exceeds the provider timeout", async () => {
    vi.useFakeTimers();
    const ports = dependencies();
    ports.videoProvider.createPlaybackGrant = vi.fn(
      () => new Promise<PlaybackGrant>(() => undefined),
    );
    const service = createPlaybackService({
      ...ports,
      createSessionId: () => "ps_opaque",
      providerTimeoutMilliseconds: 2_000,
    });

    const result = service.createSession(candidate.id, "TR");
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(result).resolves.toEqual({ kind: "provider-unavailable" });
  });
});
