import { describe, expect, it } from "vitest";

import { parseServerEnvironment } from "./server-environment-schema";

describe("parseServerEnvironment", () => {
  it("parses the isolated PostgreSQL and runtime settings", () => {
    expect(
      parseServerEnvironment({
        DATABASE_URL: "postgresql://film:film@127.0.0.1:5432/film_test",
        LOG_LEVEL: "warn",
        NODE_ENV: "test",
        TRUST_INCOMING_REQUEST_ID: "true",
      }),
    ).toEqual({
      databaseUrl: "postgresql://film:film@127.0.0.1:5432/film_test",
      logLevel: "warn",
      nodeEnvironment: "test",
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
});
