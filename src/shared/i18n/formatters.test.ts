import { describe, expect, it } from "vitest";

import { formatDate, formatNumber, formatYear } from "./formatters";

describe("Turkish formatters", () => {
  it("formats dates in the declared locale and fixed time zone", () => {
    const instant = "2026-07-18T23:30:00.000Z";

    expect(formatDate(instant)).toBe("18 Temmuz 2026");
    expect(formatYear(instant)).toBe("2026");
  });

  it("formats decimal values independently from the server locale", () => {
    expect(formatNumber(1234.5)).toBe("1.234,5");
  });
});
