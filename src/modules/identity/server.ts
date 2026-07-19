import "server-only";

import NextAuth, { type NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth/next";
import type { NextRequest } from "next/server";

import { getServerEnvironment } from "@/shared/config/server-environment";
import { database } from "@/shared/db/database";
import { createFixedWindowRateLimiter } from "@/shared/http/fixed-window-rate-limiter";
import { problemResponse } from "@/shared/http/problem-details";
import { createRequestId, requestIdHeader } from "@/shared/http/request-id";
import { logger } from "@/shared/observability/logger";

import { createAccountLifecycleService } from "./application/create-account-lifecycle-service";
import type { MemberSession } from "./application/member-session";
import { emailLinkRateLimitKey, isEmailLinkRequest } from "./http/email-link-request-rate-limit";
import { createAuthOptions } from "./infrastructure/auth-options";
import { createFakeEmailLinkDelivery } from "./infrastructure/fake-email-link-delivery";
import {
  parseIdentityEnvironment,
  type IdentityEnvironment,
} from "./infrastructure/identity-environment";
import { createPrismaAccountLifecycleRepository } from "./infrastructure/prisma-account-lifecycle-repository";
import { createPrismaMemberAuthorization } from "./infrastructure/prisma-member-authorization";
import { createSmtpEmailLinkDelivery } from "./infrastructure/smtp-email-link-delivery";

type AuthRouteContext = Readonly<{ params: Promise<{ nextauth: string[] }> }>;

const environment = parseIdentityEnvironment({
  AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM,
  AUTH_EMAIL_PROVIDER: process.env.AUTH_EMAIL_PROVIDER,
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_SMTP_URL: process.env.AUTH_SMTP_URL,
  NODE_ENV: process.env.NODE_ENV,
});
const siteOrigin = getServerEnvironment().siteOrigin;

const fakeEmail =
  environment.provider.kind === "fake" ? createFakeEmailLinkDelivery({ siteOrigin }) : null;
const emailLinkRequestRateLimiter = createFixedWindowRateLimiter(
  environment.nodeEnvironment === "production" ? 5 : 200,
  60_000,
);

function createEnabledOptions(
  enabledEnvironment: IdentityEnvironment &
    Readonly<{
      provider: Exclude<IdentityEnvironment["provider"], { kind: "disabled" }>;
    }>,
): NextAuthOptions {
  const emailDelivery =
    enabledEnvironment.provider.kind === "fake"
      ? fakeEmail?.delivery
      : createSmtpEmailLinkDelivery({
          from: enabledEnvironment.provider.from,
          server: enabledEnvironment.provider.server,
          siteOrigin,
        });
  if (emailDelivery === null || emailDelivery === undefined) {
    throw new Error("Identity email delivery is unavailable");
  }
  return createAuthOptions({ client: database, emailDelivery, environment: enabledEnvironment });
}

export const authOptions =
  environment.provider.kind === "disabled"
    ? null
    : createEnabledOptions({ ...environment, provider: environment.provider });

export const memberAuthorization = createPrismaMemberAuthorization(database);
export const accountLifecycleService = createAccountLifecycleService(
  createPrismaAccountLifecycleRepository(database),
  () => new Date(),
);

export function consumeFakeEmailLink(identifier: string): string | null {
  return environment.provider.kind === "fake" ? (fakeEmail?.consume(identifier) ?? null) : null;
}

export function isFakeEmailHarnessEnabled(): boolean {
  return environment.nodeEnvironment !== "production" && environment.provider.kind === "fake";
}

export async function handleAuthRequest(
  request: NextRequest,
  context: AuthRouteContext,
): Promise<Response> {
  const requestId = request.headers.get(requestIdHeader) ?? createRequestId();
  const parameters = await context.params;
  if (authOptions === null) {
    return problemResponse("PROVIDER_UNAVAILABLE", requestId);
  }
  if (
    isEmailLinkRequest(request.method, parameters.nextauth) &&
    !emailLinkRequestRateLimiter.consume(
      emailLinkRateLimitKey(request.headers, process.env.VERCEL === "1"),
    )
  ) {
    return problemResponse("RATE_LIMITED", requestId);
  }

  const result: unknown = await NextAuth(request, { params: parameters }, authOptions);
  if (!(result instanceof Response)) {
    return problemResponse("INTERNAL_ERROR", requestId);
  }
  const headers = new Headers(result.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Request-Id", requestId);
  return new Response(result.body, {
    headers,
    status: result.status,
    statusText: result.statusText,
  });
}

export async function getOptionalMemberSession(): Promise<MemberSession | null> {
  if (authOptions === null) {
    return null;
  }
  try {
    const session = await getServerSession(authOptions);
    if (session === null) {
      return null;
    }
    const profile = await database.userProfile.findUnique({
      where: { userId: session.user.id },
      select: { deletedAt: true, disabledAt: true, displayName: true },
    });
    if (profile === null || profile.deletedAt !== null || profile.disabledAt !== null) {
      return null;
    }
    return {
      expires: session.expires,
      user: {
        displayName: profile.displayName,
        id: session.user.id,
        roles: session.user.roles,
      },
    };
  } catch {
    logger.warn("identity.session_failed", { outcome: "anonymous" });
    return null;
  }
}
