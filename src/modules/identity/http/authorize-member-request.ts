import type { NextRequest } from "next/server";

import { getServerEnvironment } from "@/shared/config/server-environment";
import { problemResponse } from "@/shared/http/problem-details";
import { createRequestId, requestIdHeader } from "@/shared/http/request-id";

import { getOptionalMemberSession } from "../server";

export type AuthorizedMemberRequest = Readonly<{
  requestId: string;
  userId: string;
}>;

function isSameOrigin(request: NextRequest): boolean {
  const expected = new URL(getServerEnvironment().siteOrigin);
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin === null || host === null) {
    return false;
  }
  try {
    return new URL(origin).origin === expected.origin && host === expected.host;
  } catch {
    return false;
  }
}

export async function authorizeMemberRequest(
  request: NextRequest,
): Promise<AuthorizedMemberRequest | Response> {
  const requestId = request.headers.get(requestIdHeader) ?? createRequestId();
  if (!isSameOrigin(request)) {
    return problemResponse("FORBIDDEN", requestId);
  }
  const session = await getOptionalMemberSession();
  if (session === null) {
    return problemResponse("AUTHENTICATION_REQUIRED", requestId);
  }
  return { requestId, userId: session.user.id };
}
