import { z } from "zod";

export const PUBLIC_PAGE_SIZE = 24;

export type PageInfo = Readonly<{
  page: number;
  pageSize: number;
  totalPages: number;
}>;

const pageSchema = z.coerce.number().int().min(1).max(10_000).default(1);

export function parsePageNumber(value: string | string[] | undefined): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = pageSchema.safeParse(candidate);
  return parsed.success ? parsed.data : 1;
}

export function createPageInfo(
  total: number,
  requestedPage: number,
  pageSize: number = PUBLIC_PAGE_SIZE,
): PageInfo {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    page: Math.min(requestedPage, totalPages),
    pageSize,
    totalPages,
  };
}

export function paginate<T>(items: readonly T[], pageInfo: PageInfo): readonly T[] {
  const offset = (pageInfo.page - 1) * pageInfo.pageSize;
  return items.slice(offset, offset + pageInfo.pageSize);
}
