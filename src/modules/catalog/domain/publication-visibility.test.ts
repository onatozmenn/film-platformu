import { describe, expect, it } from "vitest";

import { isCatalogVisible } from "./publication-visibility";

const now = new Date("2026-07-18T12:00:00.000Z");

describe("catalog publication visibility", () => {
  it("allows published records with no schedule or an exact-due schedule", () => {
    expect(isCatalogVisible("PUBLISHED", null, now)).toBe(true);
    expect(isCatalogVisible("PUBLISHED", now, now)).toBe(true);
  });

  it.each(["DRAFT", "SCHEDULED", "UNPUBLISHED"] as const)(
    "conceals the %s editorial state",
    (state) => {
      expect(isCatalogVisible(state, null, now)).toBe(false);
    },
  );

  it("conceals a published record before its publish time", () => {
    expect(isCatalogVisible("PUBLISHED", new Date("2026-07-18T12:00:00.001Z"), now)).toBe(false);
  });
});
