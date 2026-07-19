CREATE FUNCTION "enforce_audit_event_immutability"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE'
        AND OLD."actor_user_id" IS NOT NULL
        AND NEW."actor_user_id" IS NULL
        AND NEW."id" IS NOT DISTINCT FROM OLD."id"
        AND NEW."actor_type" IS NOT DISTINCT FROM OLD."actor_type"
        AND NEW."action" IS NOT DISTINCT FROM OLD."action"
        AND NEW."target_type" IS NOT DISTINCT FROM OLD."target_type"
        AND NEW."target_id" IS NOT DISTINCT FROM OLD."target_id"
        AND NEW."request_id" IS NOT DISTINCT FROM OLD."request_id"
        AND NEW."metadata" IS NOT DISTINCT FROM OLD."metadata"
        AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at"
    THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'audit events are immutable'
        USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "audit_events_immutable"
BEFORE UPDATE OR DELETE ON "audit_events"
FOR EACH ROW
EXECUTE FUNCTION "enforce_audit_event_immutability"();