# Film Platform - Midnight Programme

> Poster-lit streaming shelves meet the restraint of a printed film programme.

Status: **Canonical visual direction**  
Theme: **Dark**  
Primary locale: **Turkish (`tr-TR`)**

## Design Thesis

Midnight Programme feels like entering a projection room while holding a carefully typeset festival programme. The application canvas is cool and near-black. Posters and film stills provide nearly all visual color. Browsing is fast, horizontal, and content-dense; film detail slows down into an editorial reading composition; watch mode removes everything that competes with the picture. Acid Green appears as a projection cue: watch, rate, resume, or confirm a primary non-destructive action.

This is an original system synthesized from several research references. It does not reproduce any source product's brand, proprietary assets, fonts, copy, or exact page composition.

## Reference Roles

| Surface | Reference contribution | Film Platform interpretation |
|---|---|---|
| Global foundation | Letterboxd | Cool dark neutrals, serif/sans boundary, rating accent, sharp geometry |
| Home and catalog | HBO Max | Poster-first hierarchy, sparse chrome, flat cinema-dark surfaces |
| Film rails | Netflix | Shelf rhythm, continuation cues, ranking, carousel ergonomics |
| Film detail | A24 | Title-as-poster composition, credits/meta rhythm, negative space |
| Watch | Frame.io | Media-dominant stage and utility that recedes around the picture |

Detailed evidence and rejected source rules live in `docs/design/references/`.

## Core Principles

1. **The films supply the color.** Interface surfaces remain neutral so licensed artwork carries emotional weight.
2. **One accent means one decision.** Acid Green marks primary action and rating, never decoration or status wash.
3. **Browsing and reading have different voices.** DM Sans moves through product UI; Source Serif 4 carries synopsis and editorial moments.
4. **Hierarchy comes from scale, space, and polarity.** Do not solve weak hierarchy with more cards, colors, shadows, or labels.
5. **Every media frame is stable before it loads.** Posters stay 2:3; player and video preview stay 16:9.
6. **The watch page is a theater, not a dashboard.** Media dominates and controls remain accessible without becoming decoration.
7. **The admin is operational, not cinematic.** It shares tokens but removes promotional composition and photographic heroes.

## Canonical Color Tokens

| Token | Value | Role |
|---|---|---|
| `--color-theater` | `#000000` | Player stage and deepest media contrast only |
| `--color-canvas` | `#14181c` | Application background, navigation, footer |
| `--color-surface` | `#202830` | Dialogs, menus, editorial blocks, elevated utility |
| `--color-surface-raised` | `#2c3440` | Inputs, selected rows, hover surfaces, dividers |
| `--color-control` | `#445566` | Secondary controls and inactive utility fills |
| `--color-muted` | `#667788` | Secondary metadata and inactive icons |
| `--color-text` | `#99aabb` | Primary body and product text |
| `--color-heading` | `#aabbcc` | Headings and strong metadata |
| `--color-bright` | `#ddeeff` | Focused labels and short high-contrast emphasis |
| `--color-white` | `#ffffff` | Maximum contrast for short labels/icons only |
| `--color-accent` | `#00e054` | Primary watch action, filled rating, resume cue |
| `--color-accent-strong` | `#00c030` | Accent hover and pressed state |
| `--color-danger` | `#e05a47` | Destructive/error semantics only |
| `--color-warning` | `#e0a800` | Warning semantics only |

### Color Allocation

- Canvas and theater tones occupy most of every public viewport.
- Poster/backdrop photography is the dominant chromatic material.
- Acid Green never fills a page section. A local region has at most one filled primary action; other green is limited to active rating fill and a rare resume cue.
- Semantic danger and warning colors are localized and always paired with icon/text.
- Do not add source-brand red, blue, violet, or cream to the canonical palette.
- Long body copy never uses pure white; use Text or Heading.

## Typography

### Families

| Token | Family | Use |
|---|---|---|
| `--font-ui` | DM Sans | Navigation, controls, metadata, tags, tables, admin, short headings |
| `--font-editorial` | Source Serif 4 | Hero title when short, synopsis, editorial descriptions, featured copy |

Use weights 400 and 700 only. Load both through `next/font/google` with Latin and Latin Extended subsets, `display: swap`, and runtime self-hosting. Do not introduce a mono family; tabular numbers in DM Sans handle rank, year, runtime, and technical metadata.

### Scale

