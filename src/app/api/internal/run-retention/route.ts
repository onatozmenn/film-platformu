import type { NextRequest } from "next/server";

import { accountLifecycleService } from "@/modules/identity/server";
import { getInternalJobsEnvironment } from "@/shared/config/internal-jobs-server";
import { verifyBearerCredential } from "@/shared/http/constant-time-bearer";
import { problemResponse } from "@/shared/http/problem-details";
import { createRequestId, requestIdHeader } from "@/shared/http/request-id";
import { logger } from "@/shared/observability/logger";

async function run(request: NextRequest): Promise<Response> {
  const requestId = request.headers.get(requestIdHeader) ?? createRequestId();
  const environment = getInternalJobsEnvironment();
  if (environment.kind === "disabled") {
    return problemResponse("PROVIDER_UNAVAILABLE", requestId);
  }
  if (
    request.headers.has("cookie") ||
    request.headers.has("origin") ||
    request.body !== null ||
    request.nextUrl.search.length > 0 ||
    (environment.nodeEnvironment === "production" && request.nextUrl.protocol !== "https:")
  ) {
    return problemResponse("FORBIDDEN", requestId);
  }
  if (!verifyBearerCredential(request.headers.get("authorization"), environment.cronSecret)) {
    return problemResponse("AUTHENTICATION_REQUIRED", requestId);
  }

  const startedAt = performance.now();
  try {
    const result = await accountLifecycleService.purgeDueAccounts(environment.batchLimit);
    const context = {
      durationMilliseconds: Math.round(performance.now() - startedAt),
      ...result,
      requestId,
    };
    if (result.failed > 0) {
      logger.warn("retention.partial", context);
    } else {
      logger.info("retention.completed", context);
    }
    return Response.json(result, {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": requestId,
      },
    });
  } catch {
    logger.error("retention.failed", { requestId });
    return problemResponse("INTERNAL_ERROR", requestId);
  }
}

export const GET = run;
export const POST = run;
