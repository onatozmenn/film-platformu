import { headers } from "next/headers";

import { createRequestId, requestIdHeader } from "@/shared/http/request-id";

export async function GET(): Promise<Response> {
  const requestHeaders = await headers();
  const requestId = requestHeaders.get(requestIdHeader) ?? createRequestId();

  return Response.json(
    { status: "ok" },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": requestId,
      },
    },
  );
}
