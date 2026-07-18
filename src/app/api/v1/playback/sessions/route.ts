import type { NextRequest } from "next/server";
import { z } from "zod";

import {
  playbackService,
  playbackSessionRateLimiter,
  territoryResolver,
} from "@/modules/playback/server";
import { getServerEnvironment } from "@/shared/config/server-environment";
import { createRequestId, requestIdHeader } from "@/shared/http/request-id";
import { problemResponse } from "@/shared/http/problem-details";

const maximumBodyBytes = 1_024;
const requestSchema = z.object({ movieId: z.uuid() }).strict();

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
  if (!playbackSessionRateLimiter.consume(rateLimitKey(request))) {
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

  let parsed: z.infer<typeof requestSchema>;
  try {
    parsed = requestSchema.parse(JSON.parse(body) as unknown);
  } catch {
    return problemResponse("VALIDATION_FAILED", requestId);
  }

  try {
    const territory = territoryResolver.resolve(request.headers);
    const result = await playbackService.createSession(parsed.movieId, territory);

    switch (result.kind) {
      case "not-available":
        return problemResponse("PLAYBACK_NOT_AVAILABLE", requestId);
      case "not-found":
        return problemResponse("NOT_FOUND", requestId);
      case "provider-unavailable":
        return problemResponse("PROVIDER_UNAVAILABLE", requestId);
      case "success":
        return Response.json(
          { data: result.session },
          {
            headers: {
              "Cache-Control": "private, no-store",
              "X-Content-Type-Options": "nosniff",
              "X-Request-Id": requestId,
            },
          },
        );
    }
  } catch {
    return problemResponse("INTERNAL_ERROR", requestId);
  }
}