| Role | Family | Size | Weight | Line height |
|---|---|---:|---:|---:|
| Caption | UI | 11px | 400 | 1.4 |
| Metadata | UI | 12px | 400 | 1.4 |
| UI body | UI | 14px | 400 | 1.5 |
| Editorial body | Editorial | 15px | 400 | 1.67 |
| Body large | UI | 16px | 400 | 1.5 |
| Subheading | UI | 18px | 700 | 1.35 |
| Section heading | UI | 22px | 700 | 1.25 |
| Long-title heading | UI | 26px | 700 | 1.23 |
| Display title | Editorial | 36px | 700 | 1.33 |

- Set `letter-spacing: 0` globally.
- Uppercase labels use weight and case for emphasis, never added tracking.
- Sentence case is the default. Uppercase is reserved for short status/category labels.
- Hero/display type is reserved for real film-title moments, not dashboard panels or card headings.
- A title uses 36px Editorial Display only when it fits within two lines. Otherwise it uses 26px Long-title UI, switching to 22px Section Heading below 480px. Titles are never line-clamped; use normal word breaking, `hyphens: auto`, and `overflow-wrap: anywhere` only as the final protection for an unbroken word.
- Synopsis measure is at most 68 characters per line.

## Spacing And Geometry

Base unit: **4px**

