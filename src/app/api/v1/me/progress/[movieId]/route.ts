import type { NextRequest } from "next/server";
import { z } from "zod";

import {
  authorizeMemberMovieRequest,
  libraryMutationResponse,
  type MemberMovieRouteContext,
  readBoundedJson,
} from "@/modules/library/http/member-route-support";
import {
  libraryService,
  progressWriteCoalescer,
  progressWriteRateLimiter,
} from "@/modules/library/server";
import { problemResponse } from "@/shared/http/problem-details";

const progressSchema = z
  .object({
    durationSeconds: z.number(),
    observedAt: z.iso.datetime(),
    positionSeconds: z.number(),
  })
  .strict();

export async function PUT(
  request: NextRequest,
  context: MemberMovieRouteContext,
): Promise<Response> {
  const authorized = await authorizeMemberMovieRequest(request, context);
  if (authorized instanceof Response) {
    return authorized;
  }
  const payload = await readBoundedJson(request, progressSchema);
  if (payload === null) {
    return problemResponse("VALIDATION_FAILED", authorized.requestId);
  }
  const key = `${authorized.userId}:${authorized.movieId}`;
  if (!progressWriteRateLimiter.consume(key)) {
    return problemResponse("RATE_LIMITED", authorized.requestId);
  }
  try {
    const observedAt = new Date(payload.observedAt);
    const result = await progressWriteCoalescer.run(key, observedAt, () =>
      libraryService.updateProgress({
        actorUserId: authorized.userId,
        durationSeconds: payload.durationSeconds,
        movieId: authorized.movieId,
        observedAt,
        ownerUserId: authorized.userId,
        positionSeconds: payload.positionSeconds,
      }),
    );
    return libraryMutationResponse(result, authorized.requestId);
  } catch {
    return problemResponse("INTERNAL_ERROR", authorized.requestId);
  }
}

export async function DELETE(
  request: NextRequest,
  context: MemberMovieRouteContext,
): Promise<Response> {
  const authorized = await authorizeMemberMovieRequest(request, context);
  if (authorized instanceof Response) {
    return authorized;
  }
  try {
    const result = await libraryService.clearProgress({
      actorUserId: authorized.userId,
      movieId: authorized.movieId,
      ownerUserId: authorized.userId,
    });
    return libraryMutationResponse(result, authorized.requestId);
  } catch {
    return problemResponse("INTERNAL_ERROR", authorized.requestId);
  }
}
