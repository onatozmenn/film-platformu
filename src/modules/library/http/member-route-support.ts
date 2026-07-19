import type { NextRequest } from "next/server";
import { z } from "zod";

import {
  authorizeMemberRequest,
  type AuthorizedMemberRequest,
} from "@/modules/identity/http/authorize-member-request";
import type { LibraryMutationResult } from "@/modules/library/application/create-library-service";
import { privateNoContent } from "@/shared/http/private-response";
import { problemResponse } from "@/shared/http/problem-details";

export { authorizeMemberRequest };

export type MemberMovieRouteContext = Readonly<{
  params: Promise<{ movieId: string }>;
}>;

type AuthorizedMemberMovieRequest = AuthorizedMemberRequest & Readonly<{ movieId: string }>;

export async function authorizeMemberMovieRequest(
  request: NextRequest,
  context: MemberMovieRouteContext,
): Promise<AuthorizedMemberMovieRequest | Response> {
  const authorized = await authorizeMemberRequest(request);
  if (authorized instanceof Response) {
    return authorized;
  }
  const parsedMovieId = z.uuid().safeParse((await context.params).movieId);
  if (!parsedMovieId.success) {
    return problemResponse("VALIDATION_FAILED", authorized.requestId);
  }
  return { ...authorized, movieId: parsedMovieId.data };
}

export async function readBoundedJson<Output>(
  request: NextRequest,
  schema: z.ZodType<Output>,
  maximumBodyBytes: number = 512,
): Promise<Output | null> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return null;
  }
  let body: string;
  try {
    body = await request.text();
  } catch {
    return null;
  }
  if (new TextEncoder().encode(body).byteLength > maximumBodyBytes) {
    return null;
  }
  try {
    const parsed = schema.safeParse(JSON.parse(body) as unknown);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function libraryMutationResponse(
  result: LibraryMutationResult,
  requestId: string,
): Response {
  switch (result.kind) {
    case "success":
    case "stale":
      return privateNoContent(requestId);
    case "conflict":
      return problemResponse("CONFLICT", requestId);
    case "forbidden":
      return problemResponse("FORBIDDEN", requestId);
    case "invalid":
      return problemResponse("VALIDATION_FAILED", requestId);
    case "not-found":
      return problemResponse("NOT_FOUND", requestId);
  }
}
