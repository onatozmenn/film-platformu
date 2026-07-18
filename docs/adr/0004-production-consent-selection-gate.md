# ADR 0004: Production Consent Selection Gate

- Status: Proposed
- Date: 2026-07-19
- Owners: Product owner, legal/privacy owner, engineering
- Supersedes: None
- Superseded by: None

## Context

ADR 0002 permits at most one consent-aware preroll per playback session but explicitly does not authorize production advertising before legal review. The application needs deterministic ad orchestration and failure coverage now, while the owner has not supplied a legally reviewed consent-management platform, representation, policy version, launch-territory notice, or production Google Ad Manager configuration.

This record does not claim legal approval and does not select a production CMP. It records the enforceable interim gate and the inputs required for a later accepted decision.

## Decision Drivers

- No optional advertising request or storage before verified consent
- Separate advertising and personalization decisions
- Server-owned verification rather than browser-body assertions
- One preroll opportunity with fail-open content playback
- No production tag in local, test, or preview environments
- A testable implementation that cannot be mistaken for launch approval

## Considered Options

1. Integrate an owner-selected IAB TCF 2.2 CMP and verify its representation server-side.
2. Verify a signed first-party consent receipt issued by an owner-selected CMP backend.
3. Keep production advertising disabled until the owner and legal/privacy reviewer select and approve an approach.

## Decision

Select option 3 as the current safety gate. `ADVERTISING_PROVIDER` defaults to `disabled`, and any non-disabled value is rejected when `NODE_ENV=production`. No production ad-tag variable or CMP representation is accepted by the application.

Outside production only, `ADVERTISING_PROVIDER=fake` enables a deterministic Google IMA test-tag configuration. The `X-Film-Test-Consent` header is recognized only by that fake and maps strict owned states; it is not a consent mechanism, cookie, production API, or evidence of user choice. Missing, invalid, disabled-provider, and production-like input maps to `UNKNOWN` and initializes no optional advertising.

The production CMP choice remains unapproved. Before production advertising can be implemented or enabled, this ADR must be revised while Proposed or replaced by an accepted ADR that names the selected provider/representation, verification and withdrawal flow, policy versioning, retention, territorial legal review, and rollout owner.

## Consequences

### Positive

- Local and CI can prove consent, non-personalized, fail-open, telemetry, and bundle boundaries without live ads or tracking.
- Production and preview deployments cannot accidentally consume a test or production ad tag.
- The future CMP adapter must satisfy the existing owned consent port instead of leaking provider types into playback policy.

### Negative

- Production advertising remains unavailable.
- Personalized and non-personalized production requests cannot be staging-verified until owner inputs arrive.
- The temporary test header must be maintained as an explicitly non-production surface.

### Risks And Mitigations

| Risk | Mitigation |
|---|---|
| Test consent is mistaken for real consent | Production parser rejects the fake; docs and types label the header test-only |
| Ad failure blocks licensed content | Mux owns IMA lifecycle; deterministic blocked/empty/error/timeout tests prove fail-open handoff |
| Provider data leaks through telemetry | Outcome route accepts only opaque session ID plus a coarse enum and logs only request ID plus outcome |
| A production tag enters a preview build | No production tag variable exists; non-watch bundles and browser networks are asserted clean |

## Migration And Rollback

The default remains `disabled`, so deployment is backward compatible. The deterministic fake is enabled only in local/CI process configuration. Rollback removes the advertising opportunity from sessions while playback grants continue unchanged. A future accepted CMP decision must add its production configuration in a separate reviewed change; no data migration exists today.

## Verification

- Unit tests cover every consent state, personalization mode, environment gate, fixed tag mapping, and one-opportunity decision branch.
- Route tests reject client-body consent and privacy-rich telemetry payloads.
- Browser tests prove denied consent performs no optional request/storage, non-personalized tags carry `npa=1`, all fake failure paths reach content once, and non-watch bundles contain no Mux/IMA code.
- Production-mode configuration tests reject the fake before application startup.

## Follow-Up

- [ ] Product owner selects the launch-territory CMP approach.
- [ ] Legal/privacy owner reviews consent text, purposes, withdrawal, retention, and non-personalized behavior.
- [ ] Engineering records the accepted provider representation and server verification adapter.
- [ ] Owner supplies approved Google Ad Manager tag and `ads.txt` values before WP-07 production release.