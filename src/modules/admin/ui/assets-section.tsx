import {
  attachVideoAssetAction,
  reconcileVideoAssetAction,
  setSubtitleTracksAction,
} from "../actions";
import type { AdminMovieEditorView, AdminVideoAssetView } from "../application/admin-query-port";

function SubtitleForm({
  asset,
  movieId,
}: Readonly<{ asset: AdminVideoAssetView; movieId: string }>) {
  const rows = [
    ...asset.subtitleTracks,
    ...Array.from({ length: 2 }, (_, index) => ({
      id: `new-${String(index)}`,
      isDefault: false,
      kind: "SUBTITLES" as const,
      label: "",
      languageTag: "",
      providerTrackId: "",
    })),
  ];
  return (
    <form action={setSubtitleTracksAction} className="admin-subform">
      <input name="assetId" type="hidden" value={asset.id} />
      <input name="movieId" type="hidden" value={movieId} />
      <div className="admin-repeat-list">
        {rows.map((track, index) => (
          <fieldset className="admin-repeat-row admin-repeat-row--compact" key={track.id}>
            <legend>Altyazı {index + 1}</legend>
            <label>
              Dil etiketi
              <input defaultValue={track.languageTag} name="subtitleLanguage" type="text" />
            </label>
            <label>
              Etiket
              <input defaultValue={track.label} name="subtitleLabel" type="text" />
            </label>
            <label>
              Tür
              <select defaultValue={track.kind} name="subtitleKind">
                <option value="SUBTITLES">Altyazı</option>
                <option value="CAPTIONS">İşitme engelli altyazısı</option>
                <option value="FORCED">Zorunlu çeviri</option>
              </select>
            </label>
            <label>
              Sağlayıcı kimliği
              <input defaultValue={track.providerTrackId} name="subtitleProviderId" type="text" />
            </label>
            <label>
              Varsayılan
              <select defaultValue={String(track.isDefault)} name="subtitleDefault">
                <option value="false">Hayır</option>
                <option value="true">Evet</option>
              </select>
            </label>
          </fieldset>
        ))}
      </div>
      <button className="ghost-action" type="submit">
        Altyazıları kaydet
      </button>
    </form>
  );
}

export function AssetsSection({ movie }: Readonly<{ movie: AdminMovieEditorView }>) {
  const canManageAssets = movie.actor.roles.includes("ADMIN");
  return (
    <div className="admin-stack">
      {canManageAssets ? (
        <form action={attachVideoAssetAction} className="admin-inline-form">
          <input name="movieId" type="hidden" value={movie.id} />
          <label>
            Mux varlık kimliği
            <input maxLength={120} name="providerAssetId" required type="text" />
          </label>
          <label className="admin-check">
            <input name="makeActive" type="checkbox" />
            <span>Hazırsa etkinleştir</span>
          </label>
          <button className="secondary-action" type="submit">
            Varlığı ekle
          </button>
        </form>
      ) : (
        <p className="admin-permission-note">
          Video varlığı işlemleri yönetici yetkisi gerektirir.
        </p>
      )}
      <div className="admin-record-list">
        {movie.videoAssets.length === 0 ? (
          <p className="admin-empty">Video varlığı bulunmuyor.</p>
        ) : (
          movie.videoAssets.map((asset) => (
            <article className="admin-record" key={asset.id}>
              <div className="admin-record__heading">
                <div>
                  <strong>{asset.providerAssetId}</strong>
                  <span>
                    {asset.state}
                    {asset.isActive ? " · Etkin" : ""}
                  </span>
                </div>
                {canManageAssets ? (
                  <form action={reconcileVideoAssetAction}>
                    <input name="movieId" type="hidden" value={movie.id} />
                    <input name="providerAssetId" type="hidden" value={asset.providerAssetId} />
                    <button className="ghost-action" type="submit">
                      Durumu yenile
                    </button>
                  </form>
                ) : null}
              </div>
              <SubtitleForm asset={asset} movieId={movie.id} />
            </article>
          ))
        )}
      </div>
    </div>
  );
}
