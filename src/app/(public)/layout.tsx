import { PublicShell } from "@/modules/catalog";
import { parsePublicEnvironment } from "@/shared/config/public-environment";

export default function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { siteName } = parsePublicEnvironment({
    NEXT_PUBLIC_SITE_NAME: process.env.NEXT_PUBLIC_SITE_NAME,
  });

  return <PublicShell siteName={siteName}>{children}</PublicShell>;
}
