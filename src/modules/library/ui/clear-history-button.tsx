"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ClearHistoryButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");

  const clearHistory = async () => {
    if (pending) {
      return;
    }
    setPending(true);
    setStatus("");
    try {
      const response = await fetch("/api/v1/me/progress", { method: "DELETE" });
      if (!response.ok) {
        setStatus("İzleme geçmişi temizlenemedi.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setStatus("İzleme geçmişi temizlenemedi.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          setOpen(next);
          setStatus("");
        }
      }}
    >
      <Dialog.Trigger asChild>
        <button className="danger-action" type="button">
          <Trash2 aria-hidden="true" size={17} strokeWidth={2} />
          Geçmişi temizle
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="confirmation-dialog">
          <div className="dialog-heading">
            <Dialog.Title>İzleme geçmişini temizle</Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label="Pencereyi kapat" className="icon-button" type="button">
                <X aria-hidden="true" size={19} strokeWidth={2} />
              </button>
            </Dialog.Close>
          </div>
          <div className="confirmation-dialog__body">
            <Dialog.Description>
              Kaldığınız yer bilgileri kalıcı olarak silinir. Bu işlem geri alınamaz.
            </Dialog.Description>
            <p className="confirmation-dialog__status" role="status">
              {status}
            </p>
            <div className="confirmation-dialog__actions">
              <Dialog.Close asChild>
                <button className="secondary-action" disabled={pending} type="button">
                  Vazgeç
                </button>
              </Dialog.Close>
              <button
                className="danger-action danger-action--filled"
                disabled={pending}
                type="button"
                onClick={() => void clearHistory()}
              >
                <Trash2 aria-hidden="true" size={17} strokeWidth={2} />
                {pending ? "Temizleniyor" : "Geçmişi temizle"}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
