import { describe, expect, it } from "vitest";

import deployment from "../../../vercel.json";

describe("managed deployment configuration", () => {
  it("declares only the owned bounded internal jobs at their reviewed UTC cadence", () => {
    expect(deployment).toEqual({
      $schema: "https://openapi.vercel.sh/vercel.json",
      crons: [
        { path: "/api/internal/publish-due", schedule: "* * * * *" },
        { path: "/api/internal/run-retention", schedule: "0 3 * * *" },
      ],
      framework: "nextjs",
    });
  });
});
