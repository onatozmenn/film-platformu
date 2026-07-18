# ADR 0001: Modular Monolith And Managed Media

- Status: Accepted
- Date: 2026-07-18
- Owners: Product owner, engineering
- Supersedes: None
- Superseded by: None

## Context

The product needs catalog discovery, optional identity, licensed playback, restrained advertising, and administration. The repository starts without application code or an operations team. Splitting these workflows across services would add deployment, consistency, local-development, and observability costs before traffic or team topology justifies them. Building video transcoding, HLS packaging, global media delivery, or an ad runtime in-house would add specialist security and reliability risks unrelated to the product's differentiating work.

The architecture must remain clear enough for coding agents to implement without allowing framework routes, provider SDKs, and database records to become the domain model.

## Decision Drivers

- Small-team and coding-agent operability
- Atomic publication, rights, role, asset, and audit changes
- Strict protection of provider credentials and licensed playback
- Deterministic local/CI behavior without production accounts
- Ability to replace providers without rewriting domain policies
- Low initial operational surface

## Considered Options

1. One modular Next.js application with PostgreSQL and owned provider ports
2. Separate frontend, API, worker, catalog, identity, and playback services
3. A serverless backend assembled primarily from direct browser-to-vendor SDK calls
4. Self-hosted transcoding, object storage, HLS packaging, and CDN

## Decision

Build one Next.js App Router modular monolith with strict TypeScript and one PostgreSQL database. Separate catalog, playback, advertising, identity, library, admin, and audit into source modules with explicit public application contracts and infrastructure adapters.

Use Mux for managed video and signed playback, Google IMA/Google Ad Manager for the approved preroll format, TMDB for permitted metadata, Auth.js for database sessions, and a managed email provider. Provider SDK types remain inside adapters. Local and automated tests use owned deterministic fakes.

The decision does not approve microservices, a queue, Redis, a separate search engine, self-hosted media processing, direct database access from routes/components, or provider calls from domain code.

## Consequences

### Positive

- One deployable unit and database simplify setup, transactions, and incident response.
- Feature modules and provider ports preserve clear ownership without distributed-system overhead.
- Managed video and ad runtimes avoid hand-rolled media/ad protocols.
- Provider fakes make the full product testable without secrets or variable external systems.

### Negative

- Module boundaries depend on tests, review, and import rules rather than network isolation.
- A web deployment may later need a separate worker for long-running workloads.
- Mux, Google, and TMDB introduce vendor cost, policy, availability, and migration concerns.
- A single application deployment has a wider change blast radius than mature isolated services.

### Risks And Mitigations

| Risk | Mitigation |
|---|---|
| Framework or provider concepts leak into domain rules | Owned ports/types, module public exports, architecture tests |
| Vendor outage blocks required flow | Bounded timeouts; fail-open only for ads; fail-closed for rights/signing; runbooks |
| Monolith becomes tangled | Dependency direction, no cross-module infrastructure imports, ADR for exceptions |
| Web runtime is unsuitable for future jobs | Add a worker only after measured need and a new ADR |
| Vendor lock-in | Store owned state and external IDs; contract tests; isolate adapters |

## Migration And Rollback

This is the initial architecture, so no migration is required. Each provider integration is feature-flagged by environment and first exercised with a fake/sandbox. A provider replacement preserves owned application contracts and migrates external IDs/state through an accepted ADR. A service extraction must preserve module contracts and transaction semantics before traffic is moved.

## Verification

- Architecture/import tests reject forbidden module dependencies and client imports of server-only code.
- Provider contract suites pass against deterministic fixtures and sandbox smoke tests.
- Publication/rights/audit transaction tests pass on PostgreSQL.
- A clean environment completes all stable repository commands documented in `AGENTS.md`.
- Operational targets and provider failure paths pass before production.

## Follow-Up

- [ ] WP-00 creates the application shell, import boundaries, environment split, and database foundation.
- [ ] Each provider package records its exact version and sandbox verification in its introducing work package.
