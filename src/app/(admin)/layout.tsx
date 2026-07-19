import {
  Clapperboard,
  ExternalLink,
  Library,
  ScrollText,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { adminQueries } from "@/modules/admin/server";
import { getOptionalMemberSession } from "@/modules/identity/server";
import { parsePublicEnvironment } from "@/shared/config/public-environment";

export const dynamic = "force-dynamic";

const primaryLinks = [
  { href: "/yonetim", icon: Clapperboard, label: "Filmler" },
  { href: "/yonetim/seckiler", icon: Library, label: "Seçkiler" },
] as const;

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getOptionalMemberSession();
  if (session === null) {
    redirect("/giris");
  }
  const workspace = await adminQueries.getWorkspace(session.user.id);
  if (workspace === null) {
    notFound();
  }
  const { siteName } = parsePublicEnvironment({
    NEXT_PUBLIC_SITE_NAME: process.env.NEXT_PUBLIC_SITE_NAME,
  });
  const isAdmin = workspace.actor.roles.includes("ADMIN");

  const navigation = (
    <nav aria-label="Yönetim menüsü" className="admin-nav">
      {primaryLinks.map(({ href, icon: Icon, label }) => (
        <Link href={href} key={href}>
          <Icon aria-hidden="true" size={17} strokeWidth={2} />
          <span>{label}</span>
        </Link>
      ))}
      {isAdmin ? (
        <>
          <Link href="/yonetim/roller">
            <ShieldCheck aria-hidden="true" size={17} strokeWidth={2} />
            <span>Roller</span>
          </Link>
          <Link href="/yonetim/denetim">
            <ScrollText aria-hidden="true" size={17} strokeWidth={2} />
            <span>Denetim</span>
          </Link>
        </>
      ) : null}
      <Link href="/">
        <ExternalLink aria-hidden="true" size={17} strokeWidth={2} />
        <span>Yayındaki site</span>
      </Link>
    </nav>
  );

  return (
    <div className="admin-shell">
      <a className="skip-link" href="#ana-icerik">
        Ana içeriğe geç
      </a>
      <aside className="admin-sidebar">
        <Link aria-label={`${siteName} yönetim ana sayfa`} className="admin-brand" href="/yonetim">
          <span className="brand__cue" aria-hidden="true" />
          <span>
            <strong>{siteName}</strong>
            <small>Yönetim</small>
          </span>
        </Link>
        {navigation}
        <Link className="admin-actor" href="/hesap">
          <UserRound aria-hidden="true" size={18} strokeWidth={2} />
          <span>
            <strong>{workspace.actor.displayName}</strong>
            <small>{isAdmin ? "Yönetici" : "Editör"}</small>
          </span>
        </Link>
      </aside>
      <div className="admin-main-column">
        <header className="admin-mobile-header">
          <Link className="admin-brand" href="/yonetim">
            <span className="brand__cue" aria-hidden="true" />
            <strong>{siteName}</strong>
          </Link>
          <details className="admin-mobile-menu">
            <summary>Menü</summary>
            {navigation}
          </details>
        </header>
        {children}
      </div>
    </div>
  );
}
