# Security, Privacy, And Content Compliance

Status: **Mandatory release controls**

## Security Goals

Protect licensed media access, member data, privileged catalog operations, provider credentials, and the integrity of publication decisions. The system must remain safe under malicious browser input, replayed provider events, compromised low-privilege accounts, ad/provider outages, and accidental operator mistakes.

Security controls do not establish distribution rights or legal compliance by themselves. Production launch requires owner-provided rights records and legal review for the launch territories.

## Trust Boundaries

Treat all of the following as untrusted until verified and parsed:

- URL parameters, headers, cookies, form fields, JSON, and local storage;
- forwarded IP and country headers unless injected by configured trusted infrastructure;
- TMDB metadata and image references;
- Mux webhook bodies before signature verification;
- ad tag responses and Google IMA callbacks;
- uploaded subtitle text or files if that capability is later approved;
- data returned by Client Components, including IDs previously sent by the server.

## Secrets And Configuration

Validate environment variables once at server startup with a Zod schema split into server-only and explicitly public values.

Expected server-only categories include:

```text
DATABASE_URL
AUTH_SECRET
EMAIL_SERVER
EMAIL_FROM
MUX_TOKEN_ID
MUX_TOKEN_SECRET
MUX_WEBHOOK_SECRET
MUX_SIGNING_KEY_ID
MUX_SIGNING_PRIVATE_KEY
TMDB_API_TOKEN
GOOGLE_AD_TAG_URL
CRON_SECRET
SUPPORTED_TERRITORIES
LOCAL_DEFAULT_TERRITORY
```

Only intentionally public display configuration may use a `NEXT_PUBLIC_` prefix, such as the temporary site name. A provider value is not public merely because the browser eventually receives a derived identifier.

- Commit `.env.example` with placeholders only after scaffolding.
- Never log environment values, private keys, signed playback tokens, auth cookies, email-link tokens, or full ad URLs.
- Store multiline private keys in the deployment secret manager using documented newline handling.
- Rotate secrets after suspected exposure and invalidate affected sessions or grants where possible.
- Production and preview environments use separate provider credentials and databases.

## Authentication And Session Security

- Use Auth.js database sessions and a mature email provider; do not implement authentication protocols manually.
- Email links are single-use, short-lived, and sent only after generic responses that do not reveal account existence.
- Session cookies are `HttpOnly`, `Secure` in non-local environments, and `SameSite=Lax` or stricter.
- Rotate the session after sign-in and privilege changes. Revoke all sessions on account disablement or deletion.
- Privileged users reauthenticate before role-management or other high-impact operations when the auth provider supports it.
- Do not use local storage for session tokens.

## Authorization

Every mutation performs authorization inside the application service after session resolution. Hiding a button or protecting a route layout is not authorization.

| Capability | Visitor | Member | Editor | Admin |
|---|:---:|:---:|:---:|:---:|
| Watch eligible film | Yes | Yes | Yes | Yes |
| Manage own library | No | Yes | Yes | Yes |
| View/delete own account | No | Yes | Yes | Yes |
| Edit metadata, credits, and collections | No | No | Yes | Yes |
| Preview draft/scheduled/unpublished film | No | No | Yes | Yes |
| Schedule, publish, and unpublish | No | No | Yes | Yes |
| Attach/reconcile/select active asset | No | No | No | Yes |
| Create/change content rights | No | No | No | Yes |
| Disable another account | No | No | No | Yes |
| Manage roles and view audit | No | No | No | Yes |

- Object ownership is included in database predicates for member data.
- Non-public object lookups return `404` to unauthorized users where existence itself is sensitive.
- Prevent removal or disablement of the final active admin.
- A final active admin is a non-disabled, non-deleted user with `ADMIN`. Role revocation, disablement, and deletion use a PostgreSQL `SERIALIZABLE` transaction with bounded retry so concurrent requests cannot both pass a stale count.
- Role, rights, publication, asset, and account interventions produce immutable audit events.

## Playback Protection

