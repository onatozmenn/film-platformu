-- EnableExtension
CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA public;

-- CreateEnum
CREATE TYPE "VideoProvider" AS ENUM ('MUX');

-- CreateEnum
CREATE TYPE "VideoAssetState" AS ENUM ('PREPARING', 'READY', 'ERRORED', 'DISABLED');

-- CreateEnum
CREATE TYPE "SubtitleKind" AS ENUM ('SUBTITLES', 'CAPTIONS', 'FORCED');

-- CreateTable
CREATE TABLE "video_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "movie_id" UUID NOT NULL,
    "provider" "VideoProvider" NOT NULL,
    "provider_asset_id" VARCHAR(120) NOT NULL,
    "provider_playback_id" VARCHAR(120),
    "state" "VideoAssetState" NOT NULL DEFAULT 'PREPARING',
    "duration_seconds" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "video_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subtitle_tracks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "video_asset_id" UUID NOT NULL,
    "language_tag" VARCHAR(35) NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "kind" "SubtitleKind" NOT NULL,
    "provider_track_id" VARCHAR(120) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "subtitle_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_rights" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "movie_id" UUID NOT NULL,
    "territory" CHAR(2) NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "allow_streaming" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "content_rights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_webhooks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" "VideoProvider" NOT NULL,
    "provider_event_id" VARCHAR(160) NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "processed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_webhooks_pkey" PRIMARY KEY ("id")
);

-- Playback invariants that Prisma cannot express
ALTER TABLE "video_assets"
    ADD CONSTRAINT "video_assets_provider_asset_id_check"
        CHECK (char_length(btrim("provider_asset_id")) BETWEEN 1 AND 120),
    ADD CONSTRAINT "video_assets_provider_playback_id_check"
        CHECK ("provider_playback_id" IS NULL OR char_length(btrim("provider_playback_id")) BETWEEN 1 AND 120),
    ADD CONSTRAINT "video_assets_duration_seconds_check"
        CHECK ("duration_seconds" IS NULL OR "duration_seconds" > 0),
    ADD CONSTRAINT "video_assets_resolution_check"
        CHECK (
            ("width" IS NULL AND "height" IS NULL)
            OR ("width" > 0 AND "height" > 0)
        ),
    ADD CONSTRAINT "video_assets_active_ready_check"
        CHECK (
            NOT "is_active"
            OR (
                "state" = 'READY'
                AND "provider_playback_id" IS NOT NULL
                AND "duration_seconds" > 0
            )
        );

ALTER TABLE "subtitle_tracks"
    ADD CONSTRAINT "subtitle_tracks_language_tag_check"
        CHECK ("language_tag" ~ '^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$'),
    ADD CONSTRAINT "subtitle_tracks_label_check"
        CHECK (char_length(btrim("label")) BETWEEN 1 AND 80),
    ADD CONSTRAINT "subtitle_tracks_provider_track_id_check"
        CHECK (char_length(btrim("provider_track_id")) BETWEEN 1 AND 120);

ALTER TABLE "content_rights"
    ADD CONSTRAINT "content_rights_territory_check"
        CHECK ("territory" ~ '^[A-Z]{2}$'),
    ADD CONSTRAINT "content_rights_window_check"
        CHECK ("starts_at" < "ends_at"),
    ADD CONSTRAINT "content_rights_no_contradictory_overlap"
        EXCLUDE USING gist (
            "movie_id" WITH =,
            "territory" WITH =,
            tstzrange("starts_at", "ends_at", '[)') WITH &&,
            "allow_streaming" WITH <>
        );

ALTER TABLE "processed_webhooks"
    ADD CONSTRAINT "processed_webhooks_provider_event_id_check"
        CHECK (char_length(btrim("provider_event_id")) BETWEEN 1 AND 160),
    ADD CONSTRAINT "processed_webhooks_event_type_check"
        CHECK (char_length(btrim("event_type")) BETWEEN 1 AND 120);

-- CreateIndex
CREATE INDEX "video_assets_movie_id_state_idx" ON "video_assets"("movie_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "video_assets_one_active_per_movie" ON "video_assets"("movie_id") WHERE "is_active";

-- CreateIndex
CREATE UNIQUE INDEX "video_assets_provider_provider_asset_id_key" ON "video_assets"("provider", "provider_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "video_assets_provider_provider_playback_id_key" ON "video_assets"("provider", "provider_playback_id");

-- CreateIndex
CREATE INDEX "subtitle_tracks_video_asset_id_idx" ON "subtitle_tracks"("video_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "subtitle_tracks_one_default_per_asset" ON "subtitle_tracks"("video_asset_id") WHERE "is_default";

-- CreateIndex
CREATE UNIQUE INDEX "subtitle_tracks_asset_language_kind_key" ON "subtitle_tracks"("video_asset_id", "language_tag", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "subtitle_tracks_asset_provider_track_id_key" ON "subtitle_tracks"("video_asset_id", "provider_track_id");

-- CreateIndex
CREATE INDEX "content_rights_movie_territory_window_idx" ON "content_rights"("movie_id", "territory", "starts_at", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "processed_webhooks_provider_event_id_key" ON "processed_webhooks"("provider_event_id");

-- CreateIndex
CREATE INDEX "processed_webhooks_processed_at_idx" ON "processed_webhooks"("processed_at");

-- AddForeignKey
ALTER TABLE "video_assets" ADD CONSTRAINT "video_assets_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtitle_tracks" ADD CONSTRAINT "subtitle_tracks_video_asset_id_fkey" FOREIGN KEY ("video_asset_id") REFERENCES "video_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_rights" ADD CONSTRAINT "content_rights_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
