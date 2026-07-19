import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { createMovieDraftAction, importMovieDraftAction } from "@/modules/admin/actions";
import { adminQueries } from "@/modules/admin/server";
import { AdminFormStatus } from "@/modules/admin/ui/admin-form-status";
import { EditorialForm } from "@/modules/admin/ui/editorial-form";
import { getOptionalMemberSession } from "@/modules/identity/server";

export const metadata: Metadata = { title: "Yeni Taslak" };

export default async function NewMoviePage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ durum?: string | string[] }> }>) {
  const session = await getOptionalMemberSession();
  if (session === null) {
    redirect("/giris");
  }
  const model = await adminQueries.getCreateMovie(session.user.id);
  if (model === null) {
    notFound();
  }
  const rawStatus = (await searchParams).durum;
  return (
    <main className="admin-page" id="ana-icerik">
      <header className="admin-page-heading">
        <div>
          <p className="eyebrow">Film kaydı</p>
          <h1>Yeni taslak</h1>
          <p>Film, yayın politikasından bağımsız bir taslak olarak oluşturulur.</p>
        </div>
      </header>
      <AdminFormStatus status={typeof rawStatus === "string" ? rawStatus : undefined} />
      <section aria-labelledby="metadata-import-heading" className="admin-section">
        <div className="admin-section-heading">
          <h2 id="metadata-import-heading">TMDB metadata içe aktarımı</h2>
          <span>Görseller lisans doğrulamasına kadar eklenmez</span>
        </div>
        <form action={importMovieDraftAction} className="admin-inline-form">
          <label>
            TMDB film kimliği
            <input
              inputMode="numeric"
              maxLength={12}
              name="externalId"
              pattern="\d{1,12}"
              required
              type="text"
            />
          </label>
          <button className="secondary-action" type="submit">
            Metadata içe aktar
          </button>
        </form>
      </section>
      <section aria-labelledby="new-editorial-heading" className="admin-section">
        <div className="admin-section-heading">
          <h2 id="new-editorial-heading">Editoryal veri</h2>
        </div>
        <EditorialForm action={createMovieDraftAction} genreOptions={model.genreOptions} />
      </section>
    </main>
  );
}
