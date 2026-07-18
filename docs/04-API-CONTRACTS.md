# API And Action Contracts

Status: **Approved MVP contract**

## Contract Scope

Pages read through server-side query services. Browser runtime behavior uses same-origin Route Handlers under `/api/v1`. Admin forms may use Server Actions, but they must call the same application services and return the same owned error codes described here.

The API is internal to the web product in MVP. Do not advertise it as a public third-party API or add CORS support.

## Transport Conventions

- JSON requests use `Content-Type: application/json; charset=utf-8`.
- Successful collection responses use `{ "data": [...], "page": {...} }`; single resources use `{ "data": {...} }`.
- Errors use RFC 9457 Problem Details with `Content-Type: application/problem+json`.
- IDs are opaque UUID strings. Clients must not infer entity type or order from them.
- Timestamps are ISO 8601 UTC strings.
- Unknown request fields are rejected for mutations.
- Authentication uses a secure, HTTP-only, same-site session cookie. A request body never accepts a user ID or role.
- Same-origin mutation requests validate `Origin`/`Host`. Provider webhooks use provider signatures instead of browser CSRF rules.
- Responses include or propagate `X-Request-Id`. Accept a syntactically valid incoming ID only from trusted infrastructure; otherwise generate one.
- `PUT` and `DELETE` member operations are idempotent. Retry-prone `POST` operations use an idempotency key when documented.
- No endpoint returns Prisma rows, private provider payloads, management tokens, email-link tokens, or raw signed URLs beyond the narrow playback grant.

## Problem Details

Example:

```json
{
  "type": "https://film-platform.invalid/problems/playback-not-available",
  "title": "Film şu anda oynatılamıyor",
  "status": 403,
  "code": "PLAYBACK_NOT_AVAILABLE",
  "detail": "Bu içerik bulunduğunuz bölgede kullanılamıyor.",
  "requestId": "req_opaque"
}
```

`detail` is safe Turkish display copy. Internal exception messages, provider failures, rights dates, and authorization reasoning are logged only in redacted server form.

| Code | HTTP | Meaning |
|---|---:|---|
| `VALIDATION_FAILED` | 400 | Request shape or value is invalid |
| `AUTHENTICATION_REQUIRED` | 401 | A member-only operation lacks a valid session |
| `FORBIDDEN` | 403 | Authenticated actor lacks permission |
| `PLAYBACK_NOT_AVAILABLE` | 403 | Rights, publication, territory, or asset policy denies playback |
| `NOT_FOUND` | 404 | Resource is absent or intentionally concealed |
| `CONFLICT` | 409 | State or uniqueness conflict |
| `RATE_LIMITED` | 429 | Request budget exceeded |
| `PROVIDER_UNAVAILABLE` | 503 | Required provider cannot complete a fail-closed operation |
| `INTERNAL_ERROR` | 500 | Unexpected failure with no leaked detail |

## Runtime Endpoints

### Search Suggestions

`GET /api/v1/search/suggestions?q=<query>&limit=<1..10>`

Rules:

- Normalize surrounding whitespace; require at least two Unicode characters and cap at 80.
- Return at most 10 published, catalog-visible results.
- Search title, original title, and credited person names.
- Cache briefly by normalized query. Do not include rights dates or draft information.
- `slug` is always present. `year` is an integer or `null`; `poster` is the documented image object or `null` when no approved image exists.

```json
{
  "data": [
    {
      "kind": "movie",
      "id": "5d6fbf8c-12d9-47f2-88ad-e4de34c79185",
      "title": "Örnek Film",
      "year": 2026,
      "slug": "ornek-film",
      "poster": { "src": "/fixtures/posters/ornek.webp", "alt": "Örnek Film afişi" }
    }
  ]
}
```

### Create Playback Session

`POST /api/v1/playback/sessions`

Request:

```json
{
  "movieId": "5d6fbf8c-12d9-47f2-88ad-e4de34c79185"
}
```

The server resolves territory from trusted request context, optionally resolves the member from the session, reads normalized consent through the approved server-side consent adapter, evaluates watchability, and issues a grant with a maximum lifetime of five minutes. Client-provided consent booleans, territory, role, asset ID, provider ID, or resume position are forbidden. The consent ADR may define a signed first-party cookie or provider token, but the application service receives only an owned verified consent state.

Response:

```json
{
  "data": {
    "sessionId": "ps_opaque_random",
    "movie": {
      "id": "5d6fbf8c-12d9-47f2-88ad-e4de34c79185",
      "title": "Örnek Film",
      "durationSeconds": 6120
    },
    "playback": {
      "provider": "mux",
      "playbackId": "public_provider_identifier",
      "token": "short_lived_signed_token",
      "expiresAt": "2026-07-18T12:05:00.000Z"
    },
    "advertising": {
      "provider": "google-ima",
      "placement": "preroll",
      "tagUrl": "sanitized_configured_vast_url",
      "personalized": false
    },
    "resumeAtSeconds": 0
  }
}
```

