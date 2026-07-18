import type { NextRequest } from "next/server";

import { catalogQueries, normalizeSearchQuery, parseSuggestionLimit } from "@/modules/catalog";
import { createRequestId, requestIdHeader } from "@/shared/http/request-id";
import { problemResponse } from "@/shared/http/problem-details";

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = request.headers.get(requestIdHeader) ?? createRequestId();
  const queryState = normalizeSearchQuery(request.nextUrl.searchParams.get("q") ?? undefined);
  const limit = parseSuggestionLimit(request.nextUrl.searchParams.get("limit"));

  if (queryState.kind !== "valid" || limit === null) {
    return problemResponse("VALIDATION_FAILED", requestId);
  }

  const suggestions = await catalogQueries.suggestMovies(queryState.query, limit);

  return Response.json(
    { data: suggestions },
    {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=60",
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": requestId,
      },
    },
  );
}
