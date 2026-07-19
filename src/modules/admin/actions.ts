"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getOptionalMemberSession } from "@/modules/identity/server";
import type { ActionResult } from "@/shared/application/action-result";
import { createRequestId } from "@/shared/http/request-id";
import { logger } from "@/shared/observability/logger";

import { adminCommandService, adminMutationRateLimiter } from "./server";
import {
  parseAssetFormData,
  parseAssetIdentity,
  parseCollectionFormData,
  parseCreditsFormData,
  parseEditorialFormData,
  parseMovieIdentity,
  parseMetadataExternalId,
  parseRightFormData,
  parseRoleFormData,
  parseScheduleFormData,
  parseSubjectFormData,
  parseSubtitlesFormData,
  parseUnpublishFormData,
} from "./http/admin-form-input";

export type AdminActionStatus =
  | "conflict"
  | "error"
  | "forbidden"
  | "invalid"
  | "not-found"
  | "provider-unavailable"
  | "rate-limited"
  | "saved";

async function context() {
  const session = await getOptionalMemberSession();
  if (session === null) {
    redirect("/giris");
  }
  if (!adminMutationRateLimiter.consume(session.user.id)) {
    redirectWithStatus("/yonetim", "rate-limited");
  }
  return { actorUserId: session.user.id, requestId: createRequestId() };
}

function statusFor(result: Exclude<ActionResult<unknown>, { ok: true }>): AdminActionStatus {
  switch (result.code) {
    case "CONFLICT":
      return "conflict";
    case "FORBIDDEN":
      return "forbidden";
    case "INVALID_INPUT":
      return "invalid";
    case "NOT_FOUND":
      return "not-found";
    case "PROVIDER_UNAVAILABLE":
      return "provider-unavailable";
  }
}

function redirectWithStatus(path: string, status: AdminActionStatus): never {
  redirect(`${path}?durum=${status}`);
}

function finish<T>(path: string, result: ActionResult<T>, revalidate: readonly string[]): never {
  if (result.ok) {
    for (const target of revalidate) {
      revalidatePath(target);
    }
    redirectWithStatus(path, "saved");
  }
  redirectWithStatus(path, statusFor(result));
}

async function unexpected<T>(
  event: string,
  path: string,
  operation: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await operation();
  } catch {
    logger.error(event);
    redirectWithStatus(path, "error");
  }
}

export async function createMovieDraftAction(formData: FormData): Promise<never> {
  const input = parseEditorialFormData(formData);
  if (input === null) {
    redirectWithStatus("/yonetim/filmler/yeni", "invalid");
  }
  const actor = await context();
  const result = await unexpected("admin.movie_create_failed", "/yonetim/filmler/yeni", () =>
    adminCommandService.createMovieDraft({ ...actor, ...input }),
  );
  if (result.ok) {
    revalidatePath("/yonetim");
    redirectWithStatus(`/yonetim/filmler/${result.data.id}`, "saved");
  }
  redirectWithStatus("/yonetim/filmler/yeni", statusFor(result));
}

export async function importMovieDraftAction(formData: FormData): Promise<never> {
  const externalId = parseMetadataExternalId(formData);
  const fallback = "/yonetim/filmler/yeni";
  if (externalId === null) {
    redirectWithStatus(fallback, "invalid");
  }
  const actor = await context();
  const result = await unexpected("admin.movie_import_failed", fallback, () =>
    adminCommandService.importMovieDraft({ ...actor, externalId }),
  );
  if (result.ok) {
    revalidatePath("/yonetim");
    redirectWithStatus(`/yonetim/filmler/${result.data.id}`, "saved");
  }
  redirectWithStatus(fallback, statusFor(result));
}

