"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";

export default function PublicError({ reset }: Readonly<{ reset: () => void }>) {
  return (
    <main className="state-page" id="ana-icerik">
      <div className="state-page__content">
        <CircleAlert aria-hidden="true" className="state-page__icon" size={28} strokeWidth={2} />
        <p className="eyebrow">Katalog hatası</p>
        <h1>Program şu anda açılamıyor</h1>
        <p>Film seçkisini yüklerken bir sorun oluştu. Yeniden deneyebilirsiniz.</p>
        <div className="state-page__actions">
          <button className="primary-action" type="button" onClick={reset}>
            Yeniden dene
          </button>
          <Link className="secondary-action" href="/">
            Ana sayfaya dön
          </Link>
        </div>
      </div>
    </main>
  );
}
