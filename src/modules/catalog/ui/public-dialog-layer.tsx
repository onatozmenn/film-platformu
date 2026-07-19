"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

type PublicDialogLayerProps = Readonly<{
  accountHref: string;
  accountLabel: string;
  kind: "menu" | "search";
  onOpenChange: (open: boolean) => void;
  onQueryChange: (query: string) => void;
  query: string;
}>;

function CloseButton() {
  return (
    <Dialog.Close className="icon-button dialog-close" type="button" aria-label="Kapat">
      <X aria-hidden="true" size={20} strokeWidth={2} />
    </Dialog.Close>
  );
}

export function PublicDialogLayer({
  accountHref,
  accountLabel,
  kind,
  onOpenChange,
  onQueryChange,
  query,
}: PublicDialogLayerProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog.Root open onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        {kind === "search" ? (
          <Dialog.Content
            className="search-dialog"
            onCloseAutoFocus={(event) => event.preventDefault()}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              searchInputRef.current?.focus();
            }}
          >
            <div className="dialog-heading">
              <Dialog.Title>Film ara</Dialog.Title>
              <CloseButton />
            </div>
            <Dialog.Description className="visually-hidden">
              Film adına göre katalogda arama yapın.
            </Dialog.Description>
            <form className="search-form" action="/arama" method="get">
              <label htmlFor="site-search">Film adı</label>
              <div className="search-form__row">
                <input
                  ref={searchInputRef}
                  id="site-search"
                  name="q"
                  type="search"
                  autoComplete="off"
                  maxLength={80}
                  placeholder="Örnek: Kıyıdaki Sessizlik"
                  value={query}
                  onChange={(event) => onQueryChange(event.currentTarget.value)}
                />
                <button className="primary-action" type="submit">
                  Ara
                </button>
              </div>
            </form>
          </Dialog.Content>
        ) : (
          <Dialog.Content
            className="menu-dialog"
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <div className="dialog-heading">
              <Dialog.Title>Menü</Dialog.Title>
              <CloseButton />
            </div>
            <Dialog.Description className="visually-hidden">
              Film Platform sayfaları
            </Dialog.Description>
            <nav aria-label="Mobil menü">
              <Link href="/" onClick={() => onOpenChange(false)}>
                Ana sayfa
              </Link>
              <Link href="/filmler" onClick={() => onOpenChange(false)}>
                Filmler
              </Link>
              <Link href="/arama" onClick={() => onOpenChange(false)}>
                Arama
              </Link>
              <Link href={accountHref} onClick={() => onOpenChange(false)}>
                {accountLabel}
              </Link>
            </nav>
          </Dialog.Content>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  );
}
