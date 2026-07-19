export type MemberRole = "ADMIN" | "EDITOR" | "MEMBER";

export type MemberSession = Readonly<{
  expires: string;
  user: Readonly<{
    displayName: string;
    id: string;
    roles: readonly MemberRole[];
  }>;
}>;
