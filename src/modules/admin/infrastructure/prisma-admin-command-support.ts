import type { Prisma } from "@/generated/prisma/client";
import type { AuditAction, AuditTargetType } from "@/modules/audit/application/audit-event";
import type { ActionFieldErrors } from "@/shared/application/action-result";

import type { MovieEditorialInput } from "../application/admin-command-port";
import {
  hasPlatformCapability,
  type PlatformCapability,
  type PlatformRole,
} from "../domain/capability-policy";
import type {
  PublicationCandidate,
  PublicationDecision,
  PublicationImageSnapshot,
  PublicationIssueCode,
} from "../domain/publication-policy";

export type AdminTransaction = Prisma.TransactionClient;

export const publicationCandidateSelect = {
  backdropAlt: true,
  backdropFocalPosition: true,
  backdropHeight: true,
  backdropSrc: true,
  backdropWidth: true,
  contentRights: {
    select: {
      allowStreaming: true,
      endsAt: true,
      evidenceReference: true,
      startsAt: true,
      territory: true,
    },
  },
  firstPublishedAt: true,
  genres: { select: { genreId: true } },
  id: true,
  posterAlt: true,
  posterFocalPosition: true,
  posterHeight: true,
  posterSrc: true,
  posterWidth: true,
  publicationState: true,
  publishAt: true,
  releaseDate: true,
  revision: true,
  runtimeMinutes: true,
  slug: true,
  synopsis: true,
  title: true,
  videoAssets: {
    select: {
      durationSeconds: true,
      isActive: true,
      providerPlaybackId: true,
      state: true,
    },
  },
} satisfies Prisma.MovieSelect;

export type PublicationCandidateRow = Prisma.MovieGetPayload<{
  select: typeof publicationCandidateSelect;
}>;

const ownedImagePath = /^\/fixtures\/catalog\/[a-z0-9-]+\.(?:jpg|jpeg|png|webp)$/u;
const focalPosition = /^(?:100|\d{1,2})% (?:100|\d{1,2})%$/u;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function mapRole(role: "ADMIN" | "EDITOR" | "MEMBER"): PlatformRole {
  return role;
}

export async function isAuthorized(
  transaction: AdminTransaction,
  userId: string,
  capability: PlatformCapability,
): Promise<boolean> {
  const profile = await transaction.userProfile.findUnique({
    where: { userId },
    select: {
      deletedAt: true,
      disabledAt: true,
      user: { select: { roles: { select: { role: true } } } },
    },
  });
  if (profile === null || profile.deletedAt !== null || profile.disabledAt !== null) {
    return false;
  }
  return hasPlatformCapability(
    profile.user.roles.map(({ role }) => mapRole(role)),
    capability,
  );
}

type AppendAuditInput = Readonly<{
  action: AuditAction;
  actorUserId: string | null;
  metadata?: Prisma.InputJsonObject;
  requestId: string;
  targetId: string;
  targetType: AuditTargetType;
}>;

export async function appendAuditEvent(
  transaction: AdminTransaction,
  input: AppendAuditInput,
): Promise<void> {
  await transaction.auditEvent.create({
    data: {
      action: input.action,
      actorType: input.actorUserId === null ? "SYSTEM" : "USER",
      actorUserId: input.actorUserId,
      metadata: input.metadata ?? {},
      requestId: input.requestId,
      targetId: input.targetId,
      targetType: input.targetType,
    },
  });
}

function mapImage(
  src: string | null,
  alt: string | null,
  focal: string | null,
  width: number | null,
  height: number | null,
): PublicationImageSnapshot | null {
  if (src === null) {
    return null;
  }
  return {
    alt: alt ?? "",
    focalPosition: focal ?? "",
    height: height ?? 0,
    referenceValidated: ownedImagePath.test(src),
    src,
    width: width ?? 0,
  };
}

export function mapPublicationCandidate(row: PublicationCandidateRow): PublicationCandidate {
  return {
    assets: row.videoAssets.map((asset) => ({
      durationSeconds: asset.durationSeconds,
      isActive: asset.isActive,
      providerPlaybackId: asset.providerPlaybackId,
      state: asset.state,
    })),
    backdrop: mapImage(
      row.backdropSrc,
      row.backdropAlt,
      row.backdropFocalPosition,
      row.backdropWidth,
      row.backdropHeight,
    ),
    genreIds: row.genres.map(({ genreId }) => genreId),
    poster: mapImage(
      row.posterSrc,
      row.posterAlt,
      row.posterFocalPosition,
      row.posterWidth,
      row.posterHeight,
    ),
    releaseDate: row.releaseDate,
    rights: row.contentRights.map((right) => ({
      allowStreaming: right.allowStreaming,
      endsAt: right.endsAt,
      evidenceReference: right.evidenceReference,
      startsAt: right.startsAt,
      territory: right.territory,
    })),
    runtimeMinutes: row.runtimeMinutes,
    synopsis: row.synopsis,
    title: row.title,
  };
}

