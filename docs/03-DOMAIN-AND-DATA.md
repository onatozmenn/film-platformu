# Domain And Data Model

Status: **Approved logical model**. The initial Prisma migration must preserve these names and invariants unless an ADR records a deliberate change.

## Modeling Rules

- Use PostgreSQL UUID primary keys generated server-side.
- Store timestamps as timezone-aware UTC values and render them in the user's locale.
- Generate a movie slug from the title with `toLocaleLowerCase('tr-TR')`, map Turkish dotless `ı` to `i`, normalize to NFKD, remove combining marks, replace non-ASCII alphanumeric runs with one hyphen, trim hyphens, and cap the final value at 96 characters. On collision, append the four-digit release year when available, then `-2`, `-3`, and so on while truncating the base to preserve the cap. A slug may be edited only while `DRAFT`; it never changes automatically with the title and is immutable after first publication.
- Use owned enums for closed workflow states. Do not store provider status strings directly in domain columns.
- Store money only if a later approved payment feature introduces it; the MVP has no price fields.
- Store provider identifiers, not provider secrets or raw video URLs.
- Prefer normalized relational data for filterable concepts. Use JSON only for immutable provider snapshots, audit metadata, or genuinely unstructured optional data.
- All user-owned records enforce ownership in the application service and the database query predicate.

## Modules And Records

### Identity

Auth.js owns its adapter tables. Domain-facing identity records are:

| Record | Required fields and constraints |
|---|---|
| `UserProfile` | `userId` unique FK, `displayName`, `locale` default `tr-TR`, nullable `disabledAt`, nullable `deletedAt`, timestamps |
| `UserRole` | composite unique `(userId, role)`, role in `MEMBER`, `EDITOR`, `ADMIN`, `grantedBy`, `grantedAt` |

Every active account has the effective `MEMBER` capability; privileged roles are explicit rows. Deleted or disabled users cannot obtain new sessions. The system must retain at least one non-disabled, non-deleted user with `ADMIN`. Role revocation, account disablement, and account deletion recheck that invariant in a PostgreSQL `SERIALIZABLE` transaction with bounded retry on serialization failure; concurrent operations cannot reduce the active-admin count to zero.

### Catalog

| Record | Required fields and constraints |
|---|---|
| `Movie` | `id`, unique normalized `slug`, `title`, nullable `originalTitle`, `synopsis`, `releaseDate`, `runtimeMinutes > 0`, nullable `ageRating`, poster/backdrop references, `publicationState`, nullable `publishAt`, timestamps |
| `Genre` | `id`, unique `slug`, unique Turkish `name` |
| `MovieGenre` | composite PK `(movieId, genreId)` |
| `Person` | `id`, `name`, nullable provider identity and profile image reference |
| `Credit` | `id`, `movieId`, `personId`, `kind`, nullable `characterName`, `billingOrder >= 0`; unique natural combination per film |
| `Collection` | `id`, unique `slug`, `title`, nullable `description`, `state`, display metadata |
| `CollectionMovie` | composite unique `(collectionId, movieId)`, unique `(collectionId, position)` |
| `MetadataSource` | `movieId`, provider enum, external ID, last import time; unique `(provider, externalId)` |

`Credit.kind` is one of `DIRECTOR`, `WRITER`, `CAST`, or `OTHER` for MVP. Provider imports map richer values into these owned categories while retaining an optional display label.

### Playback

| Record | Required fields and constraints |
|---|---|
| `VideoAsset` | `id`, `movieId`, provider, unique provider asset ID, provider playback ID, owned `state`, duration, optional resolution metadata, timestamps |
| `SubtitleTrack` | `id`, `videoAssetId`, BCP 47 `languageTag`, label, `kind`, provider track ID, `isDefault`; unique `(videoAssetId, languageTag, kind)` |
| `ContentRight` | `id`, `movieId`, ISO 3166-1 alpha-2 territory, `startsAt`, `endsAt`, `allowStreaming`; no overlapping contradictory windows for the same movie and territory |
| `ProcessedWebhook` | unique provider event ID, event type, processed timestamp; retained for idempotency |

