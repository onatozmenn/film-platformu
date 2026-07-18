# ADR 0003: Midnight Programme Hybrid Design

- Status: Accepted
- Date: 2026-07-18
- Owners: Product owner, engineering
- Supersedes: The single-source Letterboxd reference in the original root `DESIGN.md`
- Superseded by: None

## Context

The initial design reference captured a strong dark film-community identity but treated one extracted website style as if it could decide every product surface. Film Platform also needs streaming discovery, large-library browsing, editorial film detail, media-dominant playback, optional identity, and dense administration. A single reference underspecified those compositions, while combining all source tokens would create an incoherent collage of green, red, blue, violet, multiple proprietary fonts, incompatible radii, and contradictory layout rules.

The product owner approved synthesizing several film/media references into a new original design rather than cloning one source.

## Decision Drivers

- One recognizable Film Platform identity across every route
- Surface-specific patterns proven in relevant film/media products
- Clear source ownership so coding agents do not average conflicting rules
- No copied brand, proprietary font, screenshot, artwork, wording, or exact layout
- Turkish text fit, WCAG 2.2 AA, stable responsive behavior, and deterministic visual QA
- Compatibility with the existing product, architecture, security, and delivery contracts

## Considered Options

1. Keep Letterboxd as the sole design reference.
2. Combine every source's tokens and components into one large system.
3. Use one canonical token foundation and assign each additional reference a specific composition/interaction surface.
4. Let each route use a different source design system.

## Decision

Adopt option 3 and name the original system **Midnight Programme**.

Film Platform keeps one canonical palette, type system, spacing scale, and geometry:

- cool near-black Letterboxd-derived neutral foundation;
- Acid Green for primary action, rating, and rare resume cues;
- DM Sans for product UI and Source Serif 4 for editorial/display use;
- 4px spacing foundation, 1200px content maximum, 3px rectangular geometry;
- photographic posters/stills as the primary chromatic content.

The references have fixed responsibilities:

| Reference | Responsibility |
|---|---|
| Letterboxd | Global tokens, serif/sans boundary, rating language, sharp geometry |
| HBO Max | Poster-first home/catalog hierarchy and flat sparse chrome |
| Netflix | Horizontal shelf, ranking, and carousel interaction model |
| A24 | Film-detail title, metadata, credits, and editorial negative space |
| Frame.io | Watch-page media dominance and receding utility chrome |

Source colors, proprietary fonts, logos, screenshots, copy, artwork, exact page compositions, large pills/radii, decorative gradients, and extraction anomalies are explicitly rejected.

The controlling documents are:

1. `docs/05-DESIGN-SYSTEM.md` for executable constraints.
2. Root `DESIGN.md` for Midnight Programme's visual direction.
3. `docs/design/SCREEN-BLUEPRINTS.md` for route-specific composition.
4. `docs/design/references/*.design.md` for research evidence only.

## Consequences

### Positive

- The product gains streaming-specific rails, editorial detail, and a focused watch surface without losing one identity.
- Coding agents receive explicit accepted/rejected rules instead of vague inspiration links.
- Raw extraction errors cannot become production tokens accidentally.
- Design reviews can trace every borrowed principle to one assigned surface.

### Negative

- The system requires maintaining three controlling design documents instead of one generated extract.
- Visual QA must check transitions between browse, detail, watch, and admin modes.
- Source sites may evolve; their future changes do not automatically update Film Platform.

### Risks And Mitigations

| Risk | Mitigation |
|---|---|
| Pages look like unrelated products | One palette/type/geometry system; reference ownership changes composition only |
| Agent copies recognizable source UI | Explicit rejected lists, original screen blueprints, no source assets in repository |
| Reference conflicts reappear | Document precedence and accepted ADR; implementation contract wins tokens/accessibility |
| Rails/player become inaccessible | Keyboard/touch/player requirements and deterministic browser tests |
| Design files drift | Update root design, implementation contract, blueprint, ADR impact, and screenshots together |

## Migration And Rollback

The original user-supplied Letterboxd Refero extract is archived under `docs/design/references/letterboxd.refero-raw.md`. Root `DESIGN.md` is replaced by Midnight Programme. Existing engineering contracts retain their token values, while onboarding, WP-01 acceptance, and repository indexes now reference the hybrid documents.

Rollback means restoring the prior root extract and reverting the linked contracts in one change; it must not leave mixed precedence. No runtime or data migration exists because application scaffolding has not started.

## Verification

- Every canonical token has one value across root design and implementation contract.
- No source-brand red, blue, violet, logo, proprietary font, screenshot, or copy is required by the hybrid design.
- Home, rail, catalog, detail, watch, account, and admin have explicit blueprint sections.
- Markdown diagnostics and local-link validation pass.
- WP-01 requires mobile/desktop screenshots, keyboard behavior, accessibility checks, and long-Turkish-title coverage.

## Follow-Up

- [ ] WP-00 implements canonical tokens/fonts without loading source reference files into runtime output.
- [ ] WP-01 builds and visually verifies home, rail, catalog, search, and detail blueprints.
- [ ] WP-03 verifies the media-stage/player states.
- [ ] WP-06 verifies the operational admin mode.