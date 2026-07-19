import type { NextRequest } from "next/server";

import { handleAuthRequest } from "@/modules/identity/server";

type AuthRouteContext = Readonly<{ params: Promise<{ nextauth: string[] }> }>;

export function GET(request: NextRequest, context: AuthRouteContext): Promise<Response> {
  return handleAuthRequest(request, context);
}

export function POST(request: NextRequest, context: AuthRouteContext): Promise<Response> {
  return handleAuthRequest(request, context);
}
