-- EnableExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA public;

-- CreateEnum
CREATE TYPE "PublicationState" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'UNPUBLISHED');

-- CreateEnum
CREATE TYPE "CreditKind" AS ENUM ('DIRECTOR', 'WRITER', 'CAST', 'OTHER');

-- CreateEnum
CREATE TYPE "CollectionState" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "MetadataProvider" AS ENUM ('TMDB');

-- CreateTable
CREATE TABLE "movies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(96) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "title_search" VARCHAR(160) NOT NULL,
    "original_title" VARCHAR(160),
    "original_title_search" VARCHAR(160),
    "synopsis" TEXT NOT NULL,
    "release_date" DATE NOT NULL,
    "runtime_minutes" INTEGER NOT NULL,
    "age_rating" VARCHAR(32),
    "poster_src" TEXT,
    "poster_alt" VARCHAR(240),
    "poster_width" INTEGER,
    "poster_height" INTEGER,
    "poster_focal_position" VARCHAR(32),
    "backdrop_src" TEXT,
    "backdrop_alt" VARCHAR(240),
    "backdrop_width" INTEGER,
    "backdrop_height" INTEGER,
    "backdrop_focal_position" VARCHAR(32),
    "publication_state" "PublicationState" NOT NULL DEFAULT 'DRAFT',
    "publish_at" TIMESTAMPTZ(3),
    "added_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "movies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genres" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(64) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "genres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movie_genres" (
    "movie_id" UUID NOT NULL,
    "genre_id" UUID NOT NULL,

    CONSTRAINT "movie_genres_pkey" PRIMARY KEY ("movie_id","genre_id")
);

-- CreateTable
CREATE TABLE "people" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(160) NOT NULL,
    "name_search" VARCHAR(160) NOT NULL,
    "provider" "MetadataProvider",
    "provider_person_id" VARCHAR(120),
    "profile_image_src" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "movie_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "kind" "CreditKind" NOT NULL,
    "character_name" VARCHAR(160),
    "display_label" VARCHAR(80),
    "billing_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(96) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "state" "CollectionState" NOT NULL DEFAULT 'DRAFT',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_movies" (
    "collection_id" UUID NOT NULL,
    "movie_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "collection_movies_pkey" PRIMARY KEY ("collection_id","movie_id")
);

-- CreateTable
CREATE TABLE "metadata_sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "movie_id" UUID NOT NULL,
    "provider" "MetadataProvider" NOT NULL,
    "external_id" VARCHAR(120) NOT NULL,
    "last_imported_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "metadata_sources_pkey" PRIMARY KEY ("id")
);

-- Catalog invariants that Prisma cannot express
ALTER TABLE "movies"
    ADD CONSTRAINT "movies_slug_format_check"
        CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    ADD CONSTRAINT "movies_title_check"
        CHECK (char_length(btrim("title")) BETWEEN 1 AND 160),
    ADD CONSTRAINT "movies_title_search_check"
        CHECK (char_length(btrim("title_search")) BETWEEN 1 AND 160),
    ADD CONSTRAINT "movies_original_title_search_check"
        CHECK (("original_title" IS NULL) = ("original_title_search" IS NULL)),
    ADD CONSTRAINT "movies_synopsis_check"
        CHECK (char_length(btrim("synopsis")) BETWEEN 10 AND 5000),
    ADD CONSTRAINT "movies_runtime_minutes_check"
        CHECK ("runtime_minutes" > 0),
    ADD CONSTRAINT "movies_schedule_check"
        CHECK ("publication_state" <> 'SCHEDULED' OR "publish_at" IS NOT NULL),
    ADD CONSTRAINT "movies_poster_metadata_check"
        CHECK (
            ("poster_src" IS NULL AND "poster_alt" IS NULL AND "poster_width" IS NULL AND "poster_height" IS NULL AND "poster_focal_position" IS NULL)
            OR
            ("poster_src" IS NOT NULL AND "poster_alt" IS NOT NULL AND "poster_width" > 0 AND "poster_height" > 0 AND "poster_focal_position" IS NOT NULL)
        ),
    ADD CONSTRAINT "movies_backdrop_metadata_check"
        CHECK (
            ("backdrop_src" IS NULL AND "backdrop_alt" IS NULL AND "backdrop_width" IS NULL AND "backdrop_height" IS NULL AND "backdrop_focal_position" IS NULL)
            OR
            ("backdrop_src" IS NOT NULL AND "backdrop_alt" IS NOT NULL AND "backdrop_width" > 0 AND "backdrop_height" > 0 AND "backdrop_focal_position" IS NOT NULL)
        ),
    ADD CONSTRAINT "movies_local_image_path_check"
        CHECK (
            ("poster_src" IS NULL OR "poster_src" ~ '^/fixtures/catalog/[a-z0-9-]+\.(?:jpg|jpeg|png|webp)$')
            AND
            ("backdrop_src" IS NULL OR "backdrop_src" ~ '^/fixtures/catalog/[a-z0-9-]+\.(?:jpg|jpeg|png|webp)$')
        );

