# Architecture Decision Records

ADRs preserve decisions whose reversal would change architecture, security, providers, product access, or delivery assumptions. They explain why the repository looks the way it does so a coding agent does not reopen settled questions without evidence.

## Records

| ADR | Status | Decision |
|---|---|---|
| [0001](0001-modular-monolith-and-managed-media.md) | Accepted | Modular monolith with PostgreSQL and managed media/provider adapters |
| [0002](0002-free-playback-and-single-preroll.md) | Accepted | Free visitor playback with optional accounts and one preroll opportunity |
| [0003](0003-midnight-programme-hybrid-design.md) | Accepted | One original design system synthesized from surface-specific film references |
| [0004](0004-production-consent-selection-gate.md) | Proposed | Keep production ads disabled until owner/legal CMP selection and review |

## Process

1. Copy [0000-template.md](0000-template.md) and assign the next four-digit number.
2. Set status to `Proposed` and describe the concrete decision, alternatives, consequences, migration, and verification.
3. Do not implement a decision that requires an ADR until the owner accepts it.
4. Once accepted, update affected contracts and delivery work packages in the same change.
5. Never rewrite the historical decision of an accepted ADR. Add a new ADR with `Supersedes` and mark the old one `Superseded`.

An ADR is required for changes listed in `docs/02-ARCHITECTURE.md`, plus consent-management selection, DRM, payments, new ad formats, new public APIs, and moving a deferred backlog item into scope.
