import { PublicShell } from "@/modules/catalog";
import { getOptionalMemberSession } from "@/modules/identity/server";
import { parsePublicEnvironment } from "@/shared/config/public-environment";

export default async function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { siteName } = parsePublicEnvironment({
    NEXT_PUBLIC_SITE_NAME: process.env.NEXT_PUBLIC_SITE_NAME,
  });
  const session = await getOptionalMemberSession();

  return (
    <PublicShell
      accountHref={session === null ? "/giris" : "/hesap"}
      accountLabel={session === null ? "Oturum aç" : session.user.displayName}
      siteName={siteName}
    >
      {children}
    </PublicShell>
  );
}
