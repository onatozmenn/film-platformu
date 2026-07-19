import Link from "next/link";

import { parsePublicEnvironment } from "@/shared/config/public-environment";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { siteName } = parsePublicEnvironment({
    NEXT_PUBLIC_SITE_NAME: process.env.NEXT_PUBLIC_SITE_NAME,
  });

  return (
    <div className="auth-shell">
      <header className="auth-header">
        <Link className="brand" href="/" aria-label={`${siteName} ana sayfa`}>
          <span className="brand__cue" aria-hidden="true" />
          <span>{siteName}</span>
        </Link>
        <Link className="ghost-action" href="/">
          Programa dön
        </Link>
      </header>
      {children}
    </div>
  );
}
