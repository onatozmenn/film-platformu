import { z } from "zod";

import type {
  AdminCreditInput,
  AdminSubtitleInput,
  MovieEditorialInput,
  UnpublishReason,
  UpsertCollectionCommand,
} from "../application/admin-command-port";

const uuidSchema = z.string().uuid();
const revisionSchema = z.coerce.number().int().positive();
const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u)
  .transform((value) => new Date(`${value}T00:00:00.000Z`))
  .refine((value) => Number.isFinite(value.getTime()));
const dateTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/u)
  .transform((value) => new Date(`${value.length === 16 ? `${value}:00` : value}.000Z`))
  .refine((value) => Number.isFinite(value.getTime()));
const optionalTrimmed = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .transform((value) => (value.length === 0 ? null : value));
const imageSchema = z.object({
  alt: z.string().trim().min(1).max(240),
  focalPosition: z.string().regex(/^(?:100|\d{1,2})% (?:100|\d{1,2})%$/u),
  height: z.coerce.number().int().positive().max(20_000),
  src: z.string().regex(/^\/fixtures\/catalog\/[a-z0-9-]+\.(?:jpg|jpeg|png|webp)$/u),
  width: z.coerce.number().int().positive().max(20_000),
});
const editorialSchema = z.object({
  ageRating: optionalTrimmed(32),
  backdrop: imageSchema.nullable(),
  genreIds: z
    .array(uuidSchema)
    .max(20)
    .refine((values) => new Set(values).size === values.length),
  originalTitle: optionalTrimmed(160),
  poster: imageSchema.nullable(),
  releaseDate: dateOnlySchema,
  runtimeMinutes: z.coerce.number().int().positive().max(1_440),
  slug: z
    .string()
    .min(1)
    .max(96)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  synopsis: z.string().trim().min(10).max(5_000),
  title: z.string().trim().min(1).max(160),
});

function stringEntries(formData: FormData, key: string): string[] | null {
  const values = formData.getAll(key);
  return values.every((value) => typeof value === "string") ? values : null;
}

function optionalImage(formData: FormData, prefix: "backdrop" | "poster") {
  const src = formData.get(`${prefix}Src`);
  if (src === "") {
    return null;
  }
  return {
    alt: formData.get(`${prefix}Alt`),
    focalPosition: formData.get(`${prefix}FocalPosition`),
    height: formData.get(`${prefix}Height`),
    src,
    width: formData.get(`${prefix}Width`),
  };
}

export function parseEditorialFormData(formData: FormData): MovieEditorialInput | null {
  const genreIds = stringEntries(formData, "genreIds");
  if (genreIds === null) {
    return null;
  }
  const parsed = editorialSchema.safeParse({
    ageRating: formData.get("ageRating"),
    backdrop: optionalImage(formData, "backdrop"),
    genreIds,
    originalTitle: formData.get("originalTitle"),
    poster: optionalImage(formData, "poster"),
    releaseDate: formData.get("releaseDate"),
    runtimeMinutes: formData.get("runtimeMinutes"),
    slug: formData.get("slug"),
    synopsis: formData.get("synopsis"),
    title: formData.get("title"),
  });
  return parsed.success ? parsed.data : null;
}

const identitySchema = z.object({
  id: uuidSchema,
  revision: revisionSchema,
});

export function parseMovieIdentity(
  formData: FormData,
): Readonly<{ id: string; revision: number }> | null {
  const parsed = identitySchema.safeParse({
    id: formData.get("movieId"),
    revision: formData.get("expectedRevision"),
  });
  return parsed.success ? parsed.data : null;
}

const creditSchema = z.object({
  billingOrder: z.coerce.number().int().nonnegative().max(10_000),
  characterName: optionalTrimmed(160),
  displayLabel: optionalTrimmed(80),
  kind: z.enum(["CAST", "DIRECTOR", "OTHER", "WRITER"]),
  personName: z.string().trim().min(1).max(160),
});

