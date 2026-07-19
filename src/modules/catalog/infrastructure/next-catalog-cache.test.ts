import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidateTag }));

import { catalogCacheInvalidator } from "./next-catalog-cache";

describe("catalog cache invalidator", () => {
  beforeEach(() => revalidateTag.mockClear());

  it("always invalidates the public catalog root without inventing targeted tags", () => {
    catalogCacheInvalidator.invalidate({});

    expect(revalidateTag).toHaveBeenCalledExactlyOnceWith("catalog", "max");
  });

  it("maps collection, search, ID, and slug changes to owned public tags", () => {
    catalogCacheInvalidator.invalidate({
      collectionChanged: true,
      movieIds: ["00000000-0000-4000-8000-000000000001"],
      movieSlugs: ["kiyidaki-sessizlik"],
      searchChanged: true,
    });

    expect(revalidateTag.mock.calls).toEqual([
      ["catalog", "max"],
      ["catalog:collections", "max"],
      ["catalog:search", "max"],
      ["catalog:movie:00000000-0000-4000-8000-000000000001", "max"],
      ["catalog:movie:kiyidaki-sessizlik", "max"],
    ]);
  });

  it("uses immediate expiry for committed editorial withdrawal", () => {
    catalogCacheInvalidator.invalidate({
      expireImmediately: true,
      movieSlugs: ["kiyidaki-sessizlik"],
      searchChanged: true,
    });

    expect(revalidateTag.mock.calls).toEqual([
      ["catalog", { expire: 0 }],
      ["catalog:search", { expire: 0 }],
      ["catalog:movie:kiyidaki-sessizlik", { expire: 0 }],
    ]);
  });
});
