# Environments, Deployment, And Operations

Status: **Operational baseline; provider-specific values remain owner inputs**

## Environment Model

| Environment | Data | Providers | Purpose |
|---|---|---|---|
| Local | Developer PostgreSQL, fictional seed | Provider fakes by default; optional Mux sandbox | Daily development |
| Test/CI | Ephemeral isolated PostgreSQL | Deterministic fakes and synthetic signed webhook fixtures | Automated proof |
| Preview | Isolated preview database or branch | Non-production Mux/email; test ad tag only | Review and staging behavior |
| Production | Dedicated managed PostgreSQL | Production Mux/email/GAM/CMP/telemetry | Licensed public service |

No environment may share a database, signing key, webhook secret, email sender, or asset project with production except production itself. Preview URLs are access-controlled when they expose draft/admin behavior.

## Configuration Ownership

The application validates configuration at startup and exits clearly when a required value is absent. Optional integrations are explicitly enabled; the presence of a credential alone does not enable them.

Configuration groups:

- application: canonical origin, temporary/final site name, environment, log level;
- database: runtime URL and separately scoped migration URL where supported;
- auth/email: auth secret, sender, SMTP/provider credentials, trusted callback origin;
- Mux: API credentials, webhook secret, signing key ID/private key, environment/project marker;
- advertising/consent: feature flag, environment marker, sanitized ad tag configuration, consent policy version;
- territory: supported ISO country allowlist and a non-production-only local default;
- internal jobs: dedicated cron secret, publication cadence, retention cadence, and per-run batch limits;
- metadata: TMDB token and attribution configuration;
- observability: error-reporting DSN, release identifier, sample rates.

Maintain the exact variable names and requirement matrix in `.env.example` and the environment schema once WP-00 introduces them. Never put real values in documentation.

### Foundation Variables

| Variable | Scope | WP-00 behavior |
|---|---|---|
| `NEXT_PUBLIC_SITE_NAME` | Public | Optional display name; defaults to `Film Platform` and is the only browser-exposed configuration value. |
| `DATABASE_URL` | Server | Required by the running application and database checks; must use a PostgreSQL URL. |
| `TEST_DATABASE_URL` | Test process | Optional local override; integration migration refuses database names without the `_test` suffix. |
| `LOG_LEVEL` | Server | Optional owned level: `debug`, `info`, `warn`, or `error`; defaults to `info`. |
| `TRUST_INCOMING_REQUEST_ID` | Server | Defaults to `false`; enable only behind infrastructure that overwrites and validates `X-Request-Id`. |
| `TMDB_ENABLED` | Server | Defaults to `false`; token presence alone never enables metadata requests. |
| `TMDB_API_TOKEN` | Server | Required only when `TMDB_ENABLED=true`; never exposed to browser bundles or logs. |
| `VIDEO_PROVIDER` | Server | Defaults to deterministic `fake`; fake grants are disabled under `NODE_ENV=production`. Production playback selects `mux`, which requires the complete credential set below. |
| `SUPPORTED_TERRITORIES` | Server | Comma-separated ISO 3166-1 alpha-2 allowlist; defaults to `TR`. |
| `LOCAL_DEFAULT_TERRITORY` | Server | Explicit non-production fallback; must be supported and is rejected under `NODE_ENV=production`. |
| `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET` | Server | Mux management credentials, required only when `VIDEO_PROVIDER=mux`. |
| `MUX_WEBHOOK_SECRET` | Server | Mux webhook verification secret, required only when `VIDEO_PROVIDER=mux`. |
| `MUX_SIGNING_KEY_ID`, `MUX_SIGNING_PRIVATE_KEY` | Server | Signed-playback credentials, required only when `VIDEO_PROVIDER=mux`; private key stays server-only. |
| `ADVERTISING_PROVIDER` | Server | Defaults to `disabled`. The deterministic `fake` is allowed only outside production; production rejects every non-disabled value until ADR 0004 is legally reviewed and accepted. |
| `ADVERTISING_TEST_SCENARIO` | Local/test process | Optional fake outcome: `blocked`, `completed`, `empty`, `error`, or `timeout`; rejected unless `ADVERTISING_PROVIDER=fake`. |

Provider-specific variables are added to this matrix by their owning work package. Presence alone never enables an integration.

## Local Operating Contract

