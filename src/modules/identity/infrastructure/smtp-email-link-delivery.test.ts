import { describe, expect, it, vi } from "vitest";

import { createSmtpEmailLinkDelivery } from "./smtp-email-link-delivery";

describe("SMTP email-link delivery", () => {
  it("sends normalized Turkish copy through the injected transport", async () => {
    const sendMail = vi.fn(async () => ({ accepted: 1 }));
    const createTransport = vi.fn(() => ({ sendMail }));
    const delivery = createSmtpEmailLinkDelivery(
      {
        from: "giris@film-platform.invalid",
        server: "smtps://mailer:secret@mail.example:465",
        siteOrigin: "https://film.example",
      },
      createTransport,
    );

    await delivery.send({
      expires: new Date("2026-07-19T00:10:00.000Z"),
      identifier: " MEMBER@FILM-PLATFORM.INVALID ",
      url: "https://film.example/api/auth/callback/email?token=a&next=%3Cunsafe%3E",
    });

    expect(createTransport).toHaveBeenCalledWith("smtps://mailer:secret@mail.example:465");
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "giris@film-platform.invalid",
        html: expect.stringContaining("&amp;next=%3Cunsafe%3E"),
        subject: "Film Platform giriş bağlantısı",
        to: "member@film-platform.invalid",
      }),
    );
  });

  it("rejects an off-origin callback before the transport is used", async () => {
    const sendMail = vi.fn(async () => undefined);
    const delivery = createSmtpEmailLinkDelivery(
      {
        from: "giris@film-platform.invalid",
        server: "smtp://mail.example:587",
        siteOrigin: "https://film.example",
      },
      () => ({ sendMail }),
    );

    await expect(
      delivery.send({
        expires: new Date(),
        identifier: "member@film-platform.invalid",
        url: "https://attacker.example/callback?token=secret",
      }),
    ).rejects.toThrow("Email link origin is not allowed");
    expect(sendMail).not.toHaveBeenCalled();
  });
});
