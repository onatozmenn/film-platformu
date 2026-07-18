"use client";

import { Menu, Search } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRef, useState } from "react";

import { OfflineNotice } from "./offline-notice";

const PublicDialogLayer = dynamic(
  () => import("./public-dialog-layer").then((module) => module.PublicDialogLayer),
  { ssr: false },
);

type PublicLayer = "menu" | "search";

export function PublicShell({
  children,
  siteName,
}: Readonly<{ children: React.ReactNode; siteName: string }>) {
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const [activeLayer, setActiveLayer] = useState<PublicLayer | null>(null);
  const [headerQuery, setHeaderQuery] = useState("");

  const closeLayer = () => {
    const returnTarget = activeLayer === "menu" ? menuTriggerRef : searchTriggerRef;
    setActiveLayer(null);
    window.requestAnimationFrame(() => returnTarget.current?.focus());
  };

  return (
    <>
      <a className="skip-link" href="#ana-icerik">
        Ana içeriğe geç
      </a>

      <header className="site-header">
        <div className="site-header__inner">
          <Link className="brand" href="/" aria-label={`${siteName} ana sayfa`}>
            <span className="brand__cue" aria-hidden="true" />
            <span>{siteName}</span>
          </Link>

          <nav className="public-nav desktop-nav" aria-label="Ana menü">
            <Link href="/">Ana sayfa</Link>
            <Link href="/filmler">Filmler</Link>
          </nav>

          <div className="site-header__actions">
            <button
              ref={searchTriggerRef}
              aria-expanded={activeLayer === "search"}
              aria-haspopup="dialog"
              aria-label="Ara"
              className="header-search-trigger"
              type="button"
              onClick={() => setActiveLayer("search")}
            >
              <Search aria-hidden="true" size={19} strokeWidth={2} />
              <span className="desktop-only">Ara</span>
              <span className="visually-hidden mobile-only">Ara</span>
            </button>

            <button
              ref={menuTriggerRef}
              aria-expanded={activeLayer === "menu"}
              aria-haspopup="dialog"
              aria-label="Menü"
              className="icon-button mobile-only"
              type="button"
              onClick={() => setActiveLayer("menu")}
            >
              <Menu aria-hidden="true" size={21} strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      {activeLayer === null ? null : (
        <PublicDialogLayer
          kind={activeLayer}
          query={headerQuery}
          onOpenChange={(open) => {
            if (!open) {
              closeLayer();
            }
          }}
          onQueryChange={setHeaderQuery}
        />
      )}

      <OfflineNotice />

      {children}

      <footer className="site-footer">
        <div className="site-footer__inner">
          <div>
            <strong>{siteName}</strong>
            <p>Yalnızca lisanslı gösterimler</p>
          </div>
          <nav aria-label="Alt menü">
            <Link href="/filmler">Filmler</Link>
            <Link href="/arama">Arama</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
