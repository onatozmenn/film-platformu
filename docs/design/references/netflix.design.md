# Netflix Design Reference

- Source: https://styles.refero.design/style/32959012-f50d-4465-bb01-2aa4d506e0a8
- Assigned surface: Horizontal film rails
- Status: Distilled research reference; not an implementation contract

## Extracted Character

An immersive, endlessly browsable shelf: a nearly black environment, strong content rows, minimal interruption, and a single urgent accent. Carousel and card-grid repetition make a large library feel navigable.

## Extracted System

| Concern | Refero observation |
|---|---|
| Canvas | `#000000` |
| Surfaces | `#2d2d2d`, `#414141` |
| Text | `#ffffff`, secondary `#b3b3b3` |
| Source accent | `#e50914` |
| Typeface | Netflix Sans, weights 400-900 |
| Base spacing | 4px |
| Content width | 1280px |
| Section gap | 48px |
| Source radius | 4px controls, 16px large cards |

## Accepted Patterns

- Content rails and card grids as the main library-browsing mechanisms.
- Strong row labels, stable card dimensions, and obvious continuation beyond the viewport.
- Ranked rows as a distinct editorial pattern, not a default on every section.
- Minimal navigation chrome while users scan content.
- Progressive loading that preserves rail dimensions.
- One accent and no card drop shadows.

## Rejected Or Corrected

- Netflix Red, proprietary type, logo, ranking numerals, marketing copy, pricing cards, and source artwork are not reusable.
- Feature-card purple gradients do not enter Film Platform.
- Large 16px content-card radius conflicts with the canonical sharp geometry.
- The marketing-page header model does not control the signed-in application navigation.
- Pure white is not used for long body copy.

## Film Platform Translation

Netflix contributes behavior rather than appearance. Film rails must support mouse, touch, keyboard, scroll restoration, stable loading placeholders, clear next/previous controls on capable viewports, and a non-trapping route to every item. All of that behavior renders with Film Platform tokens and poster proportions.