`advertising` is `null` when ads are disabled by environment, consent policy, frequency policy, or provider configuration. An ad load error after this response does not trigger another session request automatically.

The deterministic non-production video fake may append `fixtureSourceUrl` and `fixtureTextTracks` under `playback` so browser tests can play an owned local asset. These fields are absent from Mux grants and are rejected as configuration in production; they never accept caller-provided URLs.

### Update Member Progress

`PUT /api/v1/me/progress/:movieId`

Requires a member session.

```json
{
  "positionSeconds": 913.2,
  "durationSeconds": 6120,
  "observedAt": "2026-07-18T12:18:22.000Z"
}
```

Return `204 No Content`. The service clamps valid values, ignores stale observations, and computes completion. Rate-limit normal updates to one accepted write per user and film per 10 seconds; pause, ended, and page-exit updates may bypass client throttling but still pass server coalescing.

`DELETE /api/v1/me/progress/:movieId` clears the member's progress and returns `204` whether or not a row existed.

### Set Watchlist Membership

- `PUT /api/v1/me/watchlist/:movieId` returns `204` after idempotent add.
- `DELETE /api/v1/me/watchlist/:movieId` returns `204` after idempotent remove.

Both require a member session and a catalog-visible film. The same application commands may back progressively enhanced Server Actions.

### Set Rating

`PUT /api/v1/me/ratings/:movieId`

```json
{ "valueHalfStars": 8 }
```

Require an integer from 1 through 10. Return `204`. `DELETE` removes the member's rating idempotently.

### Health

- `GET /api/health/live` proves the process can answer and has no dependency checks.
- `GET /api/health/ready` performs a bounded database readiness check and returns only a coarse status.

Neither endpoint returns versions, environment values, connection details, or provider credentials.

## Provider Webhooks

### Mux

`POST /api/webhooks/mux`

- Read the raw body exactly once.
- Verify the Mux signature with the official mechanism and accept a maximum timestamp skew of 300 seconds before trusting or logging event fields.
- Deduplicate on Mux event ID.
- Handle only the asset events required to map `PREPARING`, `READY`, `ERRORED`, and `DISABLED`.
- Return `2xx` for a verified but unsupported event; return `4xx` for an invalid signature.
- Do not call Mux back from the webhook transaction unless reconciliation requires it and the call is outside the database transaction.

## Internal Scheduled Commands

`POST /api/internal/publish-due`

- Accept only `Authorization: Bearer <CRON_SECRET>` over the production deployment; compare the credential in constant time and never log it.
- Reject browser cookies, CORS, and request-supplied dates. Use the injected server clock.
- Invoke the idempotent `PublishDueMovies` service and process each due film in a separate bounded transaction.
- Return only aggregate counts (`examined`, `published`, `skipped`, `failed`) with no film metadata or internal failure details.
- Apply a strict execution limit and leave unprocessed rows for the next invocation.

`POST /api/internal/run-retention`

- Use the same `CRON_SECRET`, no-cookie/no-CORS, server-clock, aggregate-response, and bounded-execution rules.
- Invoke `PurgeDeletedAccounts` for irreversible deletion requests whose `deletedAt` is at least 30 days old.
- Claim rows so overlapping runs cannot purge the same account concurrently; process each account in its own transaction.
- Return aggregate counts (`examined`, `purged`, `skipped`, `failed`) without user IDs, emails, or per-account errors.
- Preserve the non-personal deletion marker required to replay the purge after restoring an older backup.

## Admin Application Commands

Admin UI uses typed application commands rather than a broad CRUD API:

| Command | Minimum role | Important precondition |
|---|---|---|
| `CreateMovieDraft` | Editor | Valid owned or allowed imported metadata |
| `UpdateMovieEditorialData` | Editor | Optimistic revision matches |
| `SetMovieCredits` | Editor | People and ordering validate |
| `CreateOrAttachVideoAsset` | Admin | Provider request is idempotent |
| `SetContentRights` | Admin | Valid, non-contradictory time window |
| `ScheduleMovie` | Editor | Completeness and future schedule pass |
| `PublishMovie` | Editor | Full publication and watchability policy passes |
| `UnpublishMovie` | Editor | Reason supplied for audit |
| `GrantRole` / `RevokeRole` | Admin | Cannot remove the final active admin |

Every command returns:

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ActionErrorCode; fieldErrors?: Record<string, string[]> };
```

Do not return stack traces or caught `Error` objects to Client Components.

## Cache And Privacy Headers

- Public catalog reads: explicit CDN/server cache policy with tag invalidation.
- Search suggestions: short public cache only when responses are identical for all users in a territory.
- Playback, member, auth, admin, and preview responses: `Cache-Control: private, no-store`.
- Problem responses involving auth, rights, or providers: `no-store`.
- All JSON endpoints set `X-Content-Type-Options: nosniff` through global response headers.
