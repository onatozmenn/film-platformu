import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import type { PageInfo } from "@/shared/pagination/page";

export function PaginationNav({
  hrefForPage,
  pageInfo,
}: Readonly<{ hrefForPage: (page: number) => string; pageInfo: PageInfo }>) {
  if (pageInfo.totalPages <= 1) {
    return null;
  }

  return (
    <nav className="pagination" aria-label="Sayfalandırma">
      {pageInfo.page > 1 ? (
        <Link
          aria-label="Önceki sayfa"
          className="pagination__control"
          href={hrefForPage(pageInfo.page - 1)}
          title="Önceki sayfa"
        >
          <ChevronLeft aria-hidden="true" size={20} strokeWidth={2} />
        </Link>
      ) : (
        <span aria-hidden="true" className="pagination__control pagination__control--disabled">
          <ChevronLeft size={20} strokeWidth={2} />
        </span>
      )}
      <p aria-live="polite">
        Sayfa {pageInfo.page} / {pageInfo.totalPages}
      </p>
      {pageInfo.page < pageInfo.totalPages ? (
        <Link
          aria-label="Sonraki sayfa"
          className="pagination__control"
          href={hrefForPage(pageInfo.page + 1)}
          title="Sonraki sayfa"
        >
          <ChevronRight aria-hidden="true" size={20} strokeWidth={2} />
        </Link>
      ) : (
        <span aria-hidden="true" className="pagination__control pagination__control--disabled">
          <ChevronRight size={20} strokeWidth={2} />
        </span>
      )}
    </nav>
  );
}
