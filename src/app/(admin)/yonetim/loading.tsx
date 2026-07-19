export default function AdminLoading() {
  return (
    <main className="admin-page" id="ana-icerik">
      <header className="admin-page-heading">
        <div>
          <p className="eyebrow">Yönetim</p>
          <h1>Kayıtlar yükleniyor</h1>
        </div>
      </header>
      <div className="loading-rule" aria-hidden="true" />
    </main>
  );
}
