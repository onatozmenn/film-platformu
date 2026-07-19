import type { AuditAction, AuditTargetType } from "@/modules/audit/application/audit-event";
import type { MovieDetailView } from "@/modules/catalog/application/catalog-query-port";

import type { PlatformRole } from "../domain/capability-policy";

export type AdminActorView = Readonly<{
  displayName: string;
  id: string;
  roles: readonly PlatformRole[];
}>;

export type AdminMovieListItem = Readonly<{
  id: string;
  lastPublishFailure: "ASSET_UNAVAILABLE" | "CONTENT_INCOMPLETE" | "RIGHTS_UNAVAILABLE" | null;
  publicationState: "DRAFT" | "PUBLISHED" | "SCHEDULED" | "UNPUBLISHED";
  publishAt: Date | null;
  revision: number;
  slug: string;
  title: string;
  updatedAt: Date;
}>;

export type AdminWorkspaceView = Readonly<{
  actor: AdminActorView;
  movies: readonly AdminMovieListItem[];
  totals: Readonly<Record<"DRAFT" | "PUBLISHED" | "SCHEDULED" | "UNPUBLISHED", number>>;
}>;

export type AdminMovieCreateView = Readonly<{
  actor: AdminActorView;
  genreOptions: readonly Readonly<{ id: string; name: string }>[];
}>;

export type AdminImageView = Readonly<{
  alt: string;
  focalPosition: string;
  height: number;
  src: string;
  width: number;
}>;

export type AdminCreditView = Readonly<{
  billingOrder: number;
  characterName: string | null;
  displayLabel: string | null;
  id: string;
  kind: "CAST" | "DIRECTOR" | "OTHER" | "WRITER";
  personName: string;
}>;

export type AdminSubtitleView = Readonly<{
  id: string;
  isDefault: boolean;
  kind: "CAPTIONS" | "FORCED" | "SUBTITLES";
  label: string;
  languageTag: string;
  providerTrackId: string;
}>;

export type AdminVideoAssetView = Readonly<{
  durationSeconds: number | null;
  id: string;
  isActive: boolean;
  providerAssetId: string;
  providerPlaybackId: string | null;
  state: "DISABLED" | "ERRORED" | "PREPARING" | "READY";
  subtitleTracks: readonly AdminSubtitleView[];
}>;

export type AdminContentRightView = Readonly<{
  allowStreaming: boolean;
  endsAt: Date;
  evidenceReference: string | null;
  id: string;
  startsAt: Date;
  territory: string;
}>;

export type AdminMovieEditorView = Readonly<{
  actor: AdminActorView;
  ageRating: string | null;
  backdrop: AdminImageView | null;
  contentRights: readonly AdminContentRightView[];
  credits: readonly AdminCreditView[];
  firstPublishedAt: Date | null;
  genreIds: readonly string[];
  genreOptions: readonly Readonly<{ id: string; name: string }>[];
  id: string;
  lastPublishAttemptAt: Date | null;
  lastPublishFailure: AdminMovieListItem["lastPublishFailure"];
  originalTitle: string | null;
  poster: AdminImageView | null;
  publicationState: AdminMovieListItem["publicationState"];
  publishAt: Date | null;
  releaseDate: Date;
  revision: number;
  runtimeMinutes: number;
  slug: string;
  synopsis: string;
  title: string;
  updatedAt: Date;
  videoAssets: readonly AdminVideoAssetView[];
}>;

export type AdminCollectionView = Readonly<{
  description: string | null;
  displayOrder: number;
  id: string;
  movies: readonly Readonly<{ movieId: string; position: number; title: string }>[];
  revision: number;
  slug: string;
  state: "DRAFT" | "PUBLISHED";
  title: string;
}>;

export type AdminCollectionsView = Readonly<{
  actor: AdminActorView;
  collections: readonly AdminCollectionView[];
  movieOptions: readonly Readonly<{ id: string; title: string }>[];
}>;

export type AdminAccountView = Readonly<{
  disabledAt: Date | null;
  displayName: string;
  email: string | null;
  id: string;
  roles: readonly PlatformRole[];
}>;

export type AdminRolesView = Readonly<{
  accounts: readonly AdminAccountView[];
  actor: AdminActorView;
}>;

export type RedactedAuditMetadata = readonly Readonly<{ key: string; value: string }>[];

export type AdminAuditEventView = Readonly<{
  action: AuditAction | "UNKNOWN";
  actorType: "SYSTEM" | "USER";
  actorUserId: string | null;
  createdAt: Date;
  id: string;
  metadata: RedactedAuditMetadata;
  requestId: string;
  targetId: string;
  targetType: AuditTargetType | "UNKNOWN";
}>;

export type AdminAuditView = Readonly<{
  actor: AdminActorView;
  events: readonly AdminAuditEventView[];
}>;

export interface AdminQueryPort {
  getAudit(actorUserId: string, limit: number): Promise<AdminAuditView | null>;
  getCollections(actorUserId: string): Promise<AdminCollectionsView | null>;
  getCreateMovie(actorUserId: string): Promise<AdminMovieCreateView | null>;
  getMovie(actorUserId: string, movieId: string): Promise<AdminMovieEditorView | null>;
  getPreview(actorUserId: string, movieId: string): Promise<MovieDetailView | null>;
  getRoles(actorUserId: string): Promise<AdminRolesView | null>;
  getWorkspace(actorUserId: string): Promise<AdminWorkspaceView | null>;
}