export async function updateMovieEditorialAction(formData: FormData): Promise<never> {
  const identity = parseMovieIdentity(formData);
  const input = parseEditorialFormData(formData);
  const fallback = identity === null ? "/yonetim" : `/yonetim/filmler/${identity.id}`;
  if (identity === null || input === null) {
    redirectWithStatus(fallback, "invalid");
  }
  const actor = await context();
  const result = await unexpected("admin.movie_update_failed", fallback, () =>
    adminCommandService.updateMovieEditorialData({
      ...actor,
      ...input,
      expectedRevision: identity.revision,
      movieId: identity.id,
    }),
  );
  finish(fallback, result, [fallback, "/yonetim"]);
}

export async function setMovieCreditsAction(formData: FormData): Promise<never> {
  const identity = parseMovieIdentity(formData);
  const credits = parseCreditsFormData(formData);
  const fallback = identity === null ? "/yonetim" : `/yonetim/filmler/${identity.id}`;
  if (identity === null || credits === null) {
    redirectWithStatus(fallback, "invalid");
  }
  const actor = await context();
  const result = await unexpected("admin.credits_update_failed", fallback, () =>
    adminCommandService.setMovieCredits({
      ...actor,
      credits,
      expectedRevision: identity.revision,
      movieId: identity.id,
    }),
  );
  finish(fallback, result, [fallback, "/yonetim"]);
}

export async function attachVideoAssetAction(formData: FormData): Promise<never> {
  const input = parseAssetFormData(formData);
  const fallback = input === null ? "/yonetim" : `/yonetim/filmler/${input.movieId}`;
  if (input === null) {
    redirectWithStatus(fallback, "invalid");
  }
  const actor = await context();
  const result = await unexpected("admin.asset_attach_failed", fallback, () =>
    adminCommandService.attachVideoAsset({ ...actor, ...input }),
  );
  finish(fallback, result, [fallback, "/yonetim"]);
}

export async function reconcileVideoAssetAction(formData: FormData): Promise<never> {
  const input = parseAssetFormData(formData);
  const fallback = input === null ? "/yonetim" : `/yonetim/filmler/${input.movieId}`;
  if (input === null) {
    redirectWithStatus(fallback, "invalid");
  }
  const actor = await context();
  const result = await unexpected("admin.asset_reconcile_failed", fallback, () =>
    adminCommandService.reconcileVideoAsset({ ...actor, ...input }),
  );
  finish(fallback, result, [fallback, "/yonetim"]);
}

export async function setSubtitleTracksAction(formData: FormData): Promise<never> {
  const identity = parseAssetIdentity(formData);
  const tracks = parseSubtitlesFormData(formData);
  const fallback = identity === null ? "/yonetim" : `/yonetim/filmler/${identity.movieId}`;
  if (identity === null || tracks === null) {
    redirectWithStatus(fallback, "invalid");
  }
  const actor = await context();
  const result = await unexpected("admin.subtitles_update_failed", fallback, () =>
    adminCommandService.setSubtitleTracks({ ...actor, ...identity, tracks }),
  );
  finish(fallback, result, [fallback]);
}

export async function setContentRightAction(formData: FormData): Promise<never> {
  const input = parseRightFormData(formData);
  const fallback = input === null ? "/yonetim" : `/yonetim/filmler/${input.movieId}`;
  if (input === null) {
    redirectWithStatus(fallback, "invalid");
  }
  const actor = await context();
  const result = await unexpected("admin.right_update_failed", fallback, () =>
    adminCommandService.setContentRight({ ...actor, ...input }),
  );
  finish(fallback, result, [fallback, "/yonetim"]);
}

export async function scheduleMovieAction(formData: FormData): Promise<never> {
  const input = parseScheduleFormData(formData);
  const fallback = input === null ? "/yonetim" : `/yonetim/filmler/${input.id}`;
  if (input === null) {
    redirectWithStatus(fallback, "invalid");
  }
  const actor = await context();
  const result = await unexpected("admin.movie_schedule_failed", fallback, () =>
    adminCommandService.scheduleMovie({
      ...actor,
      expectedRevision: input.revision,
      movieId: input.id,
      publishAt: input.publishAt,
    }),
  );
  finish(fallback, result, [fallback, "/yonetim"]);
}

