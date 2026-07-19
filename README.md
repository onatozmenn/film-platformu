# Film Platform

Film Platform is a Turkish-first, ad-supported discovery and streaming product for films the operator owns or is licensed to distribute. Visitors can watch without an account; optional membership adds a watchlist, half-star ratings, and synchronized progress.

The repository contains the remotely validated WP-00 through WP-04 slices and the active WP-05 member implementation: PostgreSQL-backed discovery, licensed guest playback, consent-aware preroll handling, Auth.js email-link sessions, synchronized member library state, and deterministic provider fakes.

## Fixed MVP Decisions

- Next.js modular monolith with strict TypeScript and PostgreSQL
- Mux managed video and signed playback behind an owned adapter
- One consent-aware Google IMA preroll opportunity; no midroll, postroll, popup, or anti-ad-block behavior
- Optional Auth.js email-link account
- TMDB metadata adapter with required attribution; no scraping
- DM Sans plus Source Serif 4 in the original Midnight Programme hybrid design
- Licensed/owned films and artwork only

## Start Here

Coding agents must begin with [AGENTS.md](AGENTS.md). Humans can use this map:

| Document | Decision surface |
|---|---|
| [Product](docs/01-PRODUCT.md) | Users, journeys, MVP boundary, owner inputs |
| [Architecture](docs/02-ARCHITECTURE.md) | Stack, modules, dependency rules, provider ports |
| [Domain and data](docs/03-DOMAIN-AND-DATA.md) | Records, constraints, watchability invariants |
| [API contracts](docs/04-API-CONTRACTS.md) | Runtime endpoints, actions, errors, cache policy |
| [Design system](docs/05-DESIGN-SYSTEM.md) | Executable tokens and component contract for [DESIGN.md](DESIGN.md) |
| [Screen blueprints](docs/design/SCREEN-BLUEPRINTS.md) | Route hierarchy, interaction, responsive behavior, and reference assignment |
| [Design research](docs/design/README.md) | Distilled source references and hybrid merge rules |
| [Security and compliance](docs/06-SECURITY-COMPLIANCE.md) | Threat boundaries, rights, privacy, playback and ad controls |
| [Quality](docs/07-QUALITY.md) | Test matrix, accessibility, performance, release gates |
| [Delivery plan](docs/08-DELIVERY-PLAN.md) | Active package, dependencies, acceptance evidence |
| [Operations](docs/09-OPERATIONS.md) | Environments, deployment, observability, runbooks |
| [ADRs](docs/adr/README.md) | Accepted architecture and product decisions |

## Local Setup

Prerequisites are Node.js 24 (see `.node-version`), Corepack, and Docker Desktop or another Docker Compose-compatible engine. Create a local `.env` from the placeholder-only `.env.example`, then run:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The application is available at `http://localhost:3000`. PostgreSQL binds only to `127.0.0.1:54329`; the Compose project creates separate `film_platform` and `film_platform_test` databases. Stop local services with `pnpm db:down`.

Available discovery routes:

- `/` shows the photographic featured film and curated/ranked rails.
- `/filmler` filters and paginates the fictional catalog by genre/year through URL parameters.
- `/arama?q=` searches and paginates fictional title, original-title, and credited-person data with keyboard suggestions.
- `/film/[slug]` renders editorial detail, optional metadata, and deterministic similar films.
- `/izle/[slug]` requests a private, territory-checked playback session and renders the route-isolated Mux Player experience.
- `/giris` starts the account-enumeration-safe email-link flow when an identity provider is configured.
- `/hesap` shows the signed-in member's watchlist, continue-watching history, session controls, and irreversible account-deletion command.
- `/yonetim` provides the private editor/admin publication queue, optimistic editorial forms, collections, provider asset reconciliation, subtitle metadata, rights, preview, role management, and redacted audit views.

WP-03 exposes an `/izle` action only when fresh publication, trusted-territory rights, and active-ready asset policy passes. Fixture image sources and rights notes are recorded in [`public/fixtures/catalog/ATTRIBUTION.md`](public/fixtures/catalog/ATTRIBUTION.md); owned playback fixture provenance is recorded in [`public/fixtures/playback/ATTRIBUTION.md`](public/fixtures/playback/ATTRIBUTION.md).

Health endpoints:

- `GET /api/health/live` proves that the process can answer without checking dependencies.
- `GET /api/health/ready` performs a bounded database probe and returns only coarse state.

## Quality Commands

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm db:check
pnpm build
pnpm test:e2e
pnpm check:budgets
```

`pnpm test:integration` applies checked-in migrations only to a database whose name ends in `_test`. Browser tests start the app with deterministic configuration and verify mobile/desktop visuals, accessibility, runtime font hosting, health responses, and client-bundle secret separation.

`pnpm check:budgets` requires an existing production build plus Chromium and starts an isolated production server to enforce the public-route gzip targets.

TMDB metadata support is disabled by default and its synthetic contract tests make no live request. When explicitly enabled, editors import by numeric TMDB ID; provider imagery is not persisted as licensed catalog art. Guest playback defaults to an owned local fake outside production; production fake grants fail closed unless the complete Mux configuration is selected. Advertising defaults to disabled; browser tests opt into a deterministic fake and a Google-owned sample tag without making an ad-provider request. Identity and internal jobs also default to disabled; deterministic test adapters require no production credential. No Mux, TMDB, email, advertising, or production credential is required for local tests.

## Content Boundary

Reference film sites may inform familiar navigation or catalog concepts only. Do not copy their brand, page markup, text, proprietary assets, or streams. Never scrape, mirror, proxy, download, or embed unauthorized films, posters, subtitles, or playback links.
