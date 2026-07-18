# Letterboxd Design Reference

- Source: https://styles.refero.design/style/d98dea0b-00a4-4c15-b4a9-d196e2c3e4b4
- Assigned surface: Global visual foundation
- Status: Distilled research reference; not an implementation contract

## Extracted Character

A cool, near-black film community interface where poster art supplies most of the color. Product chrome is compact and sans-serif; reviews and descriptions switch to a literary serif. Acid green appears at action and rating moments. Rectangles stay sharp and depth comes from neighboring dark surfaces rather than shadow.

## Extracted System

| Concern | Refero observation |
|---|---|
| Canvas | `#14181c` |
| Surfaces | `#202830`, `#2c3440` |
| Primary body | `#99aabb` |
| Heading | `#aabbcc` |
| Muted | `#667788` |
| Accent | `#00e054`, stronger `#00c030` |
| UI type | Graphik, weights 300/400/700 |
| Editorial type | Tiempos Text/Headline |
| Base spacing | 4px |
| Content width | 1200px |
| Section gap | 64px |
| Rectangular radius | 3px |

## Accepted Patterns

- Cool dark neutral stack as the global environment.
- Acid Green for the primary watch action and rating fill, not for decorative backgrounds.
- Sans-serif product UI plus serif editorial copy.
- 3px geometry for buttons, inputs, badges, poster edges, and in-flow surfaces.
- Poster art as the main chromatic content unit.
- Inset edges and surface shifts instead of card shadows.
- Compact metadata and comfortable, not cramped, density.

## Rejected Or Corrected

- Graphik and Tiempos are commercial source fonts; use the approved open substitutes.
- `object-fit: cover` and `masonry` are extraction errors, not typefaces.
- The source output contradicts itself about Acid Green; Film Platform treats it as the primary watch/rating accent.
- Extracted tracking values are not used; canonical letter spacing remains zero.
- Source logo, traffic-light brand dots, wording, screenshots, and social-network page composition are not reusable assets.

## Film Platform Translation

Letterboxd contributes the tokens and tonal discipline shared by every public and admin surface. It does not decide home-page rails, playback layout, or film-detail composition; those responsibilities belong to the other assigned references.
