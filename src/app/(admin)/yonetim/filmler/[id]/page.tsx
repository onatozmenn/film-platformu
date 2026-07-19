import { Eye } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { updateMovieEditorialAction } from "@/modules/admin/actions";
import { parseAdminRouteId } from "@/modules/admin/http/admin-route-id";
import { adminQueries } from "@/modules/admin/server";
import { AdminFormStatus } from "@/modules/admin/ui/admin-form-status";
import { AssetsSection } from "@/modules/admin/ui/assets-section";
import { CreditsForm } from "@/modules/admin/ui/credits-form";
import { EditorialForm } from "@/modules/admin/ui/editorial-form";
import { PublicationSection } from "@/modules/admin/ui/publication-section";
import { RightsSection } from "@/modules/admin/ui/rights-section";
import { getOptionalMemberSession } from "@/modules/identity/server";
import { formatDate } from "@/shared/i18n/formatters";

export const metadata: Metadata = { title: "Film Düzenle" };

const stateLabels = {
  DRAFT: "Taslak",
  PUBLISHED: "Yayında",
  SCHEDULED: "Zamanlandı",
  UNPUBLISHED: "Yayından kaldırıldı",
} as const;

export default async function EditMoviePage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ id: string }>;
  searchParams: Promise<{ durum?: string | string[] }>;
}>) {
  const movieId = parseAdminRouteId((await params).id);
  if (movieId === null) {
    notFound();
  }
  const session = await getOptionalMemberSession();
  if (session === null) {
    redirect("/giris");
  }
  const movie = await adminQueries.getMovie(session.user.id, movieId);
  if (movie === null) {
    notFound();
  }
  const rawStatus = (await searchParams).durum;

  return (
    <main className="admin-page admin-editor-page" id="ana-icerik">
      <header className="admin-page-heading admin-editor-heading">
        <div>
          <p className="eyebrow">Film kaydı</p>
          <h1>{movie.title}</h1>
          <p>
            Revizyon {movie.revision} · Son güncelleme {formatDate(movie.updatedAt)}
          </p>
        </div>
        <Link className="secondary-action" href={`/yonetim/filmler/${movie.id}/onizleme`}>
          <Eye aria-hidden="true" size={17} strokeWidth={2} />
          Önizle
        </Link>
      </header>
      <div className="admin-editor-summary" aria-label="Yayın özeti">
        <span className={`admin-state admin-state--${movie.publicationState.toLowerCase()}`}>
          {stateLabels[movie.publicationState]}
        </span>
        <span>Revizyon {movie.revision}</span>
        {movie.lastPublishFailure === null ? null : (
          <span>Son yayın denemesi: {movie.lastPublishFailure}</span>
        )}
      </div>
      <AdminFormStatus status={typeof rawStatus === "string" ? rawStatus : undefined} />

      <section aria-labelledby="editorial-heading" className="admin-section">
        <div className="admin-section-heading">
          <h2 id="editorial-heading">Editoryal veri ve görseller</h2>
        </div>
        <EditorialForm
          action={updateMovieEditorialAction}
          genreOptions={movie.genreOptions}
          movie={movie}
        />
      </section>
      <section aria-labelledby="credits-heading" className="admin-section">
        <div className="admin-section-heading">
          <h2 id="credits-heading">Jenerik</h2>
          <span>{movie.credits.length} kayıt</span>
        </div>
        <CreditsForm movie={movie} />
      </section>
      <section aria-labelledby="assets-heading" className="admin-section">
        <div className="admin-section-heading">
          <h2 id="assets-heading">Video ve altyazılar</h2>
          <span>{movie.videoAssets.length} varlık</span>
        </div>
        <AssetsSection movie={movie} />
      </section>
      <section aria-labelledby="rights-heading" className="admin-section">
        <div className="admin-section-heading">
          <h2 id="rights-heading">Gösterim hakları</h2>
          <span>{movie.contentRights.length} pencere</span>
        </div>
        <RightsSection movie={movie} />
      </section>
      <section
        aria-labelledby="publication-heading"
        className="admin-section admin-publication-section"
      >
        <div className="admin-section-heading">
          <h2 id="publication-heading">Yayın</h2>
          <span>Her geçiş mevcut koşulları yeniden doğrular</span>
        </div>
        <PublicationSection movie={movie} />
      </section>
    </main>
  );
}
