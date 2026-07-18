export default function MovieLoading() {
  return (
    <main className="detail-loading" id="ana-icerik" aria-busy="true" aria-live="polite">
      <div className="detail-loading__header">
        <span>Film bilgileri yükleniyor</span>
      </div>
      <div className="detail-loading__body" aria-hidden="true">
        <span />
        <span />
      </div>
    </main>
  );
}
