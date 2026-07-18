# Film Platform Engineering Contract

This repository builds a legal, licensed film discovery and streaming product. Treat this file as the mandatory entry point for every coding task.

## Read Before Coding

Read only the documents relevant to the task, in this precedence order:

1. `AGENTS.md` for non-negotiable working rules.
2. `docs/01-PRODUCT.md` for product scope and acceptance criteria.
3. `docs/02-ARCHITECTURE.md` for boundaries, dependencies, and repository structure.
4. `docs/03-DOMAIN-AND-DATA.md` for entities and business invariants.
5. `docs/04-API-CONTRACTS.md` for HTTP and mutation contracts.
6. `docs/05-DESIGN-SYSTEM.md`, `DESIGN.md`, and `docs/design/SCREEN-BLUEPRINTS.md` for UI work. Load source extracts only when reviewing a design decision.
7. `docs/06-SECURITY-COMPLIANCE.md` for auth, playback, uploads, metadata, or admin work.
8. `docs/07-QUALITY.md` for testing and performance gates.
9. `docs/08-DELIVERY-PLAN.md` for the active work package and its exit criteria.
10. Accepted records in `docs/adr/` for decisions that supersede earlier guidance.

When documents conflict, use the order above except that a newer accepted ADR may intentionally override architecture details. Stop and surface any unresolved product or compliance conflict instead of guessing.

## Non-Negotiable Rules

- Stream only content the operator owns or is licensed to distribute. Never scrape, mirror, proxy, download, or embed unauthorized film streams.
- Do not clone another site's brand, copy, proprietary assets, or page markup. Reference products may inform information architecture only.
- Keep secrets and provider signing keys server-only. Never expose database credentials, webhook secrets, or playback signing secrets to browser bundles.
- A film is playable only when it is published, inside an active rights window, and has a ready playback asset.
- Route components compose features; they do not contain domain rules or direct database access.
- Validate all external input at the system boundary. Enforce authorization again inside every mutation.
- Prefer the documented stack and existing dependencies. A new runtime dependency or service requires an ADR before adoption.
- Keep changes within one delivery work package. Do not build speculative features from later phases.
- Preserve strict TypeScript. Do not use `any`, unsafe casts, disabled lint rules, or swallowed errors to make checks pass.
- Accessibility, responsive behavior, loading, empty, error, and permission states are part of the feature, not follow-up polish.

## Required Workflow

1. Identify the active work package in `docs/08-DELIVERY-PLAN.md`.
2. State the smallest user-visible outcome and the invariant it depends on.
3. Inspect the owning module and its nearest test before editing.
4. Implement the smallest vertical slice that satisfies the package acceptance criteria.
5. Add or update tests at the lowest useful layer.
6. Run the narrow test first, then the repository quality commands relevant to the change.
7. Update documentation when a contract, command, environment variable, route, or decision changes.
8. Record architecture changes as an ADR using `docs/adr/0000-template.md`.

Do not mark a work-package checkbox complete until its stated evidence exists in the repository.

## Expected Commands

Once the application scaffold exists, these package scripts are the stable agent interface:

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm db:check
```

If a command is temporarily unavailable during foundation work, add it in the work package that introduces the corresponding tool. Do not silently substitute a different package manager or script name.

## Definition Of Done

A change is complete only when:

- the relevant acceptance criteria and domain invariants pass;
- focused tests cover the changed behavior and required failure paths;
- lint, typecheck, and applicable test/build commands pass;
- no secret, unlicensed asset, or provider-private value is committed or sent to the client;
- keyboard, mobile, loading, empty, and error behavior has been checked for UI changes;
- migrations are forward-safe and the generated schema state is committed for data changes;
- affected contracts and the delivery-plan evidence are updated;
- the final handoff lists changed files, commands run, and any remaining risk without claiming unverified success.