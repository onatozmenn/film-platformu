import Image from "next/image";

import { formatDate } from "@/shared/i18n/formatters";

import type { ApprovedPublicDocument, ApprovedPublicImage } from "./approved-public-content";

export function PublicDocument({
  contactEmail,
  document,
  logo,
}: Readonly<{
  contactEmail: string | null;
  document: ApprovedPublicDocument;
  logo: ApprovedPublicImage | null;
}>) {
  return (
    <main className="legal-page" id="ana-icerik">
      <header className="legal-page__heading">
        {logo === null ? null : (
          <Image
            alt={logo.alt}
            className="legal-page__logo"
            height={logo.height}
            src={logo.src}
            width={logo.width}
          />
        )}
        <h1>{document.title}</h1>
        <p>{document.summary}</p>
        <span>İnceleme tarihi: {formatDate(document.reviewedAt)}</span>
      </header>
      {contactEmail === null ? null : (
        <section aria-labelledby="legal-contact-heading" className="legal-page__contact">
          <h2 id="legal-contact-heading">İletişim</h2>
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
        </section>
      )}
      <div className="legal-page__sections">
        {document.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
