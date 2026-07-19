import nodemailer from "nodemailer";

import type { EmailLinkDeliveryPort } from "../application/email-link-port";

type MailTransport = Readonly<{
  sendMail(
    message: Readonly<{
      from: string;
      html: string;
      subject: string;
      text: string;
      to: string;
    }>,
  ): Promise<unknown>;
}>;

type MailTransportFactory = (server: string) => MailTransport;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function createSmtpEmailLinkDelivery(
  input: Readonly<{ from: string; server: string; siteOrigin: string }>,
  createTransport: MailTransportFactory = (server) => nodemailer.createTransport(server),
): EmailLinkDeliveryPort {
  const expectedOrigin = new URL(input.siteOrigin).origin;
  const transport = createTransport(input.server);

  return {
    async send(message): Promise<void> {
      const url = new URL(message.url);
      if (url.origin !== expectedOrigin) {
        throw new Error("Email link origin is not allowed");
      }
      const safeUrl = escapeHtml(url.toString());
      await transport.sendMail({
        from: input.from,
        html: `<p>Film Platform oturumunu açmak için <a href="${safeUrl}">güvenli bağlantıyı kullanın</a>.</p>`,
        subject: "Film Platform giriş bağlantısı",
        text: `Film Platform oturumunu açmak için bu bağlantıyı kullanın: ${url.toString()}`,
        to: message.identifier.trim().toLowerCase(),
      });
    },
  };
}
