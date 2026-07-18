const skeletons = Array.from({ length: 12 }, (_, index) => index);

export default function CatalogLoading() {
  return (
    <main className="catalog-page" id="ana-icerik" aria-busy="true" aria-live="polite">
      <div className="catalog-page__inner">
        <p className="eyebrow">Filmler yükleniyor</p>
        <div className="catalog-grid catalog-grid--loading" aria-hidden="true">
          {skeletons.map((skeleton) => (
            <span key={skeleton} />
          ))}
        </div>
      </div>
    </main>
  );
}
