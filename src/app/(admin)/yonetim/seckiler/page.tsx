import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { adminQueries } from "@/modules/admin/server";
import { AdminFormStatus } from "@/modules/admin/ui/admin-form-status";
import { CollectionForm } from "@/modules/admin/ui/collection-form";
import { getOptionalMemberSession } from "@/modules/identity/server";

export const metadata: Metadata = { title: "Seçkiler" };

export default async function CollectionsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ durum?: string | string[] }> }>) {
  const session = await getOptionalMemberSession();
  if (session === null) redirect("/giris");
  const model = await adminQueries.getCollections(session.user.id);
  if (model === null) notFound();
  const rawStatus = (await searchParams).durum;
  return (
    <main className="admin-page" id="ana-icerik">
      <header className="admin-page-heading">
        <div>
          <p className="eyebrow">Katalog düzeni</p>
          <h1>Seçkiler</h1>
          <p>Yayınlanan katalog bantlarının sırası ve film içeriği.</p>
        </div>
      </header>
      <AdminFormStatus status={typeof rawStatus === "string" ? rawStatus : undefined} />
      <section aria-labelledby="new-collection-heading" className="admin-section">
        <div className="admin-section-heading">
          <h2 id="new-collection-heading">Yeni seçki</h2>
        </div>
        <CollectionForm movieOptions={model.movieOptions} />
      </section>
      {model.collections.map((collection) => (
        <section
          aria-labelledby={`collection-${collection.id}`}
          className="admin-section"
          key={collection.id}
        >
          <div className="admin-section-heading">
            <h2 id={`collection-${collection.id}`}>{collection.title}</h2>
            <span>Revizyon {collection.revision}</span>
          </div>
          <CollectionForm collection={collection} movieOptions={model.movieOptions} />
        </section>
      ))}
    </main>
  );
}
