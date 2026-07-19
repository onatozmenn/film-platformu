import type { NextRequest } from "next/server";

import { resetAdminBrowserFixture } from "@/modules/admin/server";
import { isFakeEmailHarnessEnabled } from "@/modules/identity/server";
import { problemResponse } from "@/shared/http/problem-details";
import { createRequestId, requestIdHeader } from "@/shared/http/request-id";

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = request.headers.get(requestIdHeader) ?? createRequestId();
  if (!isFakeEmailHarnessEnabled() || request.headers.get("x-film-test-harness") !== "1") {
    return problemResponse("NOT_FOUND", requestId);
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (
    request.headers.has("cookie") ||
    request.headers.has("origin") ||
    request.headers.has("content-type") ||
    !Number.isFinite(contentLength) ||
    contentLength > 0
  ) {
    return problemResponse("FORBIDDEN", requestId);
  }
  try {
    await resetAdminBrowserFixture();
    return new Response(null, {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": requestId,
      },
      status: 204,
    });
  } catch {
    return problemResponse("INTERNAL_ERROR", requestId);
  }
}