`SubtitleTrack.kind` is `SUBTITLES`, `CAPTIONS`, or `FORCED`. Subtitles translate dialogue, captions include relevant sound information, and forced tracks translate only essential foreign-language/on-screen text. Tracks are optional for publication. At most one track per video asset is default; the player lists all tracks using their owned label and does not silently substitute one kind for another.

`VideoAsset.state` is `PREPARING`, `READY`, `ERRORED`, or `DISABLED`, with a separate `isActive` designation. Provider events may move `PREPARING` to `READY` or `ERRORED`; a verified terminal provider failure may move `READY` to `ERRORED`; an admin or verified provider deletion may move any non-disabled state to terminal `DISABLED`. No automatic event moves `ERRORED` or `DISABLED` back to a usable state, and `READY` never regresses to `PREPARING`. Multiple historical assets may remain `READY`, but exactly zero or one asset per movie is active and an active asset must be `READY`.

Playback sessions and signed grants are short-lived and are not persisted in the primary database for MVP. Their identifiers are random, non-meaningful, and included in coarse telemetry only.

### Member Library

| Record | Required fields and constraints |
|---|---|
| `WatchlistEntry` | composite PK `(userId, movieId)`, `createdAt` |
| `Rating` | composite PK `(userId, movieId)`, integer `valueHalfStars` from 1 through 10, timestamps |
| `WatchProgress` | composite PK `(userId, movieId)`, `positionSeconds >= 0`, `durationSeconds > 0`, `completed`, `lastWatchedAt`, timestamps |

The public rating value is `valueHalfStars / 2`. Store the integer to avoid floating-point ambiguity.

### Audit

| Record | Required fields and constraints |
|---|---|
| `AuditEvent` | `id`, `actorType` (`USER` or `SYSTEM`), nullable actor user ID, action enum/string, target type and ID, request ID, redacted JSON metadata, immutable `createdAt` |

Audit rows are append-only at the application layer. A scheduled command records `SYSTEM`; a user action requires its actor ID. Application credentials, tokens, complete webhook payloads, signed URLs, email addresses, display names, and synopsis/body copies do not belong in audit metadata. Account purge may set the nullable actor FK to null through the retention path while preserving the event and its non-personal target/action facts.

## Core Invariants

### Editorial State

MVP states are `DRAFT`, `SCHEDULED`, `PUBLISHED`, and `UNPUBLISHED`. `IN_REVIEW` is deliberately absent.

- An editor/admin may move `DRAFT` to `PUBLISHED` after current publication checks pass, or to `SCHEDULED` after checks pass for `publishAt`.
- An editor/admin may return `SCHEDULED` to `DRAFT` or publish it early after current checks pass.
- The `SYSTEM` scheduled command may move a due `SCHEDULED` film to `PUBLISHED` only after rechecking current completeness, rights, and asset state.
- An editor/admin may move `PUBLISHED` to `UNPUBLISHED`; returning to public availability always re-runs publication checks.
- `UNPUBLISHED` may return to `DRAFT` for editing. No state transition hard-deletes a film.

### Watchability

A film is watchable only if all conditions are true at the same instant:

```text
Movie.publicationState == PUBLISHED
AND (Movie.publishAt is null OR Movie.publishAt <= now)
AND an active ContentRight allows streaming in the resolved territory at now
AND an active VideoAsset.state == READY
AND the video provider can issue a signed grant
```

The catalog may display a published but temporarily unplayable film only when product copy explicitly labels it unavailable; the watch action must be absent. Search and recommendations never include drafts.

### Rights Window

- A right is active when `startsAt <= now < endsAt`; the end is exclusive.
- `startsAt` must be earlier than `endsAt`.
- Territory resolution is server-owned. Do not trust a territory sent in the request body.
- MVP launches with an explicit allowlist of territories. Missing territory or right means playback denied.

### Publication

