import { z } from "zod";

const httpsUrlSchema = z.url().refine((value) => new URL(value).protocol === "https:");
const blenderVideoUrlSchema = httpsUrlSchema.refine(
  (value) => new URL(value).hostname === "download.blender.org",
  "Video source must use the approved Blender download host",
);
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);
const isoInstantSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
const localArtworkPathSchema = z
  .string()
  .regex(/^\/(?:fixtures\/catalog|open-films)\/[a-z0-9][a-z0-9./-]*\.(?:jpe?g|png|webp)$/u);

const artworkSchema = z
  .object({
    alt: z.string().trim().min(1).max(240),
    focalPosition: z.string().regex(/^\d{1,3}% \d{1,3}%$/u),
    height: z.number().int().positive().max(10_000),
    sha256: z.string().regex(/^[a-f0-9]{64}$/iu),
    sourceUrl: httpsUrlSchema,
    src: localArtworkPathSchema,
    width: z.number().int().positive().max(10_000),
  })
  .strict();

const openFilmSchema = z
  .object({
    ageRating: z.string().trim().min(1).max(32).nullable(),
    artwork: z.object({ backdrop: artworkSchema, poster: artworkSchema }).strict(),
    credits: z
      .array(
        z
          .object({
            billingOrder: z.number().int().nonnegative().max(1_000),
            displayLabel: z.string().trim().min(1).max(80).nullable(),
            kind: z.enum(["CAST", "DIRECTOR", "OTHER", "WRITER"]),
            name: z.string().trim().min(1).max(160),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    genres: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(80),
            slug: z
              .string()
              .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
              .max(64),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    id: z.uuid(),
    license: z
      .object({
        copyrightNotice: z.string().trim().min(1).max(240),
        creator: z.string().trim().min(1).max(160),
        evidenceReference: z.string().trim().min(1).max(160),
        id: z.enum(["CC-BY-2.5", "CC-BY-3.0", "CC-BY-4.0", "PUBLIC-DOMAIN"]),
        label: z.string().trim().min(1).max(120),
        notice: z.string().trim().min(1).max(240),
        projectUrl: httpsUrlSchema,
        url: httpsUrlSchema,
      })
      .strict(),
    originalTitle: z.string().trim().min(1).max(160).nullable(),
    releaseDate: isoDateSchema,
    rights: z
      .object({
        endsAt: isoInstantSchema,
        startsAt: isoInstantSchema,
        territories: z
          .array(z.string().regex(/^[A-Z]{2}$/u))
          .min(1)
          .max(20),
      })
      .strict(),
    runtimeMinutes: z
      .number()
      .int()
      .positive()
      .max(12 * 60),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
      .max(96),
    synopsis: z.string().trim().min(10).max(5_000),
    title: z.string().trim().min(1).max(160),
    video: z
      .object({
        sourceRecordUrl: httpsUrlSchema,
        sourceUrl: blenderVideoUrlSchema.refine((value) =>
          /\.(?:m4v|mkv|mov|mp4)$/iu.test(new URL(value).pathname),
        ),
        videoQuality: z.enum(["basic", "plus", "premium"]),
      })
      .strict(),
  })
  .strict()
  .superRefine((film, context) => {
    if (new Date(film.rights.startsAt).getTime() >= new Date(film.rights.endsAt).getTime()) {
      context.addIssue({ code: "custom", message: "Rights window must be increasing" });
    }
    for (const [index, credit] of film.credits.entries()) {
      if (credit.kind === "OTHER" && credit.displayLabel === null) {
        context.addIssue({
          code: "custom",
          message: "OTHER credits require a display label",
          path: ["credits", index, "displayLabel"],
        });
      }
    }
  });

const openFilmManifestSchema = z
  .object({
    films: z.array(openFilmSchema).min(1).max(50),
    version: z.literal(1),
  })
  .strict()
  .superRefine((manifest, context) => {
    for (const key of ["id", "slug"] as const) {
      const seen = new Set<string>();
      for (const [index, film] of manifest.films.entries()) {
        if (seen.has(film[key])) {
          context.addIssue({
            code: "custom",
            message: `Duplicate film ${key}`,
            path: ["films", index, key],
          });
        }
        seen.add(film[key]);
      }
    }
  });

export type OpenFilm = z.infer<typeof openFilmSchema>;
export type OpenFilmManifest = z.infer<typeof openFilmManifestSchema>;

export function parseOpenFilmManifest(value: unknown): OpenFilmManifest {
  return openFilmManifestSchema.parse(value);
}
