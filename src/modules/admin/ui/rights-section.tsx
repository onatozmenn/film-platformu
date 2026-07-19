import { setContentRightAction } from "../actions";
import type { AdminContentRightView, AdminMovieEditorView } from "../application/admin-query-port";
import { dateTimeInputValue } from "./admin-input-format";

function RightForm({
  movieId,
  right,
}: Readonly<{ movieId: string; right?: AdminContentRightView }>) {
  return (
    <form action={setContentRightAction} className="admin-repeat-row admin-right-form">
      <input name="movieId" type="hidden" value={movieId} />
      <input name="rightId" type="hidden" value={right?.id ?? ""} />
      <label>
        Bölge
        <input
          defaultValue={right?.territory ?? "TR"}
          maxLength={2}
          name="territory"
          required
          type="text"
        />
      </label>
      <label>
        Başlangıç (UTC)
        <input
          defaultValue={dateTimeInputValue(right?.startsAt ?? null)}
          name="startsAt"
          required
          type="datetime-local"
        />
      </label>
      <label>
        Bitiş (UTC)
        <input
          defaultValue={dateTimeInputValue(right?.endsAt ?? null)}
          name="endsAt"
          required
          type="datetime-local"
        />
      </label>
      <label>
        Dahili kanıt referansı
        <input
          defaultValue={right?.evidenceReference ?? ""}
          maxLength={160}
          name="evidenceReference"
          required
          type="text"
        />
      </label>
      <label className="admin-check">
        <input
          defaultChecked={right?.allowStreaming ?? true}
          name="allowStreaming"
          type="checkbox"
        />
        <span>Gösterime izin ver</span>
      </label>
      <button className="secondary-action" type="submit">
        {right === undefined ? "Hak penceresi ekle" : "Hak penceresini güncelle"}
      </button>
    </form>
  );
}

export function RightsSection({ movie }: Readonly<{ movie: AdminMovieEditorView }>) {
  if (!movie.actor.roles.includes("ADMIN")) {
    return <p className="admin-permission-note">Gösterim hakları yönetici yetkisi gerektirir.</p>;
  }
  return (
    <div className="admin-repeat-list">
      {movie.contentRights.map((right) => (
        <RightForm key={right.id} movieId={movie.id} right={right} />
      ))}
      <RightForm movieId={movie.id} />
    </div>
  );
}