- `PUBLISHED` requires a trimmed title of 1-160 characters, a trimmed synopsis of 10-5000 characters, a valid release date, positive runtime, one validated poster reference, one validated backdrop reference, at least one genre, an active allow right in at least one supported territory, and exactly one active `READY` asset.
- Poster/backdrop references must come from an owned local asset or an allowlisted metadata/image provider path validated at import. Publication never performs an arbitrary remote URL fetch. Stored image metadata must let the UI reserve a 2:3 poster and wide backdrop without layout shift.
- Original title, age rating, credits, and subtitle tracks are optional. If tracks exist, zero or one may be default.
- `SCHEDULED` requires `publishAt > now`, completeness at scheduling time, a right that will be active in a supported territory at `publishAt`, and an active `READY` asset. The due command repeats all checks at actual publication time.
- Provider processing events may make an asset ready but cannot publish a film.
- Rights expiry or asset disablement blocks new grants without mutating editorial history.

### Advertising

- A playback-session response contains zero or one preroll configuration.
- Lack of consent permits only the configured non-personalized request mode.
- Ad errors never relax watchability checks and never produce a second ad retry loop.
- The primary database does not store per-impression tracking profiles.

### Progress

- Clamp accepted position to `[0, durationSeconds]`.
- Reject non-finite values and implausible duration changes.
- Mark complete at 95% watched. For content at least 20 minutes long, also mark complete when 120 seconds or less remain. A user may still restart from zero.
- Ignore stale progress updates older than the stored client observation time.
- Guest progress uses a versioned local-storage shape and is never merged into an account without explicit user action in a later feature.

### Rating And Watchlist

- Rating is an integer from 1 through 10 half-star units; removing a rating deletes the row.
- Watchlist add and remove operations are idempotent.
- Aggregated ratings exclude deleted users and are computed from accepted rating rows only.
- Public average rating is `AVG(valueHalfStars) / 2`, rounded to one decimal place. Omit the aggregate and show no synthetic score until at least five active-user ratings exist; expose the count beside any displayed average.

## Required Indexes

- unique index on normalized `Movie.slug`;
- index on `(Movie.publicationState, Movie.publishAt)`;
- trigram indexes on normalized movie title, original title, and person name;
- indexes on each join table's reverse lookup column;
- index on `(ContentRight.movieId, territory, startsAt, endsAt)`;
- partial unique index enforcing one active asset per movie;
- partial unique index enforcing at most one default subtitle track per video asset;
- indexes on `WatchProgress(userId, lastWatchedAt DESC)` and `WatchlistEntry(userId, createdAt DESC)`;
- index on `AuditEvent(targetType, targetId, createdAt DESC)`;
- unique index on `ProcessedWebhook(providerEventId)`.

If Prisma cannot express a required PostgreSQL constraint, add it with reviewed SQL in the migration and cover it with an integration test.

## Transaction Boundaries

- Publishing validates completeness and changes state in one transaction.
- Selecting a new active asset disables the former active designation atomically.
- Rights changes and their audit event commit atomically.
- Role changes and their audit event commit atomically.
- Webhook deduplication and asset-state mutation commit atomically.
- Watchlist, rating, and progress upserts are single-statement or single-transaction idempotent operations.

External provider calls do not run inside long database transactions. Gather provider state first, then commit owned state with concurrency checks.

## Deletion And Retention

- Catalog removal defaults to unpublish, not hard delete.
- Account deletion immediately revokes sessions, sets `disabledAt` and `deletedAt`, removes public display, and persists an irreversible deletion request. Sign-in remains blocked during the purge window.
- Within 30 days, the maintenance job deletes Auth.js accounts/sessions/verification data plus profile, watchlist, rating, and progress rows. The email may be used for a new account only after final purge.
- Audit event facts follow the separately approved security retention period; actor PII is never stored in audit metadata and the actor FK becomes null on final account purge.
- Retain processed webhook IDs for 90 days, then delete them with an idempotent maintenance job unless provider retry evidence justifies a documented change.
- Retention jobs must be idempotent, observable, and covered by integration tests before production use.

## Deterministic Seed Data

Development and tests use fictional film titles and locally generated placeholder art or explicitly licensed fixtures. Seed at least:

- one published and watchable film;
- one published film with expired rights;
- one draft with a preparing asset;
- one scheduled film;
- one member, editor, and admin fixture;
- one featured collection and one empty collection.

Never use scraped posters, production provider IDs, or real user data in seeds.