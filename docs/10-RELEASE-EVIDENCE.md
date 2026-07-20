# Release And Compliance Evidence

Status: **Repository-controlled release gates implemented; owner and provider evidence pending**

This document describes engineering evidence, not legal advice or owner approval. It contains no production value, credential, rights proof, legal copy, or personal data.

## Immutable Workflow Gates

| Workflow | Purpose | Protected environment |
|---|---|---|
| `CI` | Frozen install, tracked-secret and dependency scans, migrations, formatting, lint, types, unit/component coverage, PostgreSQL integration, database state, build, budgets, and browser journeys | None |
| `Release readiness` | Reuses the exact CI workflow, emits a CycloneDX JSON SBOM, checks runtime database privileges, audits aggregate catalog rights, and evaluates production configuration plus owner references | `production` |
| `Deploy database migrations` | Applies forward-only reviewed migrations with a migration-capable identity after the operator types the exact application SHA | `production-migrations` |
| `Verify restored database` | Migrates an isolated database ending in `_restore` and checks aggregate restore/deletion/admin/publication invariants | `restore-verification` |
| `Staging rehearsal` | Runs read-only mobile/desktop health, crawler, discovery, licensed watch, CSP, accessibility, and private-boundary smoke against the exact deployed SHA | `staging` |

The protected environments, required reviewers, secrets, and variables are owner-managed GitHub settings. The repository cannot assert that those controls exist until a workflow run proves them.

## Production Evidence Manifest

`config/production-release-evidence.example.json` is a null-only template. A real manifest stays outside Git and is supplied through exactly one of `PRODUCTION_RELEASE_EVIDENCE_FILE` or `PRODUCTION_RELEASE_EVIDENCE_JSON`. Values are bounded references such as an approval ticket, runbook, dashboard, or evidence URL without query credentials; copied legal text, tokens, and rights documents are rejected.

Required references:

| Field | Evidence represented |
|---|---|
| `brandApprovalReference` | Final name/logo/metadata approval |
| `cspReviewReference` | Staging CSP report review before enforcement |
| `domainTlsReference` | Canonical domain and HTTPS verification |
| `databaseIsolationReference` | Preview/runtime/migration/restore database separation |
| `edgeProtectionReference` | Deployment-edge abuse controls and rate limits |
| `rightsCatalogReference` | Owner-reviewed external rights catalog for launch titles |
| `legalApprovalReference` | Reviewed privacy, terms, consent/cookie, takedown, and age-policy copy |
| `supportContactReference` | Final public support/takedown contact approval |
| `tmdbAttributionReference` | Approved TMDB attribution treatment and asset |
| `advertisingApprovalReference` | Accepted CMP/legal/GAM/ads.txt decision |
| `cronMonitoringReference` | Publication and retention schedule/run monitoring |
| `observabilityReference` | Error/latency/playback/webhook/job signal destination |
| `alertingReference` | Named alert owner and linked runbooks |
| `secretManagerReference` | Production/preview secret isolation and rotation ownership |
| `backupRestoreReference` | Completed isolated restore with deletion replay evidence |
| `stagingRehearsalReference` | Full staging launch rehearsal |
| `rollbackRehearsalReference` | Immutable application rollback and database forward-fix exercise |
| `ownerAcceptanceReference` | Final owner acceptance |

## Approved Public Content

`src/content/approved-public-content.json` is intentionally null until the owner supplies reviewed brand, privacy, terms, consent, support/takedown, and TMDB attribution content plus local brand/provider art. The strict parser rejects HTML and unknown fields. Pending sections return `404`, remain absent from the footer and sitemap, and keep production readiness red. Supplying a reference in the evidence manifest does not bypass the content completeness check.

## Data And Privacy Inventory

| Data | Purpose and location | Engineering deletion/retention behavior | External disclosure |
|---|---|---|---|
| Email, Auth.js accounts/sessions/links | Optional sign-in in PostgreSQL | Links expire in 10 minutes; sessions expire in 30 days; disable/delete revokes immediately; final purge at 30 days | SMTP provider only when enabled |
| Profile, watchlist, half-star rating, progress | Member library in PostgreSQL | Member can clear history; irreversible deletion purges at the documented boundary | Not sent to advertising or metadata providers |
| Guest progress | Versioned bounded browser local storage | Device-local; never presented as synchronized | None |
| Consent and ad outcome | Owned consent state and coarse outcome | No optional request/storage before consent; no title, user, email, or history in outcome logs | Approved CMP/GAM only after ADR/legal approval |
| Audit events | Immutable privileged-operation facts | PII is excluded; actor FK becomes null on purge | Operator-only audit view |
| Verified webhook IDs | Idempotency and provider state | Contains provider event identity and owned kind, not raw payload | Mux operational boundary |
| Deletion replay markers | Backup-restore-safe purge replay | Non-PII marker retained for idempotent replay | None |
| Structured logs | Request/security/provider/job operations | Redacted; carry release/request IDs; final retention and exact-IP policy require owner/legal approval | Owner-selected observability destination |
| Database backups | Recovery | Encryption/PITR and recurring restore required; final RPO/RTO and retention require owner approval | Managed database provider |

Unknown log, audit, webhook, and backup retention periods remain launch blockers. This inventory does not replace the reviewed public privacy notice.

## Current Hard Blockers

- ADR 0004 remains `Proposed`; the application rejects enabled production advertising, and readiness therefore reports `ADVERTISING_DISABLED`.
- Final brand, legal/support copy, TMDB attribution treatment, domain, and public assets are absent; approved public content remains null.
- Production Mux, SMTP, TMDB, database, cron, and secret-manager values are not present in Git.
- Edge controls, observability destinations, alert owners, dashboards, and protected GitHub Environment rules are not externally verified.
- No isolated backup restore, staging rehearsal, migration/forward-fix exercise, production smoke, or owner acceptance has been performed.
- The development catalog has a hash-validated demo manifest for four Blender open movies: three CC BY 3.0 titles and one CC BY 2.5 title. The safe-default importer verifies official sources without writing and requires explicit `--apply` for billable Mux ingest. This repository evidence does not replace the owner-reviewed production rights catalog; production approval remains external.

Production remains blocked until every readiness issue is cleared by real evidence and the exact release SHA passes the protected workflows.