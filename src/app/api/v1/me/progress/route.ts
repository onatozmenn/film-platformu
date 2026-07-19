import type { NextRequest } from "next/server";

import {
  authorizeMemberRequest,
  libraryMutationResponse,
} from "@/modules/library/http/member-route-support";
import { libraryService } from "@/modules/library/server";
import { problemResponse } from "@/shared/http/problem-details";

export async function DELETE(request: NextRequest): Promise<Response> {
  const authorized = await authorizeMemberRequest(request);
  if (authorized instanceof Response) {
    return authorized;
  }
  try {
    const result = await libraryService.clearAllProgress({
      actorUserId: authorized.userId,
      ownerUserId: authorized.userId,
    });
    return libraryMutationResponse(result, authorized.requestId);
  } catch {
    return problemResponse("INTERNAL_ERROR", authorized.requestId);
  }
}
