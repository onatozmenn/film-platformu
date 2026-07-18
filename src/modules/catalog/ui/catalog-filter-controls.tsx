"use client";

import { SlidersHorizontal } from "lucide-react";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";

import { CatalogFilterFields, type CatalogFilterFieldsProps } from "./catalog-filter-fields";

const CatalogFilterDialog = dynamic(
  () => import("./catalog-filter-dialog").then((module) => module.CatalogFilterDialog),
  { ssr: false },
);

export function CatalogFilterControls(props: CatalogFilterFieldsProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const close = () => {
    setIsOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <>
      <form className="catalog-filters catalog-filters--desktop" action="/filmler" method="get">
        <CatalogFilterFields {...props} />
      </form>

      <button
        ref={triggerRef}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="secondary-action filter-trigger"
        type="button"
        onClick={() => setIsOpen(true)}
      >
        <SlidersHorizontal aria-hidden="true" size={19} strokeWidth={2} />
        Filtreler
      </button>

      {isOpen ? (
        <CatalogFilterDialog
          {...props}
          onOpenChange={(open) => {
            if (!open) {
              close();
            }
          }}
        />
      ) : null}
    </>
  );
}
