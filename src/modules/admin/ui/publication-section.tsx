import {
  publishMovieAction,
  returnMovieToDraftAction,
  scheduleMovieAction,
  unpublishMovieAction,
} from "../actions";
import type { AdminMovieEditorView } from "../application/admin-query-port";
import { dateTimeInputValue } from "./admin-input-format";

function IdentityFields({ movie }: Readonly<{ movie: AdminMovieEditorView }>) {
  return (
    <>
      <input name="movieId" type="hidden" value={movie.id} />
      <input name="expectedRevision" type="hidden" value={movie.revision} />
    </>
  );
}

export function PublicationSection({ movie }: Readonly<{ movie: AdminMovieEditorView }>) {
  return (
    <div className="admin-publication-actions">
      {movie.publicationState === "PUBLISHED" ? (
        <form action={unpublishMovieAction} className="admin-inline-form">
          <IdentityFields movie={movie} />
          <label>
            Yayından kaldırma nedeni
            <select name="reason">
              <option value="EDITORIAL">Editoryal</option>
              <option value="RIGHTS">Haklar</option>
              <option value="ASSET">Video varlığı</option>
              <option value="LEGAL">Hukuki</option>
              <option value="OTHER">Diğer</option>
            </select>
          </label>
          <button className="danger-action" type="submit">
            Yayından kaldır
          </button>
        </form>
      ) : (
        <>
          <form action={publishMovieAction} className="admin-inline-form">
            <IdentityFields movie={movie} />
            <button className="primary-action" type="submit">
              Şimdi yayınla
            </button>
          </form>
          <form action={scheduleMovieAction} className="admin-inline-form">
            <IdentityFields movie={movie} />
            <label>
              Yayın zamanı (UTC)
              <input
                defaultValue={dateTimeInputValue(movie.publishAt)}
                name="publishAt"
                required
                type="datetime-local"
              />
            </label>
            <button className="secondary-action" type="submit">
              Zamanla
            </button>
          </form>
        </>
      )}
      {movie.publicationState === "SCHEDULED" || movie.publicationState === "UNPUBLISHED" ? (
        <form action={returnMovieToDraftAction} className="admin-inline-form">
          <IdentityFields movie={movie} />
          <button className="ghost-action" type="submit">
            Taslağa döndür
          </button>
        </form>
      ) : null}
    </div>
  );
}
