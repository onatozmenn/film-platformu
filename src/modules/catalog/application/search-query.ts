import { z } from "zod";

export type SearchQueryState =
  | Readonly<{ kind: "blank"; query: "" }>
  | Readonly<{ kind: "too-long"; query: string }>
  | Readonly<{ kind: "too-short"; query: string }>
  | Readonly<{ kind: "valid"; query: string }>;

const limitSchema = z.coerce.number().int().min(1).max(10).default(6);

export function normalizeSearchQuery(value: string | undefined): SearchQueryState {
  const query = (value ?? "").trim().replace(/\s+/gu, " ");
  const length = [...query].length;

  if (length === 0) {
    return { kind: "blank", query: "" };
  }
  if (length < 2) {
    return { kind: "too-short", query };
  }
  if (length > 80) {
    return { kind: "too-long", query };
  }

  return { kind: "valid", query };
}

export function parseSuggestionLimit(value: string | null): number | null {
  const parsed = limitSchema.safeParse(value ?? undefined);
  return parsed.success ? parsed.data : null;
}

export function createSearchHref(query: string, page: number): string {
  const params = new URLSearchParams({ q: query });
  if (page > 1) {
    params.set("sayfa", String(page));
  }
  return `/arama?${params.toString()}`;
}
