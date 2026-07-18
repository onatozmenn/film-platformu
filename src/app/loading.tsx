export default function Loading() {
  return (
    <main className="state-page" aria-busy="true" aria-live="polite">
      <div className="state-page__content">
        <p className="eyebrow">Program yükleniyor</p>
        <h1>Perde hazırlanıyor</h1>
        <div className="loading-rule" aria-hidden="true" />
      </div>
    </main>
  );
}
