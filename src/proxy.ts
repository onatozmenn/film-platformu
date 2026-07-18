import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getServerEnvironment } from "@/shared/config/server-environment";
import { requestIdHeader, resolveRequestId } from "@/shared/http/request-id";

export function proxy(request: NextRequest): NextResponse {
  const requestId = resolveRequestId(
    request.headers,
    getServerEnvironment().trustIncomingRequestId,
  );
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(requestIdHeader, requestId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set(requestIdHeader, requestId);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