export async function publishMovieAction(formData: FormData): Promise<never> {
  const input = parseMovieIdentity(formData);
  const fallback = input === null ? "/yonetim" : `/yonetim/filmler/${input.id}`;
  if (input === null) {
    redirectWithStatus(fallback, "invalid");
  }
  const actor = await context();
  const result = await unexpected("admin.movie_publish_failed", fallback, () =>
    adminCommandService.publishMovie({
      ...actor,
      expectedRevision: input.revision,
      movieId: input.id,
    }),
  );
  finish(fallback, result, [fallback, "/yonetim"]);
}

export async function returnMovieToDraftAction(formData: FormData): Promise<never> {
  const input = parseMovieIdentity(formData);
  const fallback = input === null ? "/yonetim" : `/yonetim/filmler/${input.id}`;
  if (input === null) {
    redirectWithStatus(fallback, "invalid");
  }
  const actor = await context();
  const result = await unexpected("admin.movie_return_to_draft_failed", fallback, () =>
    adminCommandService.returnMovieToDraft({
      ...actor,
      expectedRevision: input.revision,
      movieId: input.id,
    }),
  );
  finish(fallback, result, [fallback, "/yonetim"]);
}

export async function unpublishMovieAction(formData: FormData): Promise<never> {
  const input = parseUnpublishFormData(formData);
  const fallback = input === null ? "/yonetim" : `/yonetim/filmler/${input.id}`;
  if (input === null) {
    redirectWithStatus(fallback, "invalid");
  }
  const actor = await context();
  const result = await unexpected("admin.movie_unpublish_failed", fallback, () =>
    adminCommandService.unpublishMovie({
      ...actor,
      expectedRevision: input.revision,
      movieId: input.id,
      reason: input.reason,
    }),
  );
  finish(fallback, result, [fallback, "/yonetim"]);
}

export async function upsertCollectionAction(formData: FormData): Promise<never> {
  const input = parseCollectionFormData(formData);
  const fallback = "/yonetim/seckiler";
  if (input === null) {
    redirectWithStatus(fallback, "invalid");
  }
  const actor = await context();
  const result = await unexpected("admin.collection_update_failed", fallback, () =>
    adminCommandService.upsertCollection({ ...actor, ...input }),
  );
  finish(fallback, result, [fallback, "/yonetim"]);
}

export async function grantRoleAction(formData: FormData): Promise<never> {
  const input = parseRoleFormData(formData);
  const fallback = "/yonetim/roller";
  if (input === null) {
    redirectWithStatus(fallback, "invalid");
  }
  const actor = await context();
  const result = await unexpected("admin.role_grant_failed", fallback, () =>
    adminCommandService.grantRole({ ...actor, ...input }),
  );
  finish(fallback, result, [fallback]);
}

export async function revokeRoleAction(formData: FormData): Promise<never> {
  const input = parseRoleFormData(formData);
  const fallback = "/yonetim/roller";
  if (input === null) {
    redirectWithStatus(fallback, "invalid");
  }
  const actor = await context();
  const result = await unexpected("admin.role_revoke_failed", fallback, () =>
    adminCommandService.revokeRole({ ...actor, ...input }),
  );
  finish(fallback, result, [fallback]);
}

export async function disableAccountAction(formData: FormData): Promise<never> {
  const subjectUserId = parseSubjectFormData(formData);
  const fallback = "/yonetim/roller";
  if (subjectUserId === null) {
    redirectWithStatus(fallback, "invalid");
  }
  const actor = await context();
  const result = await unexpected("admin.account_disable_failed", fallback, () =>
    adminCommandService.disableAccount({ ...actor, subjectUserId }),
  );
  finish(fallback, result, [fallback, "/yonetim"]);
}
