const combiningMarks = /[\u0300-\u036f]/gu;
const nonAsciiAlphanumeric = /[^a-z0-9]+/gu;

export function normalizeCatalogSearchText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .normalize("NFKD")
    .replace(combiningMarks, "")
    .replace(/\s+/gu, " ");
}

export function createMovieSlug(title: string): string {
  return normalizeCatalogSearchText(title)
    .replace(nonAsciiAlphanumeric, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 96)
    .replace(/-+$/gu, "");
}
