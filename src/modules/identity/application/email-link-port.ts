export type EmailLinkMessage = Readonly<{
  expires: Date;
  identifier: string;
  url: string;
}>;

export interface EmailLinkDeliveryPort {
  send(message: EmailLinkMessage): Promise<void>;
}
