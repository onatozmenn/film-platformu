import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/config/server-environment", () => ({
  getServerEnvironment: () => ({ siteOrigin: "https://film.example" }),
}));

import robots from "./robots";

describe("robots metadata", () => {
  it("allows public discovery while excluding private and internal routes", () => {
    expect(robots()).toEqual({
      rules: {
        allow: "/",
        disallow: ["/api/", "/giris", "/hesap", "/izle/", "/yonetim/"],
        userAgent: "*",
      },
      sitemap: "https://film.example/sitemap.xml",
    });
  });
});
