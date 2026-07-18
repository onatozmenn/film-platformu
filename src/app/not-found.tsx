import Link from "next/link";

export default function NotFound() {
  return (
    <main className="state-page">
      <div className="state-page__content">
        <p className="eyebrow">404</p>
        <h1>Bu sayfa programda yok</h1>
        <p>Aradığınız içerik bulunamadı veya artık yayında değil.</p>
        <div className="state-page__actions">
          <Link className="primary-action" href="/">
            Ana sayfaya dön
          </Link>
        </div>
      </div>
    </main>
  );
}