export function parseCreditsFormData(formData: FormData): readonly AdminCreditInput[] | null {
  const names = stringEntries(formData, "creditName");
  const kinds = stringEntries(formData, "creditKind");
  const orders = stringEntries(formData, "creditOrder");
  const characters = stringEntries(formData, "creditCharacter");
  const labels = stringEntries(formData, "creditLabel");
  if (
    names === null ||
    kinds === null ||
    orders === null ||
    characters === null ||
    labels === null ||
    names.length > 200 ||
    ![kinds, orders, characters, labels].every((values) => values.length === names.length)
  ) {
    return null;
  }
  const rows = names.flatMap((personName, index) => {
    if (personName.trim().length === 0) {
      return [];
    }
    return [
      {
        billingOrder: orders[index],
        characterName: characters[index],
        displayLabel: labels[index],
        kind: kinds[index],
        personName,
      },
    ];
  });
  const parsed = z.array(creditSchema).max(200).safeParse(rows);
  return parsed.success ? parsed.data : null;
}

const subtitleSchema = z.object({
  isDefault: z.boolean(),
  kind: z.enum(["CAPTIONS", "FORCED", "SUBTITLES"]),
  label: z.string().trim().min(1).max(80),
  languageTag: z.string().regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u),
  providerTrackId: z.string().trim().min(1).max(120),
});

export function parseSubtitlesFormData(formData: FormData): readonly AdminSubtitleInput[] | null {
  const languages = stringEntries(formData, "subtitleLanguage");
  const labels = stringEntries(formData, "subtitleLabel");
  const kinds = stringEntries(formData, "subtitleKind");
  const providerIds = stringEntries(formData, "subtitleProviderId");
  const defaults = stringEntries(formData, "subtitleDefault");
  if (
    languages === null ||
    labels === null ||
    kinds === null ||
    providerIds === null ||
    defaults === null ||
    languages.length > 50 ||
    ![labels, kinds, providerIds, defaults].every((values) => values.length === languages.length)
  ) {
    return null;
  }
  const rows = languages.flatMap((languageTag, index) => {
    if (languageTag.trim().length === 0) {
      return [];
    }
    return [
      {
        isDefault: defaults[index] === "true",
        kind: kinds[index],
        label: labels[index],
        languageTag,
        providerTrackId: providerIds[index],
      },
    ];
  });
  const parsed = z.array(subtitleSchema).max(50).safeParse(rows);
  return parsed.success ? parsed.data : null;
}

const assetSchema = z.object({
  makeActive: z.boolean(),
  movieId: uuidSchema,
  providerAssetId: z.string().trim().min(1).max(120),
});

export function parseAssetFormData(
  formData: FormData,
): Readonly<{ makeActive: boolean; movieId: string; providerAssetId: string }> | null {
  const parsed = assetSchema.safeParse({
    makeActive: formData.get("makeActive") === "on",
    movieId: formData.get("movieId"),
    providerAssetId: formData.get("providerAssetId"),
  });
  return parsed.success ? parsed.data : null;
}

const rightSchema = z.object({
  allowStreaming: z.boolean(),
  endsAt: dateTimeSchema,
  evidenceReference: z
    .string()
    .trim()
    .min(3)
    .max(160)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u),
  movieId: uuidSchema,
  rightId: z.union([uuidSchema, z.literal("")]).transform((value) => (value === "" ? null : value)),
  startsAt: dateTimeSchema,
  territory: z.string().regex(/^[A-Z]{2}$/u),
});

export function parseRightFormData(formData: FormData) {
  const parsed = rightSchema.safeParse({
    allowStreaming: formData.get("allowStreaming") === "on",
    endsAt: formData.get("endsAt"),
    evidenceReference: formData.get("evidenceReference"),
    movieId: formData.get("movieId"),
    rightId: formData.get("rightId"),
    startsAt: formData.get("startsAt"),
    territory: formData.get("territory"),
  });
  return parsed.success ? parsed.data : null;
}

