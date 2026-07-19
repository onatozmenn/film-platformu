import type { MetadataMovie } from "@/modules/catalog/application/metadata-provider-port";
import type { VideoAssetProviderSnapshot } from "@/modules/playback/application/playback-ports";
import type { ActionResult } from "@/shared/application/action-result";

import type { PublicationIssueCode } from "../domain/publication-policy";

export type AdminActorCommand = Readonly<{
  actorUserId: string;
  requestId: string;
}>;

export type AdminImageInput = Readonly<{
  alt: string;
  focalPosition: string;
  height: number;
  src: string;
  width: number;
}>;

export type MovieEditorialInput = Readonly<{
  ageRating: string | null;
  backdrop: AdminImageInput | null;
  genreIds: readonly string[];
  originalTitle: string | null;
  poster: AdminImageInput | null;
  releaseDate: Date;
  runtimeMinutes: number;
  slug: string;
  synopsis: string;
  title: string;
}>;

export type MovieMutationView = Readonly<{
  id: string;
  revision: number;
  slug: string;
}>;

export type CreateMovieDraftCommand = AdminActorCommand & MovieEditorialInput;

export type ImportMovieDraftCommand = AdminActorCommand &
  Readonly<{
    externalId: string;
    metadata: MetadataMovie;
  }>;

export type UpdateMovieEditorialDataCommand = AdminActorCommand &
  MovieEditorialInput &
  Readonly<{
    expectedRevision: number;
    movieId: string;
  }>;

export type AdminCreditInput = Readonly<{
  billingOrder: number;
  characterName: string | null;
  displayLabel: string | null;
  kind: "CAST" | "DIRECTOR" | "OTHER" | "WRITER";
  personName: string;
}>;

export type SetMovieCreditsCommand = AdminActorCommand &
  Readonly<{
    credits: readonly AdminCreditInput[];
    expectedRevision: number;
    movieId: string;
  }>;

export type CollectionMovieInput = Readonly<{
  movieId: string;
  position: number;
}>;

export type UpsertCollectionCommand = AdminActorCommand &
  Readonly<{
    collectionId: string | null;
    description: string | null;
    displayOrder: number;
    expectedRevision: number | null;
    movies: readonly CollectionMovieInput[];
    slug: string;
    state: "DRAFT" | "PUBLISHED";
    title: string;
  }>;

export type CollectionMutationView = Readonly<{
  id: string;
  revision: number;
  slug: string;
}>;

export type AttachVideoAssetCommand = AdminActorCommand &
  Readonly<{
    makeActive: boolean;
    movieId: string;
    providerAssetId: string;
  }>;

export type ResolvedVideoAssetCommand = AttachVideoAssetCommand &
  Readonly<{ providerAsset: VideoAssetProviderSnapshot }>;

export type VideoAssetMutationView = Readonly<{
  assetId: string;
  movieId: string;
  state: "DISABLED" | "ERRORED" | "PREPARING" | "READY";
}>;

export type AdminSubtitleInput = Readonly<{
  isDefault: boolean;
  kind: "CAPTIONS" | "FORCED" | "SUBTITLES";
  label: string;
  languageTag: string;
  providerTrackId: string;
}>;

export type SetSubtitleTracksCommand = AdminActorCommand &
  Readonly<{
    assetId: string;
    movieId: string;
    tracks: readonly AdminSubtitleInput[];
  }>;

export type SetContentRightCommand = AdminActorCommand &
  Readonly<{
    allowStreaming: boolean;
    endsAt: Date;
    evidenceReference: string;
    movieId: string;
    rightId: string | null;
    startsAt: Date;
    territory: string;
  }>;

export type ContentRightMutationView = Readonly<{
  movieId: string;
  rightId: string;
}>;

export type ScheduleMovieCommand = AdminActorCommand &
  Readonly<{
    expectedRevision: number;
    movieId: string;
    publishAt: Date;
  }>;

export type PublishMovieCommand = AdminActorCommand &
  Readonly<{
    expectedRevision: number;
    movieId: string;
  }>;

export type ReturnMovieToDraftCommand = PublishMovieCommand;

export type UnpublishReason = "ASSET" | "EDITORIAL" | "LEGAL" | "OTHER" | "RIGHTS";

export type UnpublishMovieCommand = AdminActorCommand &
  Readonly<{
    expectedRevision: number;
    movieId: string;
    reason: UnpublishReason;
  }>;

export type PrivilegedRole = "ADMIN" | "EDITOR";

export type ChangeRoleCommand = AdminActorCommand &
  Readonly<{
    role: PrivilegedRole;
    subjectUserId: string;
  }>;

export type DisableAccountCommand = AdminActorCommand &
  Readonly<{
    subjectUserId: string;
  }>;

export type PublishDueRepositoryResult = Readonly<{
  examined: number;
  failed: number;
  publishedMovies: readonly Readonly<{ id: string; slug: string }>[];
  skipped: number;
}>;

export type PublishDueResult = Readonly<{
  examined: number;
  failed: number;
  published: number;
  skipped: number;
}>;

export type PublicationValidationData = Readonly<{
  issues: readonly PublicationIssueCode[];
}>;

export interface AdminCommandRepositoryPort {
  attachVideoAsset(
    command: ResolvedVideoAssetCommand,
  ): Promise<ActionResult<VideoAssetMutationView>>;
  createMovieDraft(command: CreateMovieDraftCommand): Promise<ActionResult<MovieMutationView>>;
  disableAccount(
    command: DisableAccountCommand,
  ): Promise<ActionResult<Readonly<{ userId: string }>>>;
  grantRole(command: ChangeRoleCommand): Promise<ActionResult<Readonly<{ userId: string }>>>;
  importMovieDraft(command: ImportMovieDraftCommand): Promise<ActionResult<MovieMutationView>>;
  publishDue(now: Date, limit: number, requestId: string): Promise<PublishDueRepositoryResult>;
  publishMovie(command: PublishMovieCommand): Promise<ActionResult<MovieMutationView>>;
  reconcileVideoAsset(
    command: ResolvedVideoAssetCommand,
  ): Promise<ActionResult<VideoAssetMutationView>>;
  returnMovieToDraft(command: ReturnMovieToDraftCommand): Promise<ActionResult<MovieMutationView>>;
  revokeRole(command: ChangeRoleCommand): Promise<ActionResult<Readonly<{ userId: string }>>>;
  scheduleMovie(command: ScheduleMovieCommand): Promise<ActionResult<MovieMutationView>>;
  setContentRight(command: SetContentRightCommand): Promise<ActionResult<ContentRightMutationView>>;
  setMovieCredits(command: SetMovieCreditsCommand): Promise<ActionResult<MovieMutationView>>;
  setSubtitleTracks(
    command: SetSubtitleTracksCommand,
  ): Promise<ActionResult<VideoAssetMutationView>>;
  unpublishMovie(command: UnpublishMovieCommand): Promise<ActionResult<MovieMutationView>>;
  updateMovieEditorialData(
    command: UpdateMovieEditorialDataCommand,
  ): Promise<ActionResult<MovieMutationView>>;
  upsertCollection(command: UpsertCollectionCommand): Promise<ActionResult<CollectionMutationView>>;
}
