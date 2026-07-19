import type { NextRequest } from "next/server";

import {
  authorizeMemberMovieRequest,
  libraryMutationResponse,
  type MemberMovieRouteContext,
} from "@/modules/library/http/member-route-support";
import { libraryService } from "@/modules/library/server";
import { problemResponse } from "@/shared/http/problem-details";

export async function PUT(
  request: NextRequest,
  context: MemberMovieRouteContext,
): Promise<Response> {
  const authorized = await authorizeMemberMovieRequest(request, context);
  if (authorized instanceof Response) {
    return authorized;
  }
  try {
    const result = await libraryService.addToWatchlist({
      actorUserId: authorized.userId,
      movieId: authorized.movieId,
      ownerUserId: authorized.userId,
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
    const result = await libraryService.removeFromWatchlist({
      actorUserId: authorized.userId,
      movieId: authorized.movieId,
      ownerUserId: authorized.userId,
    });
    return libraryMutationResponse(result, authorized.requestId);
  } catch {
    return problemResponse("INTERNAL_ERROR", authorized.requestId);
  }
}