- Resolve publication, rights, territory, and active asset server-side for every new playback session.
- Use Mux signed playback with a maximum five-minute grant-creation token lifetime. Do not expose Mux management credentials.
- A signed grant authorizes media retrieval, not permanent access. Never persist it in local storage, analytics, URLs, or logs.
- Production referrer/domain restrictions are defense in depth, not a replacement for signed grants.
- Do not proxy media segments through the Next.js application.
- Rights uncertainty, absent trusted territory, signature failure, or provider signing failure is fail-closed.
- Unpublishing or rights expiry blocks new grants immediately. Document provider/CDN limits on already-issued short-lived grants.
- Do not claim that signed URLs are DRM. If a distributor requires DRM, record and implement a provider-supported DRM ADR before accepting that title.

## Webhook Security

- Verify the raw Mux body with the official verification mechanism and a bounded timestamp tolerance.
- The accepted Mux timestamp skew is at most 300 seconds against the injected server clock.
- Reject invalid signatures before parsing event details or changing state.
- Deduplicate verified events by provider event ID in the same transaction as the state mutation.
- Model out-of-order events explicitly; an old processing event cannot regress a terminal disabled state without reconciliation.
- Limit body size and route methods. Do not place the webhook behind browser CSRF middleware.
- Log event ID, owned event kind, asset ID, and outcome only after verification.

## Internal Job Security

- Vercel Cron calls internal job routes with a dedicated `CRON_SECRET` bearer credential; compare it without data-dependent early exit and never log it.
- Internal jobs ignore browser cookies, accept no caller-supplied clock or territory, expose no CORS, and return aggregate outcomes only.
- `PublishDueMovies` and retention jobs are idempotent, bounded per invocation, and use a database lease/row-lock strategy so overlapping invocations do not process the same row concurrently.
- Production cron credentials are separate from preview and rotate like other secrets. A missing or invalid credential fails closed without starting work.

## Input, Injection, And Fetch Safety

- Parse all boundary input with strict Zod schemas and cap strings, arrays, pagination, and body sizes.
- React escaping remains enabled. Do not render provider HTML or use `dangerouslySetInnerHTML` for synopsis, credits, ad errors, or metadata.
- Metadata import accepts a TMDB ID selected from server-fetched results, never an arbitrary URL.
- Remote images use an explicit provider hostname allowlist and validated paths. Do not build an open image proxy.
- Do not accept arbitrary playback, embed, subtitle, callback, redirect, or webhook URLs from editors.
- Redirect destinations are internal allowlisted paths.
- Parameterize all database access through Prisma; reviewed raw SQL uses bound parameters only.
- Spreadsheet exports, if added later, must neutralize formula-leading cells.

## Browser Security Headers

Configure and test at least:

- Content Security Policy with explicit application, Mux, email/auth callback, Google IMA, and Google Ad Manager requirements;
- `frame-ancestors 'none'` unless an approved embedding product requirement changes it;
- `object-src 'none'`, restricted `base-uri`, and restricted `form-action`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- `X-Content-Type-Options: nosniff`;
- a minimal `Permissions-Policy` denying unused sensors and capabilities;
- HSTS in production after HTTPS/domain behavior is verified.

Start CSP changes in report-only mode with automated route coverage, then enforce them. Each third-party exception must name the provider feature that requires it. Do not add wildcard sources merely to silence violations.

## CSRF, Abuse, And Rate Limits

- Same-origin browser mutations validate Origin/Host and use same-site cookies.
- Email-link requests, search suggestions, playback session creation, progress writes, and admin mutations have route-specific rate limits.
- Enforce coarse network limits at the deployment edge and identity/object limits in application services where needed.
- Local in-memory limiting is acceptable only in tests and development; never describe it as production distributed protection.
- Return generic `429` responses and avoid exposing exact account or rights state.
- Do not build anti-ad-block bypasses, browser fingerprinting, credential stuffing tools, or stream-link obfuscation schemes.

## Advertising And Consent

