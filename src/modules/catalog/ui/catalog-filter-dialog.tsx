"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { CatalogFilterFields, type CatalogFilterFieldsProps } from "./catalog-filter-fields";

export function CatalogFilterDialog({
  onOpenChange,
  ...fields
}: CatalogFilterFieldsProps & Readonly<{ onOpenChange: (open: boolean) => void }>) {
  return (
    <Dialog.Root open onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="filter-dialog"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <div className="dialog-heading">
            <Dialog.Title>Filmleri filtrele</Dialog.Title>
            <Dialog.Close className="icon-button" type="button" aria-label="Kapat">
              <X aria-hidden="true" size={20} strokeWidth={2} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="visually-hidden">
            Tür, yıl ve sıralama seçeneklerini değiştirin.
          </Dialog.Description>
          <form className="catalog-filters catalog-filters--sheet" action="/filmler" method="get">
            <CatalogFilterFields {...fields} />
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
