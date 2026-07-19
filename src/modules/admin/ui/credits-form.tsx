import { setMovieCreditsAction } from "../actions";
import type { AdminMovieEditorView } from "../application/admin-query-port";

export function CreditsForm({ movie }: Readonly<{ movie: AdminMovieEditorView }>) {
  const rows = [
    ...movie.credits,
    ...Array.from({ length: 3 }, (_, index) => ({
      billingOrder: movie.credits.length + index,
      characterName: null,
      displayLabel: null,
      id: `new-${String(index)}`,
      kind: "CAST" as const,
      personName: "",
    })),
  ];

  return (
    <form action={setMovieCreditsAction} className="admin-form">
      <input name="movieId" type="hidden" value={movie.id} />
      <input name="expectedRevision" type="hidden" value={movie.revision} />
      <div className="admin-repeat-list">
        {rows.map((credit, index) => (
          <fieldset className="admin-repeat-row" key={credit.id}>
            <legend>Jenerik {index + 1}</legend>
            <label>
              Kişi
              <input
                defaultValue={credit.personName}
                maxLength={160}
                name="creditName"
                type="text"
              />
            </label>
            <label>
              Görev
              <select defaultValue={credit.kind} name="creditKind">
                <option value="DIRECTOR">Yönetmen</option>
                <option value="WRITER">Senaryo</option>
                <option value="CAST">Oyuncu</option>
                <option value="OTHER">Diğer</option>
              </select>
            </label>
            <label>
              Sıra
              <input defaultValue={credit.billingOrder} min={0} name="creditOrder" type="number" />
            </label>
            <label>
              Karakter
              <input
                defaultValue={credit.characterName ?? ""}
                maxLength={160}
                name="creditCharacter"
                type="text"
              />
            </label>
            <label>
              Gösterim etiketi
              <input
                defaultValue={credit.displayLabel ?? ""}
                maxLength={80}
                name="creditLabel"
                type="text"
              />
            </label>
          </fieldset>
        ))}
      </div>
      <div className="admin-form-actions">
        <button className="secondary-action" type="submit">
          Jeneriği kaydet
        </button>
      </div>
    </form>
  );
}
