import { headers } from "next/headers";

import { database } from "@/shared/db/database";
import { checkDatabaseReadiness } from "@/shared/db/readiness";
import { createRequestId, requestIdHeader } from "@/shared/http/request-id";
import { logger } from "@/shared/observability/logger";

export async function GET(): Promise<Response> {
  const requestHeaders = await headers();
  const requestId = requestHeaders.get(requestIdHeader) ?? createRequestId();
  const readiness = await checkDatabaseReadiness(() => database.$queryRaw`SELECT 1`);

  if (!readiness.ready) {
    logger.warn("health.ready", { outcome: readiness.reason, requestId });
  }

  return Response.json(
    { status: readiness.ready ? "ok" : "unavailable" },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": requestId,
      },
      status: readiness.ready ? 200 : 503,
    },
  );
}