const scheduleSchema = identitySchema.extend({ publishAt: dateTimeSchema });

export function parseScheduleFormData(formData: FormData) {
  const parsed = scheduleSchema.safeParse({
    id: formData.get("movieId"),
    publishAt: formData.get("publishAt"),
    revision: formData.get("expectedRevision"),
  });
  return parsed.success ? parsed.data : null;
}

const unpublishSchema = identitySchema.extend({
  reason: z.enum(["ASSET", "EDITORIAL", "LEGAL", "OTHER", "RIGHTS"]),
});

export function parseUnpublishFormData(
  formData: FormData,
): Readonly<{ id: string; reason: UnpublishReason; revision: number }> | null {
  const parsed = unpublishSchema.safeParse({
    id: formData.get("movieId"),
    reason: formData.get("reason"),
    revision: formData.get("expectedRevision"),
  });
  return parsed.success ? parsed.data : null;
}

const collectionSchema = z.object({
  collectionId: z
    .union([uuidSchema, z.literal("")])
    .transform((value) => (value === "" ? null : value)),
  description: optionalTrimmed(2_000),
  displayOrder: z.coerce.number().int().nonnegative().max(10_000),
  expectedRevision: z
    .union([revisionSchema, z.literal("")])
    .transform((value) => (value === "" ? null : value)),
  movieIds: z
    .array(uuidSchema)
    .max(100)
    .refine((values) => new Set(values).size === values.length),
  slug: z
    .string()
    .min(1)
    .max(96)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  state: z.enum(["DRAFT", "PUBLISHED"]),
  title: z.string().trim().min(1).max(160),
});

export function parseCollectionFormData(
  formData: FormData,
): Omit<UpsertCollectionCommand, "actorUserId" | "requestId"> | null {
  const movieIds = stringEntries(formData, "movieIds");
  if (movieIds === null) {
    return null;
  }
  const parsed = collectionSchema.safeParse({
    collectionId: formData.get("collectionId"),
    description: formData.get("description"),
    displayOrder: formData.get("displayOrder"),
    expectedRevision: formData.get("expectedRevision"),
    movieIds,
    slug: formData.get("slug"),
    state: formData.get("state"),
    title: formData.get("title"),
  });
  if (!parsed.success) {
    return null;
  }
  return {
    collectionId: parsed.data.collectionId,
    description: parsed.data.description,
    displayOrder: parsed.data.displayOrder,
    expectedRevision: parsed.data.expectedRevision,
    movies: parsed.data.movieIds.map((movieId, position) => ({ movieId, position })),
    slug: parsed.data.slug,
    state: parsed.data.state,
    title: parsed.data.title,
  };
}

const roleSchema = z.object({
  role: z.enum(["ADMIN", "EDITOR"]),
  subjectUserId: uuidSchema,
});

export function parseRoleFormData(formData: FormData) {
  const parsed = roleSchema.safeParse({
    role: formData.get("role"),
    subjectUserId: formData.get("subjectUserId"),
  });
  return parsed.success ? parsed.data : null;
}

export function parseSubjectFormData(formData: FormData): string | null {
  const parsed = uuidSchema.safeParse(formData.get("subjectUserId"));
  return parsed.success ? parsed.data : null;
}

export function parseMetadataExternalId(formData: FormData): string | null {
  const parsed = z
    .string()
    .trim()
    .regex(/^\d{1,12}$/u)
    .safeParse(formData.get("externalId"));
  return parsed.success ? parsed.data : null;
}

export function parseAssetIdentity(formData: FormData) {
  const parsed = z
    .object({ assetId: uuidSchema, movieId: uuidSchema })
    .safeParse({ assetId: formData.get("assetId"), movieId: formData.get("movieId") });
  return parsed.success ? parsed.data : null;
}
