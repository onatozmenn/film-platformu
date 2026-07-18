import { z } from "zod";

const publicEnvironmentSchema = z
  .object({
    NEXT_PUBLIC_SITE_NAME: z.string().trim().min(1).max(80).default("Film Platform"),
  })
  .strict();

export type PublicEnvironment = Readonly<{
  siteName: string;
}>;

export function parsePublicEnvironment(source: {
  NEXT_PUBLIC_SITE_NAME?: string | undefined;
}): PublicEnvironment {
  const parsed = publicEnvironmentSchema.parse(source);

  return Object.freeze({
    siteName: parsed.NEXT_PUBLIC_SITE_NAME,
  });
}
