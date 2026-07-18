import { describe, expect, it } from "vitest";

import { createTerritoryResolver } from "./territory-resolver";

const productionConfig = {
  localDefaultTerritory: null,
  supportedTerritories: ["TR", "DE"],
  videoProvider: { kind: "fake" },
} as const;

describe("territory resolver", () => {
  it("accepts an allowlisted country only from trusted deployment context", () => {
    const headers = new Headers({ "x-vercel-ip-country": "tr" });

    expect(createTerritoryResolver(productionConfig, true).resolve(headers)).toBe("TR");
    expect(createTerritoryResolver(productionConfig, false).resolve(headers)).toBeNull();
  });

  it("fails closed for malformed, unsupported, or absent trusted territory", () => {
    const resolver = createTerritoryResolver(productionConfig, true);

    expect(resolver.resolve(new Headers({ "x-vercel-ip-country": "USA" }))).toBeNull();
    expect(resolver.resolve(new Headers({ "x-vercel-ip-country": "US" }))).toBeNull();
    expect(resolver.resolve(new Headers())).toBeNull();
  });

  it("uses only the explicit non-production fallback when deployment context is untrusted", () => {
    const resolver = createTerritoryResolver(
      { ...productionConfig, localDefaultTerritory: "TR" },
      false,
    );

    expect(resolver.resolve(new Headers({ "x-vercel-ip-country": "DE" }))).toBe("TR");
  });
});
