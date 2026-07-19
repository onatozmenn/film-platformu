-- CreateEnum
CREATE TYPE "UserRoleName" AS ENUM ('MEMBER', 'EDITOR', 'ADMIN');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(160),
    "email" VARCHAR(320),
    "email_verified" TIMESTAMPTZ(3),
    "image" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" VARCHAR(32) NOT NULL,
    "provider" VARCHAR(80) NOT NULL,
    "provider_account_id" VARCHAR(191) NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" VARCHAR(80),
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" VARCHAR(255),

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_token" VARCHAR(255) NOT NULL,
    "user_id" UUID NOT NULL,
    "expires" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" VARCHAR(320) NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "expires" TIMESTAMPTZ(3) NOT NULL
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "user_id" UUID NOT NULL,
    "display_name" VARCHAR(80) NOT NULL,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'tr-TR',
    "disabled_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role" "UserRoleName" NOT NULL,
    "granted_by" UUID,
    "granted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role")
);

-- CreateTable
CREATE TABLE "account_deletion_requests" (
    "user_id" UUID NOT NULL,
    "requested_at" TIMESTAMPTZ(3) NOT NULL,
    "purge_after" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "account_deletion_requests_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "watchlist_entries" (
    "user_id" UUID NOT NULL,
    "movie_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watchlist_entries_pkey" PRIMARY KEY ("user_id","movie_id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "user_id" UUID NOT NULL,
    "movie_id" UUID NOT NULL,
    "value_half_stars" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("user_id","movie_id")
);

-- CreateTable
CREATE TABLE "watch_progress" (
    "user_id" UUID NOT NULL,
    "movie_id" UUID NOT NULL,
    "position_seconds" DOUBLE PRECISION NOT NULL,
    "duration_seconds" DOUBLE PRECISION NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "observed_at" TIMESTAMPTZ(3) NOT NULL,
    "last_watched_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "watch_progress_pkey" PRIMARY KEY ("user_id","movie_id")
);

-- Identity and member-library invariants that Prisma cannot express
ALTER TABLE "users"
    ADD CONSTRAINT "users_name_check"
        CHECK ("name" IS NULL OR char_length(btrim("name")) BETWEEN 1 AND 160),
    ADD CONSTRAINT "users_email_check"
        CHECK (
            "email" IS NULL
            OR (
                "email" = btrim("email")
                AND "email" = lower("email")
                AND char_length("email") BETWEEN 3 AND 320
            )
        );

ALTER TABLE "accounts"
    ADD CONSTRAINT "accounts_type_check"
        CHECK (char_length(btrim("type")) BETWEEN 1 AND 32),
    ADD CONSTRAINT "accounts_provider_check"
        CHECK (char_length(btrim("provider")) BETWEEN 1 AND 80),
    ADD CONSTRAINT "accounts_provider_account_id_check"
        CHECK (char_length(btrim("provider_account_id")) BETWEEN 1 AND 191);

ALTER TABLE "sessions"
    ADD CONSTRAINT "sessions_session_token_check"
        CHECK (char_length(btrim("session_token")) BETWEEN 32 AND 255);

ALTER TABLE "verification_tokens"
    ADD CONSTRAINT "verification_tokens_identifier_check"
        CHECK (char_length(btrim("identifier")) BETWEEN 3 AND 320),
    ADD CONSTRAINT "verification_tokens_token_check"
        CHECK (char_length(btrim("token")) BETWEEN 32 AND 255);

ALTER TABLE "user_profiles"
    ADD CONSTRAINT "user_profiles_display_name_check"
        CHECK (char_length(btrim("display_name")) BETWEEN 1 AND 80),
    ADD CONSTRAINT "user_profiles_locale_check"
        CHECK ("locale" = 'tr-TR'),
    ADD CONSTRAINT "user_profiles_deletion_state_check"
        CHECK (
            "deleted_at" IS NULL
            OR (
                "disabled_at" IS NOT NULL
                AND "deleted_at" >= "disabled_at"
            )
        );

ALTER TABLE "account_deletion_requests"
    ADD CONSTRAINT "account_deletion_requests_window_check"
        CHECK ("purge_after" >= "requested_at" + INTERVAL '30 days'),
    ADD CONSTRAINT "account_deletion_requests_completion_check"
        CHECK ("completed_at" IS NULL OR "completed_at" >= "requested_at");

ALTER TABLE "ratings"
    ADD CONSTRAINT "ratings_value_half_stars_check"
        CHECK ("value_half_stars" BETWEEN 1 AND 10);

ALTER TABLE "watch_progress"
    ADD CONSTRAINT "watch_progress_position_check"
        CHECK (
            "position_seconds" <> 'NaN'::double precision
            AND "position_seconds" >= 0
            AND "position_seconds" < 'Infinity'::double precision
        ),
    ADD CONSTRAINT "watch_progress_duration_check"
        CHECK (
            "duration_seconds" <> 'NaN'::double precision
            AND "duration_seconds" > 0
            AND "duration_seconds" < 'Infinity'::double precision
        ),
    ADD CONSTRAINT "watch_progress_clamped_check"
        CHECK ("position_seconds" <= "duration_seconds");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_idx" ON "sessions"("expires");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE INDEX "verification_tokens_expires_idx" ON "verification_tokens"("expires");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "user_profiles_account_state_idx" ON "user_profiles"("disabled_at", "deleted_at");

-- CreateIndex
CREATE INDEX "user_roles_role_user_id_idx" ON "user_roles"("role", "user_id");

-- CreateIndex
CREATE INDEX "user_roles_granted_by_idx" ON "user_roles"("granted_by");

-- CreateIndex
CREATE INDEX "account_deletion_requests_due_idx" ON "account_deletion_requests"("completed_at", "purge_after");

-- CreateIndex
CREATE INDEX "watchlist_entries_user_id_created_at_idx" ON "watchlist_entries"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "watchlist_entries_movie_id_idx" ON "watchlist_entries"("movie_id");

-- CreateIndex
CREATE INDEX "ratings_movie_id_idx" ON "ratings"("movie_id");

-- CreateIndex
CREATE INDEX "watch_progress_user_id_last_watched_at_idx" ON "watch_progress"("user_id", "last_watched_at" DESC);

-- CreateIndex
CREATE INDEX "watch_progress_movie_id_idx" ON "watch_progress"("movie_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_entries" ADD CONSTRAINT "watchlist_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_entries" ADD CONSTRAINT "watchlist_entries_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
