import type { DefaultSession } from "next-auth";

import type { MemberRole } from "@/modules/identity/application/member-session";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      roles: MemberRole[];
    };
  }
}
