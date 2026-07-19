import { z } from "zod";

import source from "@/content/approved-public-content.json";

const plainText = (maximum: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximum)
    .refine((value) => !/[<>]/u.test(value), "Approved public copy must be plain text");
const localImageSchema = z.object({
  alt: plainText(240),
  height: z.number().int().positive().max(4_096),
  src: z.string().regex(/^\/brand\/[a-z0-9-]+\.(?:jpg|png|webp)$/u),
  width: z.number().int().positive().max(4_096),
});
const sectionSchema = z.object({
  heading: plainText(160),
  paragraphs: z.array(plainText(4_000)).min(1).max(20),
});
const documentSchema = z.object({
  reviewedAt: z.iso.date().transform((value) => new Date(`${value}T00:00:00.000Z`)),
  sections: z.array(sectionSchema).min(1).max(50),
  summary: plainText(500),
  title: plainText(160),
});
const schema = z
  .object({
    brand: z
      .object({
        description: plainText(320),
        logo: localImageSchema,
      })
      .nullable(),
    consent: documentSchema.nullable(),
    privacy: documentSchema.nullable(),
    support: documentSchema
      .extend({ contactEmail: z.email().trim().toLowerCase().max(320) })
      .nullable(),
    terms: documentSchema.nullable(),
    tmdbAttribution: documentSchema.extend({ logo: localImageSchema }).nullable(),
  })
  .strict();

export type ApprovedPublicDocument = z.infer<typeof documentSchema>;
export type ApprovedPublicImage = z.infer<typeof localImageSchema>;
export type ApprovedPublicContent = z.infer<typeof schema>;

export function parseApprovedPublicContent(value: unknown): ApprovedPublicContent {
  return Object.freeze(schema.parse(value));
}

export const approvedPublicContent = parseApprovedPublicContent(source);

export function isApprovedPublicContentComplete(content: ApprovedPublicContent): boolean {
  return Object.values(content).every((value) => value !== null);
}

export function approvedFooterLinks(
  content: ApprovedPublicContent,
): readonly Readonly<{ href: string; label: string }>[] {
  return [
    ...(content.privacy === null ? [] : [{ href: "/yasal/gizlilik", label: "Gizlilik" }]),
    ...(content.terms === null
      ? []
      : [{ href: "/yasal/kullanim-kosullari", label: "Kullanım koşulları" }]),
    ...(content.consent === null ? [] : [{ href: "/yasal/cerez-ve-riza", label: "Çerez ve rıza" }]),
    ...(content.support === null ? [] : [{ href: "/destek", label: "Destek" }]),
    ...(content.tmdbAttribution === null
      ? []
      : [{ href: "/hakkinda/veri-kaynaklari", label: "Veri kaynakları" }]),
  ];
}
