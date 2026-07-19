import type { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";

import type { PrismaClient } from "@/generated/prisma/client";

import type { EmailLinkDeliveryPort } from "../application/email-link-port";
import type { MemberRole } from "../application/member-session";
import type { IdentityEnvironment } from "./identity-environment";
import { createIdentityAdapter } from "./prisma-identity-adapter";

type EnabledIdentityEnvironment = IdentityEnvironment &
  Readonly<{
    provider: Exclude<IdentityEnvironment["provider"], { kind: "disabled" }>;
  }>;

async function accountCanSignIn(client: PrismaClient, email: string): Promise<boolean> {
  const user = await client.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { profile: { select: { deletedAt: true, disabledAt: true } } },
  });
  return (
    user === null ||
    (user.profile !== null && user.profile.deletedAt === null && user.profile.disabledAt === null)
  );
}

export function createAuthOptions(
  input: Readonly<{
    client: PrismaClient;
    emailDelivery: EmailLinkDeliveryPort;
    environment: EnabledIdentityEnvironment;
  }>,
): NextAuthOptions {
  const provider = input.environment.provider;

  return {
    adapter: createIdentityAdapter(input.client),
    callbacks: {
      async session({ session, user }) {
        const identity = await input.client.user.findUnique({
          where: { id: user.id },
          select: {
            profile: { select: { deletedAt: true, disabledAt: true, displayName: true } },
            roles: { orderBy: { role: "asc" }, select: { role: true } },
          },
        });
        const profile = identity?.profile;
        const roles = identity?.roles ?? [];
        const active =
          profile !== null &&
          profile !== undefined &&
          profile.deletedAt === null &&
          profile.disabledAt === null;

        return {
          ...session,
          user: {
            email: session.user?.email ?? user.email,
            id: user.id,
            image: session.user?.image ?? user.image ?? null,
            name: active ? profile.displayName : null,
            roles: active ? roles.map(({ role }) => role satisfies MemberRole) : [],
          },
        };
      },
      async signIn({ email, user }) {
        if (email?.verificationRequest === true) {
          return true;
        }
        return user.email === null || user.email === undefined
          ? false
          : accountCanSignIn(input.client, user.email);
      },
    },
    pages: {
      error: "/giris/hata",
      signIn: "/giris",
      verifyRequest: "/giris/baglanti-gonderildi",
    },
    providers: [
      EmailProvider({
        from: provider.from,
        maxAge: 10 * 60,
        normalizeIdentifier: (identifier) => identifier.trim().toLowerCase(),
        sendVerificationRequest: async ({ expires, identifier, url }) => {
          if (await accountCanSignIn(input.client, identifier)) {
            await input.emailDelivery.send({ expires, identifier, url });
          }
        },
        server: provider.kind === "smtp" ? provider.server : "smtp://127.0.0.1:25",
      }),
    ],
    secret: provider.secret,
    session: {
      maxAge: 30 * 24 * 60 * 60,
      strategy: "database",
      updateAge: 24 * 60 * 60,
    },
    theme: {
      brandColor: "#00e054",
      colorScheme: "dark",
    },
    useSecureCookies: input.environment.nodeEnvironment === "production",
  };
}
