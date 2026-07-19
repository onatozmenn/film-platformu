import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { adminQueries } from "@/modules/admin/server";
import { getOptionalMemberSession } from "@/modules/identity/server";
import { formatDate } from "@/shared/i18n/formatters";

export const metadata: Metadata = { title: "Denetim" };

export default async function AuditPage() {
  const session = await getOptionalMemberSession();
  if (session === null) redirect("/giris");
  const model = await adminQueries.getAudit(session.user.id, 100);
  if (model === null) notFound();

  return (
    <main className="admin-page" id="ana-icerik">
      <header className="admin-page-heading">
        <div>
          <p className="eyebrow">Değişmez kayıt</p>
          <h1>Denetim</h1>
          <p>Ayrıcalıklı işlemlerin kişisel veri içermeyen operasyon gerçekleri.</p>
        </div>
      </header>
      <section aria-labelledby="audit-list-heading" className="admin-section">
        <div className="admin-section-heading">
          <h2 id="audit-list-heading">Son olaylar</h2>
          <span>En fazla 100 kayıt</span>
        </div>
        <ol className="admin-audit-list">
          {model.events.map((event) => (
            <li key={event.id}>
              <div className="admin-audit-heading">
                <strong>{event.action}</strong>
                <span>
                  {formatDate(event.createdAt)} · {event.actorType}
                </span>
              </div>
              <dl>
                <div>
                  <dt>Hedef</dt>
                  <dd>
                    {event.targetType} · {event.targetId}
                  </dd>
                </div>
                <div>
                  <dt>İstek</dt>
                  <dd>{event.requestId}</dd>
                </div>
                {event.metadata.map((entry) => (
                  <div key={entry.key}>
                    <dt>{entry.key}</dt>
                    <dd>{entry.value}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
