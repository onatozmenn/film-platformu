import type { NextRequest } from "next/server";
import { z } from "zod";

import { consumeFakeEmailLink, isFakeEmailHarnessEnabled } from "@/modules/identity/server";
import { problemResponse } from "@/shared/http/problem-details";
import { createRequestId, requestIdHeader } from "@/shared/http/request-id";

const emailSchema = z.email().trim().toLowerCase().max(320);

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = request.headers.get(requestIdHeader) ?? createRequestId();
  if (!isFakeEmailHarnessEnabled() || request.headers.get("x-film-test-harness") !== "1") {
    return problemResponse("NOT_FOUND", requestId);
  }
  const parsed = emailSchema.safeParse(request.nextUrl.searchParams.get("email"));
  if (!parsed.success) {
    return problemResponse("VALIDATION_FAILED", requestId);
  }
  const url = consumeFakeEmailLink(parsed.data);
  if (url === null) {
    return problemResponse("NOT_FOUND", requestId);
  }
  return Response.json(
    { data: { url } },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": requestId,
      },
    },
  );
}
