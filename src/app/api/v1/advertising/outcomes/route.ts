import type { NextRequest } from "next/server";
import { z } from "zod";

import { advertisingOutcomeRateLimiter } from "@/modules/advertising/server";
import { getServerEnvironment } from "@/shared/config/server-environment";
import { problemResponse } from "@/shared/http/problem-details";
import { createRequestId, requestIdHeader } from "@/shared/http/request-id";
import { logger } from "@/shared/observability/logger";

const maximumBodyBytes = 512;
const outcomeSchema = z
  .object({
    outcome: z.enum(["blocked", "completed", "empty", "error", "skipped", "timeout"]),
    sessionId: z
      .string()
      .regex(/^ps_[a-zA-Z0-9]+$/u)
      .max(64),
  })
  .strict();

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

function rateLimitKey(request: NextRequest): string {
  if (process.env.VERCEL !== "1") {
    return "untrusted-deployment";
  }
  return request.headers.get("x-real-ip")?.trim() || "unresolved-visitor";
}

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = request.headers.get(requestIdHeader) ?? createRequestId();
  if (!isSameOrigin(request)) {
    return problemResponse("FORBIDDEN", requestId);
  }
  if (!advertisingOutcomeRateLimiter.consume(rateLimitKey(request))) {
    return problemResponse("RATE_LIMITED", requestId);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return problemResponse("VALIDATION_FAILED", requestId);
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    return problemResponse("VALIDATION_FAILED", requestId);
  }
  if (new TextEncoder().encode(body).byteLength > maximumBodyBytes) {
    return problemResponse("VALIDATION_FAILED", requestId);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body) as unknown;
  } catch {
    return problemResponse("VALIDATION_FAILED", requestId);
  }
  const parsed = outcomeSchema.safeParse(payload);
  if (!parsed.success) {
    return problemResponse("VALIDATION_FAILED", requestId);
  }

  logger.info("advertising.outcome", { outcome: parsed.data.outcome, requestId });
  return new Response(null, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Request-Id": requestId,
    },
    status: 204,
  });
}
