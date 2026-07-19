import { upsertCollectionAction } from "../actions";
import type { AdminCollectionView, AdminCollectionsView } from "../application/admin-query-port";

export function CollectionForm({
  collection,
  movieOptions,
}: Readonly<{
  collection?: AdminCollectionView;
  movieOptions: AdminCollectionsView["movieOptions"];
}>) {
  const selected = new Set(collection?.movies.map(({ movieId }) => movieId) ?? []);
  return (
    <form action={upsertCollectionAction} className="admin-form admin-collection-form">
      <input name="collectionId" type="hidden" value={collection?.id ?? ""} />
      <input name="expectedRevision" type="hidden" value={collection?.revision ?? ""} />
      <div className="admin-field-grid">
        <label>
          Seçki adı
          <input
            defaultValue={collection?.title ?? ""}
            maxLength={160}
            name="title"
            required
            type="text"
          />
        </label>
        <label>
          Seçki adresi
          <input
            defaultValue={collection?.slug ?? ""}
            maxLength={96}
            name="slug"
            required
            type="text"
          />
        </label>
        <label>
          Durum
          <select defaultValue={collection?.state ?? "DRAFT"} name="state">
            <option value="DRAFT">Taslak</option>
            <option value="PUBLISHED">Yayında</option>
          </select>
        </label>
        <label>
          Görüntüleme sırası
          <input
            defaultValue={collection?.displayOrder ?? 0}
            min={0}
            name="displayOrder"
            type="number"
          />
        </label>
      </div>
      <label className="admin-field--full">
        Açıklama
        <textarea
          defaultValue={collection?.description ?? ""}
          maxLength={2000}
          name="description"
          rows={3}
        />
      </label>
      <fieldset className="admin-fieldset">
        <legend>Filmler</legend>
        <div className="admin-check-grid admin-check-grid--movies">
          {movieOptions.map((movie) => (
            <label className="admin-check" key={movie.id}>
              <input
                defaultChecked={selected.has(movie.id)}
                name="movieIds"
                type="checkbox"
                value={movie.id}
              />
              <span>{movie.title}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <button className="secondary-action" type="submit">
        {collection === undefined ? "Seçki oluştur" : "Seçkiyi kaydet"}
      </button>
    </form>
  );
}
