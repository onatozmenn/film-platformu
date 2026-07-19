import type { EmailLinkDeliveryPort, EmailLinkMessage } from "../application/email-link-port";

type StoredEmailLink = Readonly<{
  expires: Date;
  url: string;
}>;

export function createFakeEmailLinkDelivery(
  input: Readonly<{
    clock?: () => Date;
    maximumLinks?: number;
    siteOrigin: string;
  }>,
) {
  const clock = input.clock ?? (() => new Date());
  const maximumLinks = input.maximumLinks ?? 1_000;
  const expectedOrigin = new URL(input.siteOrigin).origin;
  const links = new Map<string, StoredEmailLink>();

  const delivery: EmailLinkDeliveryPort = {
    async send(message: EmailLinkMessage): Promise<void> {
      const identifier = message.identifier.trim().toLowerCase();
      const url = new URL(message.url);
      if (url.origin !== expectedOrigin) {
        throw new Error("Email link origin is not allowed");
      }
      if (!links.has(identifier) && links.size >= maximumLinks) {
        const oldest = links.keys().next();
        if (!oldest.done) {
          links.delete(oldest.value);
        }
      }
      links.delete(identifier);
      links.set(identifier, { expires: message.expires, url: url.toString() });
    },
  };

  return {
    clear(): void {
      links.clear();
    },
    consume(identifier: string): string | null {
      const normalized = identifier.trim().toLowerCase();
      const stored = links.get(normalized);
      links.delete(normalized);
      if (stored === undefined || stored.expires.getTime() <= clock().getTime()) {
        return null;
      }
      return stored.url;
    },
    delivery,
  };
}
