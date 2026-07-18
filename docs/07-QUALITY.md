# Quality Strategy And Release Gates

Status: **Mandatory for implementation and release**

## Quality Model

Test behavior at the cheapest layer that can prove it, then keep a small number of browser tests for critical integrations. Coverage is evidence, not the goal. Rights, publication, authorization, playback-grant, consent, and progress policies require explicit boundary tests even if aggregate coverage is already high.

Every defect fix begins with a failing regression test at the owning layer when reproducible.

## Test Layers

| Layer | Tooling | Owns | Must not do |
|---|---|---|---|
| Domain unit | Vitest | Pure rights, publication, progress, rating, ad, and role policies | Import Next.js, Prisma, provider SDKs, network, or wall clock |
| Component | Vitest + Testing Library | Interactive UI behavior, keyboard paths, states, accessible names | Test implementation details or mock every child |
| Repository integration | Vitest + isolated PostgreSQL | Prisma queries, constraints, transactions, migrations | Use SQLite as a PostgreSQL substitute |
| Route/action integration | Vitest | Validation, authn/authz, status mapping, cache policy, idempotency | Call production providers |
| Provider contract | Vitest + recorded/synthetic fixtures | Owned adapter mapping and signature handling | Commit secrets or unstable full provider payload snapshots |
| Browser journey | Playwright | Routing, hydration, auth, player/ad orchestration, responsive/a11y smoke | Depend on production accounts, live films, or live ads |

Provider fakes implement the same owned ports as production adapters. They model success, timeout, malformed response, denied consent, empty ad, webhook replay, and provider error deterministically.

## Required Policy Test Matrix

### Playback

- exact rights start is allowed; exact rights end is denied;
- future, expired, missing, denied-territory, and untrusted-territory rights are denied;
- draft, in-review, scheduled-before-time, and unpublished films are denied;
- missing, preparing, errored, and disabled assets are denied;
- a published film with active rights and ready asset receives a short-lived grant;
- Mux signing timeout/failure returns a safe unavailable response and no token leak;
- member progress affects resume position but never watchability;
- visitor playback succeeds without auth when all watchability rules pass.

### Advertising

- absent/invalid consent produces no optional ad request;
- advertising allowed plus personalization denied produces non-personalized config;
- one playback response contains no more than one preroll opportunity;
- empty ad, SDK error, timeout, and blocked request continue eligible playback;
- ad failure never requests a new playback session automatically;
- test and preview environments cannot use the production ad tag.

### Identity And Authorization

- visitor, member, editor, and admin capability matrix matches `docs/06-SECURITY-COMPLIANCE.md`;
- UI hiding and direct action invocation produce the same denial;
- ownership predicates prevent cross-user watchlist, rating, and progress access;
- privilege changes rotate/revoke sessions as specified;
- final-admin protection is transactional under concurrent attempts;
- account deletion disables access immediately and purges owned/auth data at the exact 30-day boundary while unlinking the audit actor.

### Publication And Webhooks

- every completeness precondition blocks invalid scheduling/publication;
- publication and audit commit or roll back together;
- valid Mux events map to owned states;
- invalid signatures cannot mutate or log trusted details;
- duplicate and out-of-order events are idempotent;
- setting a new active asset preserves the one-active-asset constraint;
- scheduled publication before `publishAt` changes nothing; exact-due execution revalidates and publishes once with a system audit event;
- a due film that fails current rights/completeness remains scheduled, does not block other rows, and can succeed on a later idempotent retry;
- missing/invalid cron credentials and overlapping job invocations cannot publish or purge data twice.

### Progress And Ratings

- progress rejects NaN, infinity, negative duration, and impossible values;
- stale observations cannot overwrite newer progress;
- completion boundaries and restart behavior are deterministic: content under 20 minutes completes only at 95%, while longer content may also complete with 120 seconds or less remaining;
- rating accepts only integer half-star units 1 through 10;
- add/remove watchlist and set/remove rating are idempotent.

## Critical Browser Journeys

Maintain a deliberately small, stable Playwright suite:

