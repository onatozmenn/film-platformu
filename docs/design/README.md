# Hybrid Design Reference Library

Status: **Approved synthesis workflow**

This directory records the evidence behind Film Platform's original design language. The source products are references, not templates. Their logos, copy, screenshots, proprietary fonts, artwork, exact page composition, and brand-specific colors are not product assets and must not be copied into the implementation.

## Precedence

For UI work, use this order:

1. `docs/05-DESIGN-SYSTEM.md` for executable tokens and component constraints.
2. Root `DESIGN.md` for visual direction and screen composition.
3. `docs/design/SCREEN-BLUEPRINTS.md` for page-level hierarchy and responsive behavior.
4. `docs/design/references/*.design.md` only to understand why a decision was made.

Reference extracts never override the first three levels.

## Source Assignment

| Source | Assigned surface | Borrow | Do not borrow |
|---|---|---|---|
| [Letterboxd](references/letterboxd.design.md) | Global foundation | Cool dark palette, serif/sans boundary, rating language, sharp geometry | Brand, copy, commercial fonts, extraction errors |
| [HBO Max](references/hbo-max.design.md) | Home and catalog | Poster-first hierarchy, flat cinema-dark surfaces, sparse chrome | Blue palette, pills, pricing polarity, tracked labels |
| [Netflix](references/netflix.design.md) | Horizontal film rails | Browsable shelf rhythm, ranking, carousel ergonomics | Red brand system, marketing cards, oversized type, gradients |
| [A24](references/a24.design.md) | Film detail/editorial | Title-as-poster composition, credits/meta hierarchy, negative space | Pure monochrome mandate, zero-radius everywhere, proprietary type |
| [Frame.io](references/frame-io.design.md) | Watch/media surface | Media-dominant stage, controls receding around content, focused utility | Blue/violet palette, cosmic gradients, pill geometry, marketing layout |

The original user-supplied Refero output is preserved as [letterboxd.refero-raw.md](references/letterboxd.refero-raw.md) for provenance. It contains known extraction errors and must not be loaded as implementation guidance.

## Merge Rules

- One canonical palette: Film Platform's cool near-black neutrals and Acid Green action/rating accent.
- One canonical type system: DM Sans for product UI and Source Serif 4 for editorial prose/display.
- Source light weights are intentionally dropped; both canonical families load only 400 and 700 to reduce font payload and keep hierarchy explicit.
- One geometry system: sharp 3px rectangular components and stable media ratios.
- Composition may vary by surface, but tokens do not change by page.
- A borrowed pattern must solve a Film Platform user task; resemblance alone is not sufficient.
- When two references conflict, prefer product usability, accessibility, Turkish content fit, and the assigned source above.
- Raw Refero output is evidence only. Remove malformed detections and resolve contradictions before a rule becomes canonical.

## Review Questions

Before accepting a referenced pattern, answer:

1. Which Film Platform screen and user decision does it support?
2. Can it use canonical tokens without importing the source brand?
3. Does it work with long Turkish titles, keyboard input, touch, reduced motion, and 200% zoom?
4. Are loading, empty, partial, error, unavailable, and permission states defined?
5. Can it be verified with a deterministic screenshot or interaction test?

If any answer is missing, the pattern remains research material rather than an implementation requirement.