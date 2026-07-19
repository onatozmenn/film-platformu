import type { NextRequest } from "next/server";
import { z } from "zod";

import {
  authorizeMemberMovieRequest,
  libraryMutationResponse,
  type MemberMovieRouteContext,
  readBoundedJson,
} from "@/modules/library/http/member-route-support";
import { libraryService } from "@/modules/library/server";
import { problemResponse } from "@/shared/http/problem-details";

const ratingSchema = z.object({ valueHalfStars: z.number().int().min(1).max(10) }).strict();

export async function PUT(
  request: NextRequest,
  context: MemberMovieRouteContext,
): Promise<Response> {
  const authorized = await authorizeMemberMovieRequest(request, context);
  if (authorized instanceof Response) {
    return authorized;
  }
  const payload = await readBoundedJson(request, ratingSchema);
  if (payload === null) {
    return problemResponse("VALIDATION_FAILED", authorized.requestId);
  }
  try {
    const result = await libraryService.setRating({
      actorUserId: authorized.userId,
      movieId: authorized.movieId,
      ownerUserId: authorized.userId,
      valueHalfStars: payload.valueHalfStars,
    });
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
    const result = await libraryService.removeRating({
      actorUserId: authorized.userId,
      movieId: authorized.movieId,
      ownerUserId: authorized.userId,
    });
    return libraryMutationResponse(result, authorized.requestId);
  } catch {
    return problemResponse("INTERNAL_ERROR", authorized.requestId);
  }
}