| Token | Value |
|---|---:|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-10` | 40px |
| `--space-12` | 48px |
| `--space-16` | 64px |

- Content maximum: 1200px.
- Page gutters: 16px small, 24px medium, 32px wide.
- Section separation: 64px wide, 40px small.
- Repeated-item gap: 7-12px depending on grid/rail density.
- Standard rectangular radius: 3px.
- Circular icon/rating geometry may be fully round; rectangular pills are not a global motif.
- Poster aspect ratio: 2:3.
- Player/video aspect ratio: 16:9.
- Interactive targets: minimum 44x44 CSS pixels.

## Surfaces And Depth

| Level | Surface | Treatment |
|---|---|---|
| 0 | Theater | Pure black, media only |
| 1 | Canvas | Cool near-black, uninterrupted page field |
| 2 | Surface | Dialog/menu/editorial utility block |
| 3 | Raised | Input, selected row, hover/active utility |

- In-flow sections are unframed bands on Canvas.
- Poster cards do not receive decorative containers.
- Use a 1px inset edge or surface shift for in-flow separation.
- Cast shadows are allowed only for menus, dialogs, and overlays that must separate from content.
- Never put a card inside another card.
- Never use glass, blur, gradient orbs, cosmic glows, or decorative background shapes.
- A photographic hero may use a dark directional overlay solely for text legibility.

## Imagery

- Use real licensed film stills and posters; no generic stock cinema imagery in product surfaces.
- Preserve natural image color. Do not apply a global brand tint or grade.
- Store focal-point metadata for backdrops and hero crops.
- Poster art is 2:3 and meets the edge of its item without padding or frame.
- Backdrops reserve stable wide dimensions before loading.
- Missing art uses a restrained typographic placeholder generated from Film Platform tokens; never fetch a random replacement.
- Decorative duplicate imagery uses empty alternative text; primary posters/stills use meaningful Turkish alt text.

## Global Navigation

- Full-width sticky Canvas surface with a constrained inner row.
- Height: 64px desktop, 56px small screens.
- Desktop order: brand, catalog, search, account.
- Mobile order: brand, search icon, menu icon.
- Search becomes a dedicated mobile layer rather than compressing into the navigation row.
- Use Lucide icons for familiar actions; icon-only controls have accessible names and tooltips when meaning is not universal.
- Navigation never becomes a floating pill or glass capsule.

## Featured Hero

- Full-bleed licensed backdrop; content aligns to the shared container and bottom-left reading axis.
- Height: 560px desktop, 480px small screens, preserving a visible hint of the next section.
- Content maximum: 560px.
- Show film title, concise metadata, short synopsis, primary watch action, and secondary detail action.
- One Acid Green primary action. Secondary action uses Control or ghost treatment.
- No autoplay with sound, split hero, floating content card, decorative gradient, or oversized marketing value proposition.

## Film Poster Item

- Stable 2:3 image first, followed by title and concise metadata.
- Render poster images with `object-fit: cover`, a stored focal point when available, and no stretching. Admin preview must reject an unsafe crop rather than adding ad-hoc letterbox decoration.
- Entire item has one clear detail-page link target; do not nest watchlist/rating controls inside that link.
- Title uses UI emphasis at compact size and wraps to a controlled two-line maximum in repeated grids.
- Year/rating use Metadata and Muted.
- Hover/focus may expose a thin Accent edge or useful action, but cannot resize the track.
- Touch and keyboard receive equivalent visible behavior.

## Film Rail

- Horizontal shelves are the primary home-page browsing pattern.
- Card widths: 132px small, 156px medium, 176px wide.
- Use native overflow and `scroll-snap-type: x proximity`.
- Desktop chevrons scroll by approximately one visible group and remain 44px targets.
- Preserve a partial continuation item when possible so overflow is obvious.
- Keyboard focus follows DOM order and scrolls into view; no focus trap or drag-only interaction.
- Skeletons preserve exact tracks; empty rails disappear.
- A ranked rail is a rare editorial variant and exposes rank in accessible text.

## Catalog Grid And Filters

- Compact page heading and result count; no cinematic hero on utility catalog pages.
- Filters are a desktop toolbar and accessible mobile sheet. Active filters remain visible as removable tags.
- Grid columns: 2 below 480px, 3 from 480px, 4 from 768px, 6 from 1024px, and 7-8 when the 1200px container preserves readable card width.
- Filter/sort state lives in the URL.
- Grid cards show poster, title, year, and optional rating only.
- Zero results preserve active filters and offer one reset action.

## Film Detail Composition

- Backdrop forms a full-bleed cinematic field; title block remains left aligned and unframed.
- Title is the strongest textual object, followed by one compact metadata line.
- Watch action appears only when playable. Watchlist and rating remain secondary product controls.
- Desktop editorial body uses a poster column and flexible reading column; mobile stacks them.
- Synopsis uses Editorial Body. Credits use compact label/value rows rather than person cards.
- Rating average and count are distinct from the member's interactive rating.
- Similar films appear as one rail after synopsis and credits.
- Do not imitate source title treatments, proprietary lockups, or white editorial page bands.

## Rating Control

- Five stars supporting half-star values from 0.5 to 5.
- Filled portion uses Accent; empty portion uses a Muted outline.
- Arrow keys adjust, Home/End jump, and a separate action removes the rating.
- Expose numeric value and count to assistive technology; green never carries meaning alone.

## Watch And Media Stage

- A full-width Theater band contains one centered, unframed 16:9 player up to 1200px wide.
- Watch navigation keeps only brand, back-to-detail, and account essentials.
- Player controls remain provider-owned where possible and accessible at all times by keyboard/screen reader.
- Preroll loading, ad playback, empty-ad, error-ad, ad-timeout, video loading, playing, paused, seeking, captions-loading, unavailable, and retry states occupy the same reserved frame.
- No site element covers native controls; provider-required ad UI is the only exception.
- Below the stage, show title, concise metadata, library/rating actions, synopsis disclosure, and support request ID when relevant.
- No glow, gradient, decorative frame, floating player card, or unrelated recommendation overlay around the picture.

## Buttons And Controls

### Primary

- Accent fill, Theater/canvas-dark text, UI 700, 10px 16px visible padding, 3px radius.
- Use for one primary non-destructive action per local region.

### Secondary

- Control fill, Bright/near-light text, UI 400/700, 3px radius, no shadow.

### Ghost

- No fill; Text moving to Bright on hover/focus. Focus ring remains visible.

### Destructive

- Danger semantic treatment and explicit verb. Never green.

Use symbols for familiar compact toolbar actions and text for commands whose meaning is ambiguous.

## Forms, Dialogs, And Menus

- Persistent labels; placeholders are examples only.
- Inputs use Raised surface and a visible inset focus ring.
- Errors appear adjacent to their field and in a form summary when submission fails.
- Dialogs use Surface, 3px radius, bounded overlay shadow, focus trap, Escape behavior, and focus return.
- Confirmation copy names the object and consequence.
- Menus/dialogs are the only common floating surfaces.

## Admin Mode

- Same palette and geometry, denser UI, no photographic hero.
- Stable desktop side navigation and responsive mobile menu layer.
- Tables, forms, audit entries, and status use spacing and hairlines before cards.
- Group editorial, imagery, credits, asset, subtitles, rights, and publication into clear un-nested sections.
- Public preview reuses the real detail component in preview mode.
- Status does not use Acid Green as a generic success color.

## Motion

- Route/section entry may use 220ms ease-out opacity plus at most 8px vertical translation. Rail items may stagger by 35ms for no more than the first six visible items.
- Dialog/layer entry uses 160ms ease-out. Hover/focus color transitions use 120ms ease-out and never move layout or change dimensions.
- Rail scrolling and player/ad transitions communicate real state; do not add decorative continuous motion.
- `prefers-reduced-motion` removes translation, stagger, and nonessential transition duration.
- Do not animate background decoration, because the films already supply motion and color.

## Required States

| State | Visual behavior |
|---|---|
| Loading | Stable skeleton or progress inside final dimensions |
| Empty | Domain-specific result plus one valid next action |
| Partial | Available metadata without fabricated placeholders |
| Error | Safe Turkish copy, safe retry, support request ID where relevant |
| Unauthorized | Sign-in path for member feature; visitor playback remains unaffected |
| Unavailable | Film remains coherent while watch action is absent/disabled with safe explanation |
| Offline | Preserve current page and identify actions that could not synchronize |

## Accessibility

- Target WCAG 2.2 AA.
- One logical `h1`, ordered headings, landmarks, labels, descriptions, and status announcements.
- All workflows operate by keyboard with visible focus and correct layer focus return.
- Test Turkish strings at 200% zoom and 320 CSS px width.
- Player/ad handoff, search combobox, mobile navigation, rating, dialogs, and destructive actions require manual assistive-technology checks.
- Do not rely on color, hover, pointer motion, or poster imagery alone to expose required information.

## Do

- Let poster/still photography dominate public content surfaces.
- Use Accent only for primary action, rating, and rare resume cue.
- Keep product/editorial typography boundaries explicit.
- Use stable dimensions for posters, rails, player, controls, and skeletons.
- Make title/credits composition feel editorial without changing the global palette.
- Keep watch UI subordinate to the picture while retaining accessible controls.
- Use real Turkish content during screenshot review, including unusually long titles.

## Do Not

- Do not combine source palettes or introduce source-brand red, blue, or violet.
- Do not copy logos, screenshots, proprietary fonts, wording, artwork, ranking graphics, or exact layouts.
- Do not create nested cards, floating page sections, glass, blur, decorative gradients, or large rounded pills.
- Do not use oversized marketing composition on catalog, watch, account, or admin routes.
- Do not hide controls only because pointer movement stops.
- Do not let a hover label, rating, loading state, or error resize a grid/rail track.
- Do not use pure white for long body copy or Acid Green as a generic success status.

## CSS Custom Properties

```css
:root {
  --color-theater: #000000;
  --color-canvas: #14181c;
  --color-surface: #202830;
  --color-surface-raised: #2c3440;
  --color-control: #445566;
  --color-muted: #667788;
  --color-text: #99aabb;
  --color-heading: #aabbcc;
  --color-bright: #ddeeff;
  --color-white: #ffffff;
  --color-accent: #00e054;
  --color-accent-strong: #00c030;
  --color-danger: #e05a47;
  --color-warning: #e0a800;

  --font-ui: "DM Sans", ui-sans-serif, sans-serif;
  --font-editorial: "Source Serif 4", ui-serif, serif;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  --content-max: 1200px;
  --radius-rect: 3px;
  --poster-ratio: 2 / 3;
  --video-ratio: 16 / 9;
}
```

## Tailwind v4 Theme

```css
@theme {
  --color-theater: #000000;
  --color-canvas: #14181c;
  --color-surface: #202830;
  --color-surface-raised: #2c3440;
  --color-control: #445566;
  --color-muted: #667788;
  --color-text: #99aabb;
  --color-heading: #aabbcc;
  --color-bright: #ddeeff;
  --color-accent: #00e054;
  --color-accent-strong: #00c030;
  --color-danger: #e05a47;
  --color-warning: #e0a800;

  --font-ui: "DM Sans", ui-sans-serif, sans-serif;
  --font-editorial: "Source Serif 4", ui-serif, serif;

  --radius-rect: 3px;
}
```

## Agent Handoff

For a UI task, provide the coding agent with:

1. `docs/05-DESIGN-SYSTEM.md`.
2. This `DESIGN.md`.
3. The relevant section from `docs/design/SCREEN-BLUEPRINTS.md`.
4. Product acceptance criteria and required states from the active work package.

Reference extracts are research evidence only and should not be loaded unless a design decision is being reviewed.