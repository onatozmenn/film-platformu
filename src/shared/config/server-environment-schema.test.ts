import { describe, expect, it } from "vitest";

import { parseServerEnvironment } from "./server-environment-schema";

describe("parseServerEnvironment", () => {
  it("parses the isolated PostgreSQL and runtime settings", () => {
    expect(
      parseServerEnvironment({
        DATABASE_URL: "postgresql://film:film@127.0.0.1:5432/film_test",
        LOG_LEVEL: "warn",
        NODE_ENV: "test",
        RELEASE_ID: "release-abcdef1",
        SITE_ORIGIN: "https://film.example/",
        TRUST_INCOMING_REQUEST_ID: "true",
      }),
    ).toEqual({
      databaseUrl: "postgresql://film:film@127.0.0.1:5432/film_test",
      logLevel: "warn",
      metadataProvider: { kind: "disabled" },
      nodeEnvironment: "test",
      playback: {
        localDefaultTerritory: null,
        supportedTerritories: ["TR"],
        videoProvider: { kind: "fake" },
      },
      releaseId: "release-abcdef1",
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

  it("defaults a local release identifier and rejects an unsafe value", () => {
    const database = "postgresql://film:film@127.0.0.1:5432/film_test";
    expect(parseServerEnvironment({ DATABASE_URL: database }).releaseId).toBe("local-development");
    expect(() =>
      parseServerEnvironment({ DATABASE_URL: database, RELEASE_ID: "bad value" }),
    ).toThrow();
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

  it("validates territory fallback and forbids it in production", () => {
    const database = "postgresql://film:film@127.0.0.1:5432/film_test";

    expect(
      parseServerEnvironment({
        DATABASE_URL: database,
        LOCAL_DEFAULT_TERRITORY: "TR",
        SUPPORTED_TERRITORIES: "TR,DE,TR",
      }).playback,
    ).toMatchObject({ localDefaultTerritory: "TR", supportedTerritories: ["TR", "DE"] });
    expect(() =>
      parseServerEnvironment({
        DATABASE_URL: database,
        LOCAL_DEFAULT_TERRITORY: "US",
        SUPPORTED_TERRITORIES: "TR,DE",
      }),
    ).toThrow("LOCAL_DEFAULT_TERRITORY must be included in SUPPORTED_TERRITORIES");
    expect(() =>
      parseServerEnvironment({
        DATABASE_URL: database,
        LOCAL_DEFAULT_TERRITORY: "TR",
        NODE_ENV: "production",
      }),
    ).toThrow("LOCAL_DEFAULT_TERRITORY is forbidden in production");
  });

  it("requires the complete Mux credential set when selected", () => {
    const database = "postgresql://film:film@127.0.0.1:5432/film_test";
    const mux = {
      MUX_SIGNING_KEY_ID: "signing-key-id",
      MUX_SIGNING_PRIVATE_KEY: "private-key-material",
      MUX_TOKEN_ID: "management-token-id",
      MUX_TOKEN_SECRET: "management-token-secret",
      MUX_WEBHOOK_SECRET: "webhook-secret-value",
    };

    expect(() => parseServerEnvironment({ DATABASE_URL: database, VIDEO_PROVIDER: "mux" })).toThrow(
      "MUX_SIGNING_KEY_ID is required when VIDEO_PROVIDER is mux",
    );
    expect(
      parseServerEnvironment({ DATABASE_URL: database, VIDEO_PROVIDER: "mux", ...mux }).playback
        .videoProvider,
    ).toEqual({
      kind: "mux",
      signingKeyId: mux.MUX_SIGNING_KEY_ID,
      signingPrivateKey: mux.MUX_SIGNING_PRIVATE_KEY,
      tokenId: mux.MUX_TOKEN_ID,
      tokenSecret: mux.MUX_TOKEN_SECRET,
      webhookSecret: mux.MUX_WEBHOOK_SECRET,
    });
  });
});