After WP-00, the documented path is:

```bash
corepack enable
pnpm install --frozen-lockfile
# Create .env from the placeholder-only .env.example.
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The supported local Compose project binds PostgreSQL to `127.0.0.1:54329` by default and creates isolated `film_platform` and `film_platform_test` databases. `pnpm test:integration` migrates only the `_test` database before running repository assertions.

`pnpm db:up` may wrap the repository's supported local PostgreSQL container configuration. It must not require a globally installed database. Provider fakes are the default so local discovery and browser tests work without Mux, TMDB, email, Google IMA, or ad credentials.

Optional Mux webhook development uses the provider's official forwarding mechanism or an approved HTTPS tunnel. Never disable signature verification for convenience; use the sandbox secret for the forwarded endpoint.

## Deployment Topology

- Deploy the Next.js application to a Vercel-compatible managed runtime.
- Run PostgreSQL in a managed service with point-in-time recovery and connection pooling suited to the runtime.
- Serve media directly from Mux CDN through signed playback, not through the application.
- Use deployment-edge controls for coarse rate limits and request filtering.
- Run schema migrations as an explicit pre-release job with a migration-capable database identity.
- Run the application with a least-privilege runtime identity that cannot alter schema.
- Invoke `/api/internal/publish-due` every minute and `/api/internal/run-retention` daily through Vercel Cron using the dedicated bearer secret. Jobs remain inside the deployed monolith and tolerate overlap.

An alternative host, database, or video provider requires an ADR and a staging rehearsal of caching, IP/territory trust, webhook delivery, connection behavior, and rollback.

## Release Procedure

1. Confirm the target work package and release notes are complete.
2. Verify frozen install, lint, typecheck, unit/component, integration, build, browser, accessibility, visual, and security gates.
3. Review generated migration SQL, lock risk, data backfill, and forward-fix plan.
4. Confirm configuration validation against the target environment without printing values.
5. Confirm playable titles have active rights and ready assets in the target territory.
6. Deploy/migrate preview or staging, run smoke journeys, inspect logs/metrics, and verify Mux webhook delivery.
7. Invoke scheduled publication and retention jobs in fixture scenarios; verify authentication, idempotency, system audit, and bounded batching.
8. Run the migration job, then deploy production using immutable build output.
9. Run read-only production smoke checks for home, search, detail, playback grant, auth callback, health, and admin authorization.
10. Observe error, latency, playback-denial, webhook, scheduled-job, retention, and ad-failure signals through the defined window.

Do not seed production with fictional development accounts or content.

## Rollback And Forward Fix

- Application rollback uses the last known compatible immutable build.
- Database changes are designed for compatibility with the previous and next application version.
- Prefer forward fixes for applied data/schema changes. Never run an untested down migration on production.
- Provider feature flags can disable ads, metadata import, member writes, or new asset ingestion independently. Rights checks and signed playback are never bypassed by a kill switch.
- An advertising incident disables the ad opportunity and keeps eligible content available.
- A playback-security or rights incident disables new playback grants for affected content or globally until verified.

## Observability

### Structured Events

Record redacted, schema-owned events for:

- HTTP request completion and Problem Details code;
- catalog query duration/result count;
- playback policy outcome by coarse reason, grant creation latency, and provider outcome;
- ad opportunity, start, complete, empty, blocked, timeout, and SDK error without user/profile data;
- webhook verification, duplicate, mapping, and processing result;
- auth result and session revocation without token or full email;
- privileged command and audit-event ID;
- scheduled-publication/retention run ID, counts, duration, and coarse failure codes;
- database/provider timeout and retry exhaustion.

Use request ID, playback session ID, and owned entity IDs for correlation. Do not record signed playback tokens, cookies, secrets, raw webhook bodies, full ad tags, exact IP addresses beyond approved security retention, or viewing history in general-purpose logs.

### Initial Service Objectives

| Signal | Initial target |
|---|---:|
| Public web availability | 99.5% monthly |
| Playback-session success for policy-eligible requests | 99.5% excluding documented provider outage |
| Playback-session application p95 | <= 300ms excluding provider latency |
| Search suggestion warm p95 | <= 250ms |
| Verified webhook processing | 99% within 60 seconds of receipt |
| Server `5xx` rate | < 1% over 15 minutes |

These are initial operating targets, not contractual promises. Revise them from measured production data through an ADR or operational review.

### Alerts

Page an operator for sustained playback-grant failure, signature verification anomalies, broad rights denials after a catalog change, database unavailability, or production secret exposure. Create non-page alerts for ad-provider failure, metadata import failure, elevated search latency, and asset-processing delay.

Alert on repeated scheduled-publication authentication/run failure, a growing due-film backlog, or a retention job missing its completion window. Do not page for one film that safely remains scheduled after validation failure; route that record to the admin workflow with a coarse reason.

Each alert links to a runbook and names an owner before production launch.

## Runbooks

### Film Unexpectedly Unavailable

1. Correlate the request ID and movie ID without asking for a token.
2. Check editorial state, rights territory/time, active asset, provider readiness, and signing health in that order.
3. If rights are uncertain, leave playback denied and contact the content owner.
4. If provider readiness differs from owned state, run the approved reconciliation path; do not edit the database manually.
5. Record the resolution and audit any administrative state change.

### Suspected Unauthorized Or Expired Content

1. Disable new grants by unpublishing or changing the allow right through the audited admin command.
2. Preserve rights evidence and relevant audit IDs; do not copy media or personal data into tickets.
3. Notify the designated rights/takedown owner.
4. Verify public catalog, search, sitemap, cache invalidation, and playback denial.
5. Republish only after documented approval.

### Mux Asset Stuck Or Webhook Missing

1. Inspect verified webhook receipt and provider asset status through the adapter/reconciliation tool.
2. Confirm webhook endpoint, secret version, delivery attempts, and signature clock tolerance.
3. Reconcile idempotently by provider asset ID; never replay an edited payload.
4. Keep the film unplayable until an owned `READY` state is committed.

### Advertising Outage

1. Confirm consent state and ad configuration without logging the full tag.
2. Measure empty/error/timeout rates and check provider status.
3. Disable the advertising feature flag if failures degrade playback.
4. Verify eligible content starts without a retry loop and that optional tracking stops.
5. Re-enable first in preview with test tags.

### Scheduled Film Did Not Publish

1. Check cron authentication and the last successful run before inspecting the film.
2. Verify `publishAt`, current editorial completeness, supported-territory rights, active ready asset, and system audit outcome.
3. Correct catalog state through audited admin commands; never force the database state to `PUBLISHED`.
4. Invoke the idempotent command in preview/test or wait for the next production run according to access policy.
5. Verify one publication event, cache invalidation after commit, catalog visibility, and playback eligibility.

### Account Purge Delayed

1. Confirm the deletion request is at least 30 days old and sign-in/session revocation remains effective.
2. Inspect the retention run ID and coarse failure without exposing the email or member history.
3. Retry the idempotent bounded purge command after resolving the dependency failure.
4. Verify auth/profile/library removal, nullable audit actor unlinking, and deletion replay metadata needed for backup restores.

### Secret Exposure

1. Treat the value as compromised; disable or rotate it at the provider immediately.
2. Revoke sessions/grants or redeploy affected configuration as appropriate.
3. Search approved source and log scopes for exposure without printing the secret.
4. Purge accessible artifacts where supported and document the exposure window.
5. Add a preventive test or process correction before closure.

### Failed Migration

1. Stop rollout and preserve migration/application logs.
2. Determine whether the migration transaction committed; do not rerun blindly.
3. Keep or restore the last compatible application build.
4. Apply the rehearsed forward fix or provider-supported recovery path.
5. Verify schema state, data invariants, health, and critical journeys before resuming.

## Backup And Recovery

- Enable encrypted automated backups and point-in-time recovery for production PostgreSQL.
- Define RPO/RTO with the owner before launch; initial engineering target is RPO <= 24 hours and RTO <= 4 hours.
- Perform a restore into an isolated non-production environment before launch and on a recurring schedule.
- Verify migrations, catalog counts, rights invariants, member-data protections, and pending deletion replay after restore.
- Provider-hosted media recovery and retention follow the Mux account policy and content-owner agreements; database backup alone is not a media backup.

## Operational Launch Blockers

Production remains blocked until the final domain/brand, content rights, privacy/terms/takedown text, CMP/ad approval, provider projects, secrets, rate limits, alert owners, backup restore, and full WP-07 evidence are complete.