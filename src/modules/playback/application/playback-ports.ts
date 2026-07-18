import type {
  ContentRightSnapshot,
  PlaybackPublicationState,
  VideoAssetSnapshot,
} from "../domain/watchability";

export type PlaybackCandidate = Readonly<{
  assets: readonly VideoAssetSnapshot[];
  id: string;
  publicationState: PlaybackPublicationState;
  publishAt: Date | null;
  rights: readonly ContentRightSnapshot[];
  title: string;
}>;

export interface PlaybackRepositoryPort {
  findCandidateByMovieId(movieId: string): Promise<PlaybackCandidate | null>;
}

export interface TerritoryResolverPort {
  resolve(headers: Headers): string | null;
}

export type PlaybackGrantInput = Readonly<{
  expiresAt: Date;
  lifetimeSeconds: number;
  playbackId: string;
  sessionId: string;
}>;

export type PlaybackGrant = Readonly<{
  fixtureSourceUrl?: string;
  fixtureTextTracks?: readonly Readonly<{
    default: boolean;
    kind: "captions" | "subtitles";
    label: string;
    languageTag: string;
    src: string;
  }>[];
  token: string;
}>;

export type VideoAssetProviderSnapshot = Readonly<{
  durationSeconds: number | null;
  playbackId: string | null;
  providerAssetId: string;
  state: "ERRORED" | "PREPARING" | "READY";
}>;

export type VerifiedVideoEvent =
  | Readonly<{
      durationSeconds: number | null;
      eventId: string;
      eventType: "ASSET_CREATED" | "ASSET_ERRORED" | "ASSET_READY";
      playbackId: string | null;
      providerAssetId: string;
    }>
  | Readonly<{
      durationSeconds: null;
      eventId: string;
      eventType: "ASSET_DELETED";
      playbackId: null;
      providerAssetId: string;
    }>
  | Readonly<{
      eventId: string;
      eventType: "UNSUPPORTED";
      providerEventType: string;
    }>;

export class VideoProviderError extends Error {
  constructor(readonly code: "INVALID_WEBHOOK" | "UNAVAILABLE") {
    super(code === "INVALID_WEBHOOK" ? "Video webhook is invalid" : "Video provider unavailable");
    this.name = "VideoProviderError";
  }
}

export interface VideoProviderPort {
  createPlaybackGrant(input: PlaybackGrantInput): Promise<PlaybackGrant>;
  getAsset(providerAssetId: string): Promise<VideoAssetProviderSnapshot | null>;
  verifyWebhook(rawBody: string, headers: Headers, now: Date): Promise<VerifiedVideoEvent>;
}

export type ApplyVideoEventResult = "applied" | "asset-not-found" | "duplicate" | "ignored";

export interface VideoWebhookRepositoryPort {
  applyVerifiedEvent(event: VerifiedVideoEvent): Promise<ApplyVideoEventResult>;
}
