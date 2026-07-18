import { describe, expect, it } from "vitest";

import { parsePublicEnvironment } from "./public-environment";

describe("parsePublicEnvironment", () => {
  it("uses the approved temporary product name by default", () => {
    expect(parsePublicEnvironment({})).toEqual({ siteName: "Film Platform" });
  });

  it("returns only the explicitly public display value", () => {
    const serverSecret = "server-secret-sentinel";
    const source = {
      NEXT_PUBLIC_SITE_NAME: "Gece Perdesi",
      DATABASE_URL: serverSecret,
    };

    const result = parsePublicEnvironment({
      NEXT_PUBLIC_SITE_NAME: source.NEXT_PUBLIC_SITE_NAME,
    });

    expect(result).toEqual({ siteName: "Gece Perdesi" });
    expect(JSON.stringify(result)).not.toContain(serverSecret);
  });
});
