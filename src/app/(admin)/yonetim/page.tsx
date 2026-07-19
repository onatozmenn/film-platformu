import { ArrowRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminFormStatus } from "@/modules/admin/ui/admin-form-status";
import { adminQueries } from "@/modules/admin/server";
import { getOptionalMemberSession } from "@/modules/identity/server";
import { formatDate } from "@/shared/i18n/formatters";

export const metadata: Metadata = { title: "Yönetim" };

const stateLabels = {
  DRAFT: "Taslak",
  PUBLISHED: "Yayında",
  SCHEDULED: "Zamanlandı",
  UNPUBLISHED: "Yayından kaldırıldı",
} as const;

const stateSummary = ["DRAFT", "SCHEDULED", "PUBLISHED", "UNPUBLISHED"] as const;

export default async function AdminDashboard({
  searchParams,
}: Readonly<{ searchParams: Promise<{ durum?: string | string[] }> }>) {
  const session = await getOptionalMemberSession();
  if (session === null) {
    redirect("/giris");
  }
  const workspace = await adminQueries.getWorkspace(session.user.id);
  if (workspace === null) {
    notFound();
  }
  const rawStatus = (await searchParams).durum;
  const status = typeof rawStatus === "string" ? rawStatus : undefined;

  return (
    <main className="admin-page" id="ana-icerik">
      <header className="admin-page-heading">
        <div>
          <p className="eyebrow">Yayın masası</p>
          <h1>Filmler</h1>
          <p>Taslak, zamanlama ve yayın durumlarının operasyon kuyruğu.</p>
        </div>
        <Link className="primary-action" href="/yonetim/filmler/yeni">
          <Plus aria-hidden="true" size={17} strokeWidth={2} />
          Yeni taslak
        </Link>
      </header>
      <AdminFormStatus status={status} />
      <section aria-label="Yayın durumu özeti" className="admin-metrics">
        {stateSummary.map((state) => (
          <div key={state}>
            <span>{stateLabels[state]}</span>
            <strong>{workspace.totals[state]}</strong>
          </div>
        ))}
      </section>
      <section aria-labelledby="admin-film-list" className="admin-section">
        <div className="admin-section-heading">
          <h2 id="admin-film-list">Film kayıtları</h2>
          <span>{workspace.movies.length} kayıt</span>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Film</th>
                <th>Durum</th>
                <th>Revizyon</th>
                <th>Güncelleme</th>
                <th>
                  <span className="sr-only">Aç</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {workspace.movies.map((movie) => (
                <tr key={movie.id}>
                  <td>
                    <strong>{movie.title}</strong>
                    <span>{movie.slug}</span>
                  </td>
                  <td>
                    <span
                      className={`admin-state admin-state--${movie.publicationState.toLowerCase()}`}
                    >
                      {stateLabels[movie.publicationState]}
                    </span>
                    {movie.lastPublishFailure === null ? null : <small>Son deneme başarısız</small>}
                  </td>
                  <td>{movie.revision}</td>
                  <td>{formatDate(movie.updatedAt)}</td>
                  <td>
                    <Link
                      aria-label={`${movie.title} kaydını aç`}
                      className="icon-button"
                      href={`/yonetim/filmler/${movie.id}`}
                    >
                      <ArrowRight aria-hidden="true" size={18} strokeWidth={2} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