ALTER TABLE "genres"
    ADD CONSTRAINT "genres_slug_format_check"
        CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    ADD CONSTRAINT "genres_name_check"
        CHECK (char_length(btrim("name")) BETWEEN 1 AND 80);

ALTER TABLE "people"
    ADD CONSTRAINT "people_name_check"
        CHECK (char_length(btrim("name")) BETWEEN 1 AND 160),
    ADD CONSTRAINT "people_name_search_check"
        CHECK (char_length(btrim("name_search")) BETWEEN 1 AND 160),
    ADD CONSTRAINT "people_provider_identity_check"
        CHECK (("provider" IS NULL) = ("provider_person_id" IS NULL));

ALTER TABLE "credits"
    ADD CONSTRAINT "credits_billing_order_check"
        CHECK ("billing_order" >= 0);

ALTER TABLE "collections"
    ADD CONSTRAINT "collections_slug_format_check"
        CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    ADD CONSTRAINT "collections_title_check"
        CHECK (char_length(btrim("title")) BETWEEN 1 AND 160),
    ADD CONSTRAINT "collections_display_order_check"
        CHECK ("display_order" >= 0);

ALTER TABLE "collection_movies"
    ADD CONSTRAINT "collection_movies_position_check"
        CHECK ("position" >= 0);

ALTER TABLE "metadata_sources"
    ADD CONSTRAINT "metadata_sources_external_id_check"
        CHECK (char_length(btrim("external_id")) BETWEEN 1 AND 120);

-- CreateIndex
CREATE UNIQUE INDEX "movies_slug_key" ON "movies"("slug");

-- CreateIndex
CREATE INDEX "movies_publication_state_publish_at_idx" ON "movies"("publication_state", "publish_at");

-- CreateIndex
CREATE INDEX "movies_release_date_idx" ON "movies"("release_date");

-- CreateIndex
CREATE INDEX "movies_added_at_idx" ON "movies"("added_at");

-- CreateIndex
CREATE INDEX "movies_title_search_trgm_idx" ON "movies" USING GIN ("title_search" public.gin_trgm_ops);

-- CreateIndex
CREATE INDEX "movies_original_title_search_trgm_idx" ON "movies" USING GIN ("original_title_search" public.gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "genres_slug_key" ON "genres"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "genres_name_key" ON "genres"("name");

-- CreateIndex
CREATE INDEX "movie_genres_genre_id_idx" ON "movie_genres"("genre_id");

-- CreateIndex
CREATE UNIQUE INDEX "people_provider_provider_person_id_key" ON "people"("provider", "provider_person_id");

-- CreateIndex
CREATE INDEX "people_name_search_trgm_idx" ON "people" USING GIN ("name_search" public.gin_trgm_ops);

-- CreateIndex
CREATE INDEX "credits_movie_id_kind_billing_order_idx" ON "credits"("movie_id", "kind", "billing_order");

-- CreateIndex
CREATE INDEX "credits_person_id_idx" ON "credits"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "credits_natural_key" ON "credits" (
    "movie_id",
    "person_id",
    "kind",
    COALESCE("character_name", ''),
    COALESCE("display_label", '')
);

-- CreateIndex
CREATE UNIQUE INDEX "collections_slug_key" ON "collections"("slug");

-- CreateIndex
CREATE INDEX "collections_state_display_order_idx" ON "collections"("state", "display_order");

-- CreateIndex
CREATE INDEX "collection_movies_movie_id_idx" ON "collection_movies"("movie_id");

-- CreateIndex
CREATE UNIQUE INDEX "collection_movies_collection_id_position_key" ON "collection_movies"("collection_id", "position");

-- CreateIndex
CREATE INDEX "metadata_sources_movie_id_idx" ON "metadata_sources"("movie_id");

-- CreateIndex
CREATE UNIQUE INDEX "metadata_sources_movie_id_provider_key" ON "metadata_sources"("movie_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "metadata_sources_provider_external_id_key" ON "metadata_sources"("provider", "external_id");

-- AddForeignKey
ALTER TABLE "movie_genres" ADD CONSTRAINT "movie_genres_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movie_genres" ADD CONSTRAINT "movie_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credits" ADD CONSTRAINT "credits_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credits" ADD CONSTRAINT "credits_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_movies" ADD CONSTRAINT "collection_movies_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_movies" ADD CONSTRAINT "collection_movies_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metadata_sources" ADD CONSTRAINT "metadata_sources_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
