import { describe, expect, it } from "vitest";

import { createFakeEmailLinkDelivery } from "./fake-email-link-delivery";

const expires = new Date("2026-07-19T00:10:00.000Z");

describe("fake email-link delivery", () => {
  it("stores one normalized same-origin link and consumes it once", async () => {
    const fake = createFakeEmailLinkDelivery({
      clock: () => new Date("2026-07-19T00:00:00.000Z"),
      siteOrigin: "https://film.example",
    });
    await fake.delivery.send({
      expires,
      identifier: " MEMBER@FILM-PLATFORM.INVALID ",
      url: "https://film.example/api/auth/callback/email?token=secret",
    });

    expect(fake.consume("member@film-platform.invalid")).toBe(
      "https://film.example/api/auth/callback/email?token=secret",
    );
    expect(fake.consume("member@film-platform.invalid")).toBeNull();
  });

  it("rejects another origin and drops expired links", async () => {
    const fake = createFakeEmailLinkDelivery({
      clock: () => expires,
      siteOrigin: "https://film.example",
    });

    await expect(
      fake.delivery.send({
        expires,
        identifier: "member@film-platform.invalid",
        url: "https://attacker.example/callback?token=secret",
      }),
    ).rejects.toThrow("Email link origin is not allowed");
    await fake.delivery.send({
      expires,
      identifier: "member@film-platform.invalid",
      url: "https://film.example/api/auth/callback/email?token=expired",
    });
    expect(fake.consume("member@film-platform.invalid")).toBeNull();
  });

  it("evicts the oldest distinct identifier at its bounded capacity", async () => {
    const fake = createFakeEmailLinkDelivery({
      clock: () => new Date("2026-07-19T00:00:00.000Z"),
      maximumLinks: 2,
      siteOrigin: "https://film.example",
    });
    const send = (identifier: string) =>
      fake.delivery.send({
        expires,
        identifier,
        url: `https://film.example/api/auth/callback/email?token=${identifier}`,
      });

    await send("first@film-platform.invalid");
    await send("second@film-platform.invalid");
    await send("third@film-platform.invalid");

    expect(fake.consume("first@film-platform.invalid")).toBeNull();
    expect(fake.consume("second@film-platform.invalid")).not.toBeNull();
    fake.clear();
    expect(fake.consume("third@film-platform.invalid")).toBeNull();
  });
});
