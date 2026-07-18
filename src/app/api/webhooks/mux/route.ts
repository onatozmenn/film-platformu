import type { NextRequest } from "next/server";

import { videoWebhookService } from "@/modules/playback/server";
import { createRequestId, requestIdHeader } from "@/shared/http/request-id";
import { problemResponse } from "@/shared/http/problem-details";

const maximumBodyBytes = 256 * 1_024;

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = request.headers.get(requestIdHeader) ?? createRequestId();
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return problemResponse("VALIDATION_FAILED", requestId);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return problemResponse("VALIDATION_FAILED", requestId);
  }
  if (new TextEncoder().encode(rawBody).byteLength > maximumBodyBytes) {
    return problemResponse("VALIDATION_FAILED", requestId);
  }

  try {
    const result = await videoWebhookService.process(rawBody, request.headers);
    if (result === "invalid") {
      return problemResponse("VALIDATION_FAILED", requestId);
    }
    return Response.json(
      { received: true },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "X-Request-Id": requestId,
        },
        status: result === "asset-not-found" ? 202 : 200,
      },
    );
  } catch {
    return problemResponse("INTERNAL_ERROR", requestId);
  }
}
