import type { CatalogFilterOption, CatalogFilters } from "../application/catalog-query-port";

const sortOptions = [
  { label: "Editörün seçimi", value: "editor-secimi" },
  { label: "En yeni", value: "yeni" },
  { label: "En çok izlenen", value: "populer" },
  { label: "En yüksek puan", value: "puan" },
] as const;

export type CatalogFilterFieldsProps = Readonly<{
  availableGenres: readonly CatalogFilterOption[];
  availableYears: readonly number[];
  filters: CatalogFilters;
}>;

export function CatalogFilterFields({
  availableGenres,
  availableYears,
  filters,
}: CatalogFilterFieldsProps) {
  return (
    <>
      <label>
        <span>Tür</span>
        <select name="tur" defaultValue={filters.genre ?? ""}>
          <option value="">Tüm türler</option>
          {availableGenres.map((genre) => (
            <option key={genre.slug} value={genre.slug}>
              {genre.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Yıl</span>
        <select name="yil" defaultValue={filters.year ?? ""}>
          <option value="">Tüm yıllar</option>
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Sıralama</span>
        <select name="siralama" defaultValue={filters.sort}>
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button className="secondary-action" type="submit">
        Uygula
      </button>
    </>
  );
}
