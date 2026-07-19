import { describe, expect, it } from "vitest";

import { parseIdentityEnvironment } from "./identity-environment";

const enabled = {
  AUTH_EMAIL_FROM: "GIRIS@FILM-PLATFORM.INVALID",
  AUTH_SECRET: "identity-test-secret-with-32-characters",
} as const;

describe("identity environment", () => {
  it("defaults to disabled without requiring credentials", () => {
    expect(parseIdentityEnvironment({ NODE_ENV: "production" })).toEqual({
      nodeEnvironment: "production",
      provider: { kind: "disabled" },
    });
  });

  it("normalizes and enables the non-production fake explicitly", () => {
    expect(
      parseIdentityEnvironment({
        ...enabled,
        AUTH_EMAIL_PROVIDER: "fake",
        NODE_ENV: "test",
      }),
    ).toEqual({
      nodeEnvironment: "test",
      provider: {
        from: "giris@film-platform.invalid",
        kind: "fake",
        secret: enabled.AUTH_SECRET,
      },
    });
  });

  it("accepts only a complete SMTP configuration", () => {
    expect(
      parseIdentityEnvironment({
        ...enabled,
        AUTH_EMAIL_PROVIDER: "smtp",
        AUTH_SMTP_URL: "smtps://mailer:secret@mail.example:465",
        NODE_ENV: "production",
      }).provider,
    ).toEqual({
      from: "giris@film-platform.invalid",
      kind: "smtp",
      secret: enabled.AUTH_SECRET,
      server: "smtps://mailer:secret@mail.example:465",
    });
    expect(() => parseIdentityEnvironment({ ...enabled, AUTH_EMAIL_PROVIDER: "smtp" })).toThrow(
      "AUTH_SMTP_URL is required when AUTH_EMAIL_PROVIDER is smtp",
    );
  });

  it("rejects incomplete, stray, and production fake configuration", () => {
    expect(() =>
      parseIdentityEnvironment({ AUTH_EMAIL_PROVIDER: "fake", NODE_ENV: "test" }),
    ).toThrow("AUTH_SECRET is required when email authentication is enabled");
    expect(() =>
      parseIdentityEnvironment({ ...enabled, AUTH_EMAIL_PROVIDER: "fake", NODE_ENV: "production" }),
    ).toThrow("The fake email provider is forbidden in production");
    expect(() =>
      parseIdentityEnvironment({ AUTH_SMTP_URL: "smtp://mail.example", NODE_ENV: "test" }),
    ).toThrow("AUTH_SMTP_URL requires AUTH_EMAIL_PROVIDER=smtp");
    expect(() =>
      parseIdentityEnvironment({
        ...enabled,
        AUTH_EMAIL_PROVIDER: "smtp",
        AUTH_SMTP_URL: "https://mail.example",
      }),
    ).toThrow("AUTH_SMTP_URL must use smtp: or smtps:");
  });
});
