import type { NextRequest } from "next/server";

import { catalogInvalidation } from "@/modules/catalog/server";
import { authorizeMemberRequest } from "@/modules/identity/http/authorize-member-request";
import { accountLifecycleService } from "@/modules/identity/server";
import { privateNoContent } from "@/shared/http/private-response";
import { problemResponse } from "@/shared/http/problem-details";
import { logger } from "@/shared/observability/logger";

function deletedAccountResponse(requestId: string): Response {
  const response = privateNoContent(requestId);
  response.headers.append(
    "Set-Cookie",
    "next-auth.session-token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
  );
  response.headers.append(
    "Set-Cookie",
    "__Secure-next-auth.session-token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
  );
  return response;
}

export async function DELETE(request: NextRequest): Promise<Response> {
  const authorized = await authorizeMemberRequest(request);
  if (authorized instanceof Response) {
    return authorized;
  }
  try {
    const result = await accountLifecycleService.requestDeletion({
      actorUserId: authorized.userId,
      ownerUserId: authorized.userId,
    });
    switch (result.kind) {
      case "success": {
        try {
          catalogInvalidation.invalidate({});
        } catch {
          logger.warn("catalog.invalidation_failed", {
            outcome: "eventual-consistency",
            requestId: authorized.requestId,
          });
        }
        return deletedAccountResponse(authorized.requestId);
      }
      case "final-admin":
        return problemResponse("CONFLICT", authorized.requestId);
      case "forbidden":
        return problemResponse("FORBIDDEN", authorized.requestId);
      case "not-found":
        return problemResponse("NOT_FOUND", authorized.requestId);
    }
  } catch {
    return problemResponse("INTERNAL_ERROR", authorized.requestId);
  }
}
