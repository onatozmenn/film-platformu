import { parsePublicEnvironment } from "@/shared/config/public-environment";

export default function Home() {
  const { siteName } = parsePublicEnvironment({
    NEXT_PUBLIC_SITE_NAME: process.env.NEXT_PUBLIC_SITE_NAME,
  });

  return (
    <>
      <a className="skip-link" href="#ana-icerik">
        Ana içeriğe geç
      </a>

      <header className="site-header">
        <div className="site-header__inner">
          <div className="brand" aria-label={siteName}>
            <span className="brand__cue" aria-hidden="true" />
            <span>{siteName}</span>
          </div>
          <span className="programme-number" aria-hidden="true">
            Program 00
          </span>
        </div>
      </header>

      <main id="ana-icerik">
        <section className="empty-programme" aria-labelledby="page-title">
          <div className="empty-programme__inner">
            <p className="eyebrow">Yeni gösterim programı</p>
            <h1 id="page-title">{siteName}</h1>
            <p className="empty-programme__lead">Seçki hazırlanıyor.</p>
            <div className="programme-line" aria-hidden="true">
              <span>Perde</span>
              <span className="programme-line__rule" />
              <span>Yakında</span>
            </div>
          </div>
        </section>

        <section className="status-band" aria-labelledby="status-heading">
          <div className="status-band__inner">
            <div>
              <p className="eyebrow">Yayın durumu</p>
              <h2 id="status-heading">Program hazırlanıyor</h2>
            </div>
            <p>Yeni filmler yayınlandığında burada yer alacak.</p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <span>{siteName}</span>
          <span>Lisanslı gösterimler</span>
        </div>
      </footer>
    </>
  );
}