1. Visitor opens home, filters catalog, searches, opens details, passes an empty/test preroll, and plays a provider-fake film.
2. Member signs in through a test-only email-link harness, changes watchlist/rating, watches, refreshes, and resumes.
3. Editor creates and edits a draft but cannot set rights or attach an asset.
4. Admin attaches a fake ready asset, sets rights, publishes, previews, and unpublishes with an audit event.
5. Expired-rights and provider-failure films show a stable unavailable state without leaking internal reason.
6. Consent denied and ad SDK failure both lead to eligible content playback without tracking initialization or retry loops.

Run each public journey at a mobile and desktop viewport. Run the admin journey at desktop plus one narrow-layout smoke check.

## Accessibility Gates

- Use semantic landmarks, one logical page `h1`, ordered headings, labels, names, descriptions, and status announcements.
- All functionality is reachable and operable with keyboard only; focus remains visible and returns correctly from layers.
- Automated axe checks report no serious or critical issues on home, catalog, detail, watch, auth, and admin routes.
- Manually verify search combobox, mobile navigation, rating, dialogs, auth errors, and player/ad handoff with keyboard and a screen reader smoke test.
- Text and controls meet WCAG 2.2 AA contrast. Focus indicators and status do not rely on color alone.
- Reduced motion disables nonessential transforms and staged reveals.
- Zoom to 200% and 320 CSS px width without lost controls or two-dimensional page scrolling, except the media timeline itself.

Automated accessibility tests do not replace manual player and focus verification.

## Visual Regression Gates

Playwright captures deterministic screenshots for:

- home with hero and first poster row;
- catalog populated and empty results;
- film detail with long Turkish title and partial metadata;
- watch loading, preroll, playing, and unavailable states;
- sign-in and member library;
- admin draft and publication validation.

Required viewports are 360x800, 768x1024, 1440x900, and a wide desktop. Mask timestamps and nondeterministic player counters. A review rejects overlap, clipped text, horizontal overflow, blank imagery/player pixels, unexpected radius, layout shift, or palette drift.

## Performance Budgets

Measure production builds with provider fakes and representative catalog data.

| Metric | Budget |
|---|---:|
| LCP at p75 on public routes | <= 2.5s |
| INP at p75 | <= 200ms |
| CLS at p75 | <= 0.10 |
| Public non-watch first-load client JS, gzip | <= 180KB per route target |
| Initial CSS, gzip | <= 60KB target |
| Search suggestion server p95, warm | <= 250ms |
| Playback-session server p95 excluding external provider latency | <= 300ms |
| Database queries per catalog page | Explicitly bounded and reviewed; no N+1 |

- Do not load Mux Player, Google IMA, or ad-provider code on non-watch routes.
- Load ad code only after the consent decision and when a preroll opportunity exists.
- Preload at most the actual LCP image and primary fonts; lazy-load below-fold posters.
- Set poster/backdrop dimensions and responsive sizes. Do not ship original provider images when a smaller variant is sufficient.
- A budget regression requires a measured explanation and accepted ADR, not a silent threshold increase.

## Coverage And Mutation Expectations

- Rights, publication, progress-completion, role, and ad-decision policy modules require 100% branch coverage.
- New application services require success, validation failure, authorization failure, and important conflict/provider failure paths.
- Repository constraints require integration tests against the same PostgreSQL major version used in production.
- Aggregate project thresholds begin at 80% lines and 75% branches after the relevant suite exists. Raise them over time; do not lower them to merge a change.
- Prefer targeted mutation testing for watchability and authorization policies before production if tooling cost remains reasonable.

## Migration Quality

For every schema change:

1. Generate and review the SQL migration.
2. Apply it to an empty test database.
3. Apply it to a fixture database representing the previous schema.
4. Run repository integration tests.
5. Verify application compatibility during rolling deployment when applicable.
6. Document data backfill, lock risk, rollback/forward-fix plan, and production observation.

Destructive column removal uses an expand/migrate/contract sequence across releases. Do not combine code removal and destructive schema removal in one deployment.

## Stable Commands

The foundation package must expose:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm db:check
```

CI runs install, generated-file/schema checks, lint, typecheck, unit/component, integration, build, and browser tests in fail-fast stages with useful artifacts. Screenshot diffs, browser traces, and test reports are retained for failed runs without exposing secrets.

## Pull Request Evidence

Every completed work package records:

- acceptance criteria addressed;
- focused tests added or changed;
- exact validation commands and outcomes;
- screenshots for UI changes;
- migration and provider-fixture impact;
- security/privacy/content-rights impact;
- known limitations tied to a later work package or issue.