- Production advertising is blocked until a legally reviewed consent-management approach is selected and recorded in an ADR.
- [Proposed ADR 0004](adr/0004-production-consent-selection-gate.md) records the current production-disabled gate and candidate approaches; it is not a CMP selection or legal approval.
- The playback JSON body never self-asserts consent. A server-side consent adapter verifies the selected CMP representation and returns the owned states `UNKNOWN`, `DENIED`, `NON_PERSONALIZED`, or `PERSONALIZED`; invalid or missing state maps to `UNKNOWN` and initializes no optional advertising.
- Before consent, initialize only storage and requests classified as strictly necessary. Advertising and personalization default off when consent state is absent or invalid.
- When advertising is allowed but personalization is not, request the provider's documented non-personalized mode.
- Send no email, display name, user ID, precise playback history, or free-form title query in ad requests.
- Use one preroll opportunity per playback session in MVP. No midroll, postroll, popup, overlay, or deceptive click target.
- An ad error is fail-open for eligible film playback and cannot produce an infinite retry or blank player.
- Use provider test tags outside production. Production ad tags remain server configuration, even if a sanitized request URL is eventually delivered to the browser.
- Maintain accurate `ads.txt` and privacy disclosures before launch.

## Privacy And Data Rights

- Collect only data needed for sessions, member features, security, coarse operations, and consented advertising.
- Watch history and ratings are personal data. Do not send them to advertising or metadata providers.
- Keep analytics pseudonymous and purpose-limited; do not create cross-site profiles.
- Provide account data access, history clearing, consent withdrawal, and account deletion paths before production.
- Account deletion is irreversible in MVP: revoke sessions and disable sign-in immediately, then purge Auth.js identity/session/verification data plus profile, watchlist, ratings, and progress within 30 days. Preserve only legally approved, non-PII audit facts with a null actor FK and short-lived replay-protection records under their documented retention.
- Define retention periods for logs, audit, webhook IDs, deleted accounts, and backups with legal review.
- Redact email addresses in logs and support tooling.
- A production backup restore must honor pending/deleted-account cleanup through replayable deletion records.

## Content Rights And Copyright

- Every playable film has operator-verifiable ownership or distribution-license evidence outside the public application database, linked by an internal reference.
- Store territory and active time windows in `ContentRight`; deny playback without a matching allow record.
- TMDB supplies metadata only under its terms and required attribution. It does not grant film, poster, trailer, or streaming rights.
- Use original, licensed, provider-permitted, or deliberately generated fixture art. Do not scrape reference sites.
- Publish a takedown/contact process and act on rights expiry by unpublishing or updating the rights window.
- Never ingest, mirror, proxy, or embed an unauthorized third-party stream, subtitle file, poster, or download link.

## Dependency And Delivery Security

- Lock dependencies with pnpm and use frozen installs in CI.
- Review install scripts and avoid unnecessary packages, especially player, auth, parser, and admin dependencies.
- Run dependency and secret scanning in CI. Findings that affect runtime or credentials block release.
- Generate an SBOM for production builds when deployment automation is introduced.
- Migrations run as a separately authorized release step; the web runtime should not own schema-changing privileges.
- Preview deployments never connect to the production database or production provider projects.

## Required Security Tests

- visitor/member/editor/admin authorization matrix for every privileged command;
- expired, future, wrong-territory, unpublished, and unready-asset playback denial;
- playback token expiry and absence from logs/client persistence;
- forged, replayed, duplicate, and out-of-order Mux webhook behavior;
- CSRF rejection on browser mutations;
- open redirect and arbitrary URL rejection;
- CSP coverage for catalog, auth, watch, ad, and admin routes;
- consent absent, advertising denied, personalization denied, provider error, and ad-blocked playback paths;
- account deletion/session revocation and personal-data cleanup;
- unauthorized, overlapping, early, exact-due, failed-validation, and retried scheduled-job execution;
- rate-limit behavior without account or rights enumeration.

No production release may waive a failed rights, authorization, secret, webhook-signature, or playback-grant test.