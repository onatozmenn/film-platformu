# Frame.io Design Reference

- Source: https://styles.refero.design/style/30c3aa18-4323-4448-8ddd-3ca933fe5780
- Assigned surface: Watch and media stage
- Status: Distilled research reference; not an implementation contract

## Extracted Character

A dark projection room where product chrome recedes so media can dominate. The source uses one blue accent, cool secondary text, thin framing, and large media showcases surrounded by controlled negative space.

## Extracted System

| Concern | Refero observation |
|---|---|
| Canvas | `#0a0a13`, deeper `#040407` and `#08080c` |
| Text | `#fcfcfc`, muted `#a3a3b3`, secondary `#757580` |
| Source accents | `#6199f6`, `#4f4f80`, `#dedfee` |
| Primary type | FrameGothic, weights 400-600 |
| Base spacing | 8px |
| Content width | 1280px |
| Section gap | 80px |
| Source radius | 10-24px cards, 100px controls |

## Accepted Patterns

- Video is the dominant, unframed visual object on the watch page.
- Surrounding UI uses quiet text, thin edges, and controlled utility regions.
- Player dimensions are reserved before initialization to prevent layout shift.
- Secondary information uses a constrained readable line length.
- Controls and status exist to frame the work, not compete with it.
- A dedicated pure-black stage may sit inside the global cool-dark canvas.

## Rejected Or Corrected

- Iris blue, violet borders, lilac, cosmic gradients, pill navigation, and large radii are not adopted.
- Proprietary source fonts and tracked eyebrow typography are not used.
- Marketing showcases do not define actual Mux Player controls.
- Player chrome must remain accessible and cannot disappear solely because pointer motion stops.
- Source screenshots, product mockups, logo, and copy are not implementation assets.

## Film Platform Translation

The watch page uses a focused black media stage, stable 16:9 player, restrained metadata below it, and no decorative card around the video. Ad, buffering, caption, unavailable, and retry states occupy the same reserved frame. Film Platform's green appears only in owned actions or progress/rating semantics, never as a wash over the image.