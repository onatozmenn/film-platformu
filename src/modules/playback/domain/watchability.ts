export type PlaybackPublicationState = "DRAFT" | "PUBLISHED" | "SCHEDULED" | "UNPUBLISHED";
export type PlaybackAssetState = "DISABLED" | "ERRORED" | "PREPARING" | "READY";

export type ContentRightSnapshot = Readonly<{
  allowStreaming: boolean;
  endsAt: Date;
  id: string;
  startsAt: Date;
  territory: string;
}>;

export type VideoAssetSnapshot = Readonly<{
  durationSeconds: number | null;
  id: string;
  isActive: boolean;
  providerAssetId: string;
  providerPlaybackId: string | null;
  state: PlaybackAssetState;
}>;

export type WatchabilityInput = Readonly<{
  assets: readonly VideoAssetSnapshot[];
  now: Date;
  publicationState: PlaybackPublicationState;
  publishAt: Date | null;
  rights: readonly ContentRightSnapshot[];
  territory: string | null;
}>;

export type WatchabilityDenialReason =
  "ASSET_UNAVAILABLE" | "PUBLICATION_UNAVAILABLE" | "RIGHTS_UNAVAILABLE" | "TERRITORY_UNAVAILABLE";

export type WatchabilityDecision =
  | Readonly<{
      allowed: false;
      reason: WatchabilityDenialReason;
    }>
  | Readonly<{
      allowed: true;
      asset: VideoAssetSnapshot & Readonly<{ durationSeconds: number; providerPlaybackId: string }>;
      right: ContentRightSnapshot;
    }>;

export function evaluateWatchability(input: WatchabilityInput): WatchabilityDecision {
  if (
    input.publicationState !== "PUBLISHED" ||
    (input.publishAt !== null && input.publishAt.getTime() > input.now.getTime())
  ) {
    return { allowed: false, reason: "PUBLICATION_UNAVAILABLE" };
  }

  if (input.territory === null) {
    return { allowed: false, reason: "TERRITORY_UNAVAILABLE" };
  }

  const right = input.rights.find(
    (candidate) =>
      candidate.territory === input.territory &&
      candidate.allowStreaming &&
      candidate.startsAt.getTime() <= input.now.getTime() &&
      input.now.getTime() < candidate.endsAt.getTime(),
  );
  if (right === undefined) {
    return { allowed: false, reason: "RIGHTS_UNAVAILABLE" };
  }

  const activeAssets = input.assets.filter((asset) => asset.isActive);
  const asset = activeAssets[0];
  if (
    activeAssets.length !== 1 ||
    asset === undefined ||
    asset.state !== "READY" ||
    asset.providerPlaybackId === null ||
    asset.providerPlaybackId.length === 0 ||
    asset.durationSeconds === null ||
    asset.durationSeconds <= 0
  ) {
    return { allowed: false, reason: "ASSET_UNAVAILABLE" };
  }

  return {
    allowed: true,
    asset: {
      ...asset,
      durationSeconds: asset.durationSeconds,
      providerPlaybackId: asset.providerPlaybackId,
    },
    right,
  };
}
