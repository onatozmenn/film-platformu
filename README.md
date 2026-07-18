# Film Platform

Film Platform is a Turkish-first, ad-supported discovery and streaming product for films the operator owns or is licensed to distribute. Visitors can watch without an account; optional membership adds a watchlist, half-star ratings, and synchronized progress.

This repository currently contains the **engineering specification only**. Application code has not been scaffolded. The first implementation target is `WP-00 Foundation` in the delivery plan.

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

## Implementation Start

The first coding agent should implement only `WP-00 Foundation`. It must not start catalog, player, auth, advertising, or admin feature work early. Once WP-00 exists, this becomes the stable local interface:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Repository checks are defined in [Quality](docs/07-QUALITY.md). Commands become executable as their tools are introduced by WP-00.

## Content Boundary

Reference film sites may inform familiar navigation or catalog concepts only. Do not copy their brand, page markup, text, proprietary assets, or streams. Never scrape, mirror, proxy, download, or embed unauthorized films, posters, subtitles, or playback links.
