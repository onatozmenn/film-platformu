import { describe, expect, it } from "vitest";

import { parseServerEnvironment } from "./server-environment-schema";

describe("parseServerEnvironment", () => {
  it("parses the isolated PostgreSQL and runtime settings", () => {
    expect(
      parseServerEnvironment({
        DATABASE_URL: "postgresql://film:film@127.0.0.1:5432/film_test",
        LOG_LEVEL: "warn",
        NODE_ENV: "test",
        SITE_ORIGIN: "https://film.example/",
        TRUST_INCOMING_REQUEST_ID: "true",
      }),
    ).toEqual({
      databaseUrl: "postgresql://film:film@127.0.0.1:5432/film_test",
      logLevel: "warn",
      metadataProvider: { kind: "disabled" },
      nodeEnvironment: "test",
      siteOrigin: "https://film.example",
      trustIncomingRequestId: true,
    });
  });

  it("rejects a non-PostgreSQL database URL", () => {
    expect(() =>
      parseServerEnvironment({
        DATABASE_URL: "https://database.invalid/film",
      }),
    ).toThrow("DATABASE_URL must use the PostgreSQL protocol");
  });

  it("keeps metadata disabled unless explicitly enabled with a token", () => {
    const database = "postgresql://film:film@127.0.0.1:5432/film_test";

    expect(
      parseServerEnvironment({ DATABASE_URL: database, TMDB_API_TOKEN: "x".repeat(32) })
        .metadataProvider,
    ).toEqual({ kind: "disabled" });
    expect(() => parseServerEnvironment({ DATABASE_URL: database, TMDB_ENABLED: "true" })).toThrow(
      "TMDB_API_TOKEN is required when TMDB_ENABLED is true",
    );
    expect(
      parseServerEnvironment({
        DATABASE_URL: database,
        TMDB_API_TOKEN: "x".repeat(32),
        TMDB_ENABLED: "true",
      }).metadataProvider,
    ).toEqual({ apiToken: "x".repeat(32), kind: "tmdb" });
  });
});
