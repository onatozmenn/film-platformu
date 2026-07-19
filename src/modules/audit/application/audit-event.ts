export type AuditAction =
  | "ACCOUNT_DISABLED"
  | "COLLECTION_UPDATED"
  | "CONTENT_RIGHT_SET"
  | "MOVIE_CREATED"
  | "MOVIE_CREDITS_SET"
  | "MOVIE_EDITORIAL_UPDATED"
  | "MOVIE_IMPORTED"
  | "MOVIE_PUBLICATION_FAILED"
  | "MOVIE_PUBLISHED"
  | "MOVIE_RETURNED_TO_DRAFT"
  | "MOVIE_SCHEDULED"
  | "MOVIE_UNPUBLISHED"
  | "ROLE_GRANTED"
  | "ROLE_REVOKED"
  | "SUBTITLE_TRACKS_SET"
  | "VIDEO_ASSET_ATTACHED"
  | "VIDEO_ASSET_RECONCILED"
  | "VIDEO_ASSET_STATE_CHANGED";

export type AuditTargetType = "COLLECTION" | "CONTENT_RIGHT" | "MOVIE" | "USER" | "VIDEO_ASSET";

export type AuditMetadataValue =
  boolean | number | string | null | readonly (boolean | number | string | null)[];

export type AuditMetadata = Readonly<Record<string, AuditMetadataValue>>;

export type AuditEventView = Readonly<{
  action: AuditAction;
  actorType: "SYSTEM" | "USER";
  actorUserId: string | null;
  createdAt: Date;
  id: string;
  metadata: AuditMetadata;
  requestId: string;
  targetId: string;
  targetType: AuditTargetType;
}>;
