import { describe, expect, it } from "vitest";

import { createPageInfo, paginate, parsePageNumber } from "./page";

describe("page contract", () => {
  it("parses bounded positive page numbers with a safe default", () => {
    expect(parsePageNumber("2")).toBe(2);
    expect(parsePageNumber(["3", "4"])).toBe(3);
    expect(parsePageNumber("0")).toBe(1);
    expect(parsePageNumber("1.5")).toBe(1);
    expect(parsePageNumber("10001")).toBe(1);
  });

  it("clamps pages to the available range and slices deterministically", () => {
    const items = Array.from({ length: 50 }, (_, index) => index + 1);
    const secondPage = createPageInfo(items.length, 2);
    const clampedPage = createPageInfo(items.length, 99);

    expect(paginate(items, secondPage)).toEqual(
      Array.from({ length: 24 }, (_, index) => index + 25),
    );
    expect(clampedPage).toEqual({ page: 3, pageSize: 24, totalPages: 3 });
    expect(paginate(items, clampedPage)).toEqual([49, 50]);
  });

  it("keeps an empty result on page one", () => {
    expect(createPageInfo(0, 8)).toEqual({ page: 1, pageSize: 24, totalPages: 1 });
  });
});
