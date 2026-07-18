# ADR 0002: Free Playback And A Single Preroll

- Status: Accepted
- Date: 2026-07-18
- Owners: Product owner, engineering
- Supersedes: None
- Superseded by: None

## Context

The MVP needs a clear access and revenue model before playback, identity, privacy, and data contracts can be designed. The product owner selected ad-supported access, Mux video, and optional accounts. Aggressive advertising would conflict with the quiet cinema experience and would multiply consent, player, reliability, and testing complexity. Mandatory accounts would add friction to the primary watch journey without being necessary for licensed public access.

## Decision Drivers

- Immediate access to eligible licensed films
- A simple, testable MVP revenue mechanism
- Minimal interruption of the viewing experience
- Privacy and consent by default
- Playback availability during ad-provider or ad-blocking failures
- Clear separation between visitor playback and member convenience features

## Considered Options

1. Free playback with at most one consent-aware preroll and optional accounts
2. Mandatory account before playback
3. Subscription or film rental/purchase
4. Multiple preroll/midroll/postroll and page advertising formats
5. No revenue mechanism in MVP

## Decision

Allow visitors to watch films that pass server-side publication, territory, rights-window, and asset-readiness checks. Accounts remain optional and add only watchlist, rating, and synchronized-progress capabilities.

For each newly created playback session, the server may provide zero or one Google IMA preroll opportunity. There is no midroll, postroll, overlay, popup, page banner, or anti-ad-block behavior in MVP. Advertising and personalization are separately consented. Missing/invalid consent initializes no optional advertising. Ad empty/error/timeout/blocked outcomes fail open to eligible content without an automatic playback-session retry.

The decision does not authorize unlicensed free distribution, personalized advertising without consent, per-user ad profiles, or a production launch without a legally reviewed consent mechanism and ad configuration.

## Consequences

### Positive

- The primary film journey has low account and advertising friction.
- One ad opportunity sharply limits player states and makes fail-open behavior testable.
- Optional accounts can be delivered independently from guest playback.
- Consent and non-personalized behavior are explicit architecture inputs.

### Negative

- A single preroll may produce less revenue than more aggressive formats.
- Ad blockers and provider outages can result in an ad-free play by design.
- Guest progress is device-local and not synchronized.
- A consent-management product and legal review remain launch dependencies.

### Risks And Mitigations

| Risk | Mitigation |
|---|---|
| Ad SDK blocks or destabilizes playback | Lazy-load on watch route, timeout, fail-open, deterministic browser tests |
| Tracking begins without valid consent | Default off, separate ad/personalization decisions, storage/network assertions |
| Clients request repeated sessions for more starts | One opportunity per session; coarse abuse limits; no promise of per-person frequency profiling |
| Rights are confused with free access | Every session independently enforces rights and signed playback |
| Product later adds intrusive formats casually | Any new format is out of scope and requires product approval plus ADR |

## Migration And Rollback

Advertising is controlled independently from playback. It remains disabled until WP-04 and can be disabled without bypassing rights or interrupting eligible content. Optional identity can be introduced after catalog persistence without changing visitor playback. Moving to payment or mandatory accounts requires a new ADR, entitlement model, product contract, migration plan, and user communication.

## Verification

- Browser/network tests prove no optional ad initialization without valid consent.
- Personalized-denied mode uses only the provider's approved non-personalized configuration.
- Every ad failure mode reaches eligible content and never loops.
- Guest playback works with auth unavailable.
- Rights, territory, publication, asset, and token tests remain fail-closed.
- No watch history, user ID, email, or search query appears in ad requests or telemetry.

## Follow-Up

- [ ] Before WP-04 production enablement, select and accept the consent-management approach in a new ADR.
- [ ] Before WP-07, obtain approved production ad configuration, privacy copy, consent policy, and `ads.txt` values.