import { z } from "zod";

const movieSlugSchema = z
  .string()
  .min(1)
  .max(96)
  .regex(/^[a-z0-9-]+$/u);

export function parseMovieSlug(value: string): string | null {
  const parsed = movieSlugSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
