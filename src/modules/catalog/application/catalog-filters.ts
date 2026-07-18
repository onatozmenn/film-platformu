import { z } from "zod";

import { parsePageNumber } from "@/shared/pagination/page";

import type { CatalogFilters, CatalogSort } from "./catalog-query-port";

export type CatalogSearchParams = Readonly<Record<string, string | string[] | undefined>>;

const sortSchema = z.enum(["editor-secimi", "populer", "puan", "yeni"]).default("editor-secimi");
const genreSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/u);
const yearSchema = z.coerce.number().int().min(1900).max(2100);

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function optionalValue<T>(value: string | undefined, schema: z.ZodType<T>): T | null {
  if (value === undefined || value.length === 0) {
    return null;
  }

  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseCatalogFilters(params: CatalogSearchParams): CatalogFilters {
  const parsedSort = sortSchema.safeParse(first(params.siralama));

  return {
    genre: optionalValue(first(params.tur), genreSchema),
    page: parsePageNumber(params.sayfa),
    sort: parsedSort.success ? parsedSort.data : "editor-secimi",
    year: optionalValue(first(params.yil), yearSchema),
  };
}

export function createCatalogHref(
  filters: CatalogFilters,
  change: Partial<{
    genre: string | null;
    page: number;
    sort: CatalogSort;
    year: number | null;
  }>,
): string {
  const filterChanged =
    change.genre !== undefined || change.sort !== undefined || change.year !== undefined;
  const next = {
    ...filters,
    ...change,
    page: change.page ?? (filterChanged ? 1 : filters.page),
  };
  const params = new URLSearchParams();

  if (next.genre !== null) {
    params.set("tur", next.genre);
  }
  if (next.year !== null) {
    params.set("yil", String(next.year));
  }
  if (next.sort !== "editor-secimi") {
    params.set("siralama", next.sort);
  }
  if (next.page > 1) {
    params.set("sayfa", String(next.page));
  }

  const query = params.toString();
  return query.length === 0 ? "/filmler" : `/filmler?${query}`;
}