function isValidImageInput(image: MovieEditorialInput["poster"]): boolean {
  return (
    image === null ||
    (ownedImagePath.test(image.src) &&
      image.alt.trim().length > 0 &&
      image.alt.trim().length <= 240 &&
      focalPosition.test(image.focalPosition) &&
      Number.isInteger(image.width) &&
      image.width > 0 &&
      Number.isInteger(image.height) &&
      image.height > 0)
  );
}

export function validateEditorialInput(input: MovieEditorialInput): ActionFieldErrors | null {
  const errors: Record<string, readonly string[]> = {};
  const title = input.title.trim();
  const synopsis = input.synopsis.trim();

  if (title.length < 1 || title.length > 160) {
    errors.title = ["Başlık 1 ile 160 karakter arasında olmalıdır."];
  }
  if (synopsis.length < 10 || synopsis.length > 5_000) {
    errors.synopsis = ["Özet 10 ile 5000 karakter arasında olmalıdır."];
  }
  if (!Number.isFinite(input.releaseDate.getTime())) {
    errors.releaseDate = ["Geçerli bir gösterim tarihi girin."];
  }
  if (!Number.isInteger(input.runtimeMinutes) || input.runtimeMinutes <= 0) {
    errors.runtimeMinutes = ["Süre pozitif bir tam sayı olmalıdır."];
  }
  if (!slugPattern.test(input.slug) || input.slug.length > 96) {
    errors.slug = ["Film adresi geçerli değildir."];
  }
  if (
    input.originalTitle !== null &&
    (input.originalTitle.trim().length < 1 || input.originalTitle.trim().length > 160)
  ) {
    errors.originalTitle = ["Özgün başlık 1 ile 160 karakter arasında olmalıdır."];
  }
  if (
    input.ageRating !== null &&
    (input.ageRating.trim().length < 1 || input.ageRating.trim().length > 32)
  ) {
    errors.ageRating = ["Yaş sınıflandırması geçerli değildir."];
  }
  if (!isValidImageInput(input.poster)) {
    errors.poster = ["Afiş yalnızca doğrulanmış yerel görsel ve eksiksiz metadata kullanabilir."];
  }
  if (!isValidImageInput(input.backdrop)) {
    errors.backdrop = ["Fon yalnızca doğrulanmış yerel görsel ve eksiksiz metadata kullanabilir."];
  }
  if (new Set(input.genreIds).size !== input.genreIds.length || input.genreIds.length > 20) {
    errors.genreIds = ["Tür listesi benzersiz ve en fazla 20 kayıt olmalıdır."];
  }

  return Object.keys(errors).length === 0 ? null : errors;
}

const publicationIssueMessages: Readonly<Record<PublicationIssueCode, string>> = {
  ACTIVE_READY_ASSET_REQUIRED: "Tam olarak bir etkin ve hazır video varlığı gereklidir.",
  BACKDROP_INVALID: "Doğrulanmış fon görseli gereklidir.",
  GENRE_REQUIRED: "En az bir tür gereklidir.",
  POSTER_INVALID: "Doğrulanmış afiş görseli gereklidir.",
  RELEASE_DATE_INVALID: "Geçerli bir gösterim tarihi gereklidir.",
  RIGHTS_UNAVAILABLE: "Desteklenen bir bölgede kanıtlı ve etkin gösterim hakkı gereklidir.",
  RUNTIME_INVALID: "Pozitif bir film süresi gereklidir.",
  SCHEDULE_MUST_BE_FUTURE: "Yayın zamanı gelecekte olmalıdır.",
  SYNOPSIS_INVALID: "Yayınlanabilir uzunlukta bir özet gereklidir.",
  TITLE_INVALID: "Yayınlanabilir uzunlukta bir başlık gereklidir.",
};

export function publicationDecisionErrors(decision: PublicationDecision): ActionFieldErrors | null {
  return decision.ready
    ? null
    : { publication: decision.issues.map((issue) => publicationIssueMessages[issue]) };
}
