"use client";

import { CircleAlert } from "lucide-react";

export default function AdminError({ reset }: Readonly<{ reset: () => void }>) {
  return (
    <main className="admin-page" id="ana-icerik">
      <div className="admin-error">
        <CircleAlert aria-hidden="true" size={24} strokeWidth={2} />
        <p className="eyebrow">Yönetim hatası</p>
        <h1>Operasyon görünümü açılamadı</h1>
        <p>Kayıtlar yüklenirken bir sorun oluştu.</p>
        <button className="secondary-action" onClick={reset} type="button">
          Yeniden dene
        </button>
      </div>
    </main>
  );
}
