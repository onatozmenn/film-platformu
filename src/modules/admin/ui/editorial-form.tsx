import type { AdminMovieEditorView } from "../application/admin-query-port";

type EditorialFormProps = Readonly<{
  action: (formData: FormData) => Promise<never>;
  genreOptions: readonly Readonly<{ id: string; name: string }>[];
  movie?: AdminMovieEditorView;
}>;

function ImageFields({
  image,
  label,
  prefix,
}: Readonly<{
  image: AdminMovieEditorView["poster"] | undefined;
  label: string;
  prefix: "backdrop" | "poster";
}>) {
  return (
    <fieldset className="admin-fieldset admin-image-fields">
      <legend>{label}</legend>
      <label>
        Yerel dosya yolu
        <input defaultValue={image?.src ?? ""} name={`${prefix}Src`} type="text" />
      </label>
      <label>
        Alternatif metin
        <input defaultValue={image?.alt ?? ""} maxLength={240} name={`${prefix}Alt`} type="text" />
      </label>
      <label>
        Odak noktası
        <input
          defaultValue={image?.focalPosition ?? "50% 50%"}
          name={`${prefix}FocalPosition`}
          pattern="(?:100|\d{1,2})% (?:100|\d{1,2})%"
          type="text"
        />
      </label>
      <label>
        Genişlik
        <input
          defaultValue={image?.width ?? ""}
          max={20000}
          min={1}
          name={`${prefix}Width`}
          type="number"
        />
      </label>
      <label>
        Yükseklik
        <input
          defaultValue={image?.height ?? ""}
          max={20000}
          min={1}
          name={`${prefix}Height`}
          type="number"
        />
      </label>
    </fieldset>
  );
}

export function EditorialForm({ action, genreOptions, movie }: EditorialFormProps) {
  return (
    <form action={action} className="admin-form">
      {movie === undefined ? null : (
        <>
          <input name="movieId" type="hidden" value={movie.id} />
          <input name="expectedRevision" type="hidden" value={movie.revision} />
        </>
      )}
      <div className="admin-field-grid admin-field-grid--wide">
        <label>
          Başlık
          <input
            defaultValue={movie?.title ?? ""}
            maxLength={160}
            name="title"
            required
            type="text"
          />
        </label>
        <label>
          Özgün başlık
          <input
            defaultValue={movie?.originalTitle ?? ""}
            maxLength={160}
            name="originalTitle"
            type="text"
          />
        </label>
        <label>
          Film adresi
          <input
            defaultValue={movie?.slug ?? ""}
            maxLength={96}
            name="slug"
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            required
            type="text"
          />
        </label>
        <label>
          Gösterim tarihi
          <input
            defaultValue={movie?.releaseDate.toISOString().slice(0, 10) ?? ""}
            name="releaseDate"
            required
            type="date"
          />
        </label>
        <label>
          Süre (dakika)
          <input
            defaultValue={movie?.runtimeMinutes ?? ""}
            max={1440}
            min={1}
            name="runtimeMinutes"
            required
            type="number"
          />
        </label>
        <label>
          Yaş sınıflandırması
          <input
            defaultValue={movie?.ageRating ?? ""}
            maxLength={32}
            name="ageRating"
            type="text"
          />
        </label>
      </div>
      <label className="admin-field--full">
        Özet
        <textarea
          defaultValue={movie?.synopsis ?? ""}
          maxLength={5000}
          minLength={10}
          name="synopsis"
          required
          rows={6}
        />
      </label>
      <fieldset className="admin-fieldset">
        <legend>Türler</legend>
        <div className="admin-check-grid">
          {genreOptions.map((genre) => (
            <label className="admin-check" key={genre.id}>
              <input
                defaultChecked={movie?.genreIds.includes(genre.id) ?? false}
                name="genreIds"
                type="checkbox"
                value={genre.id}
              />
              <span>{genre.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="admin-media-grid">
        <ImageFields image={movie?.poster} label="Afiş" prefix="poster" />
        <ImageFields image={movie?.backdrop} label="Fon görseli" prefix="backdrop" />
      </div>
      <div className="admin-form-actions">
        <button className="primary-action" type="submit">
          {movie === undefined ? "Taslak oluştur" : "Editoryal veriyi kaydet"}
        </button>
      </div>
    </form>
  );
}
