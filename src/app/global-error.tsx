"use client";

import Link from "next/link";

export default function GlobalError({ reset }: Readonly<{ reset: () => void }>) {
  return (
    <html lang="tr">
      <body>
        <main className="state-page">
          <div className="state-page__content">
            <p className="eyebrow">Beklenmeyen hata</p>
            <h1>Gösterim kesintiye uğradı</h1>
            <p>Sayfa şu anda açılamıyor. Yeniden deneyebilirsiniz.</p>
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
      </body>
    </html>
  );
}
