CREATE TYPE "PublicationFailureCode" AS ENUM (
    'CONTENT_INCOMPLETE',
    'RIGHTS_UNAVAILABLE',
    'ASSET_UNAVAILABLE'
);

CREATE TYPE "AuditActorType" AS ENUM ('USER', 'SYSTEM');

ALTER TABLE "movies"
    ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "first_published_at" TIMESTAMPTZ(3),
    ADD COLUMN "last_publish_failure" "PublicationFailureCode",
    ADD COLUMN "last_publish_attempt_at" TIMESTAMPTZ(3);

UPDATE "movies"
SET "first_published_at" = "created_at"
WHERE "publication_state" IN ('PUBLISHED', 'UNPUBLISHED');

ALTER TABLE "movies"
    ADD CONSTRAINT "movies_revision_check"
        CHECK ("revision" > 0),
    ADD CONSTRAINT "movies_publication_history_check"
        CHECK (
            "publication_state" NOT IN ('PUBLISHED', 'UNPUBLISHED')
            OR "first_published_at" IS NOT NULL
        ),
    ADD CONSTRAINT "movies_publish_failure_pair_check"
        CHECK (("last_publish_failure" IS NULL) = ("last_publish_attempt_at" IS NULL)),
    ADD CONSTRAINT "movies_publish_failure_state_check"
        CHECK ("last_publish_failure" IS NULL OR "publication_state" = 'SCHEDULED');

CREATE FUNCTION "prevent_published_movie_slug_change"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD."first_published_at" IS NOT NULL AND NEW."slug" IS DISTINCT FROM OLD."slug" THEN
        RAISE EXCEPTION 'movie slug is immutable after first publication'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "movies_slug_immutable_after_publication"
BEFORE UPDATE OF "slug" ON "movies"
FOR EACH ROW
EXECUTE FUNCTION "prevent_published_movie_slug_change"();

ALTER TABLE "collections"
    ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
    ADD CONSTRAINT "collections_revision_check" CHECK ("revision" > 0);

ALTER TABLE "content_rights"
    ADD COLUMN "evidence_reference" VARCHAR(160),
    ADD CONSTRAINT "content_rights_evidence_reference_check"
        CHECK (
            "evidence_reference" IS NULL
            OR (
                char_length(btrim("evidence_reference")) BETWEEN 3 AND 160
                AND "evidence_reference" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]*$'
            )
        );

CREATE TABLE "audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_type" "AuditActorType" NOT NULL,
    "actor_user_id" UUID,
    "action" VARCHAR(80) NOT NULL,
    "target_type" VARCHAR(40) NOT NULL,
    "target_id" UUID NOT NULL,
    "request_id" VARCHAR(128) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "audit_events_system_actor_check"
        CHECK ("actor_type" <> 'SYSTEM' OR "actor_user_id" IS NULL),
    CONSTRAINT "audit_events_action_check"
        CHECK ("action" ~ '^[A-Z][A-Z0-9_]{1,79}$'),
    CONSTRAINT "audit_events_target_type_check"
        CHECK ("target_type" ~ '^[A-Z][A-Z0-9_]{1,39}$'),
    CONSTRAINT "audit_events_request_id_check"
        CHECK ("request_id" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
    CONSTRAINT "audit_events_metadata_check"
        CHECK (
            jsonb_typeof("metadata") = 'object'
            AND octet_length("metadata"::text) <= 4096
        )
);

CREATE INDEX "audit_events_target_created_at_idx"
    ON "audit_events"("target_type", "target_id", "created_at" DESC);
CREATE INDEX "audit_events_actor_created_at_idx"
    ON "audit_events"("actor_user_id", "created_at" DESC);
CREATE INDEX "audit_events_created_at_idx" ON "audit_events"("created_at");

ALTER TABLE "audit_events"
    ADD CONSTRAINT "audit_events_actor_user_id_fkey"
        FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;