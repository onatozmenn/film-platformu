# Design System Implementation Contract

Status: **Approved implementation contract for Midnight Programme**

## Source Resolution

Root `DESIGN.md` defines the original Midnight Programme visual direction. `docs/design/SCREEN-BLUEPRINTS.md` defines page hierarchy and responsive composition. The source files in `docs/design/references/` explain design evidence only and never control implementation.

- This document owns executable tokens, typography, geometry, component constraints, accessibility, and visual verification.
- `DESIGN.md` owns visual character and cross-surface composition.
- `SCREEN-BLUEPRINTS.md` owns route-specific reading order, layout, and interaction behavior.
- When they conflict, this implementation contract wins for tokens and accessibility; the screen blueprint wins for page composition unless it violates this contract.
- DM Sans and Source Serif 4 are the only approved product fonts unless a later ADR changes them.
- Acid Green `#00e054` is the only decorative/action accent and is reserved for primary action, rating, and rare resume cues.
- All rectangular controls and in-flow surfaces use a maximum 3px radius. Fully round geometry is limited to genuinely circular controls/icons.
- Set `letter-spacing: 0` globally. Hierarchy comes from size, weight, case, spacing, imagery, and surface polarity.
- Never import source-reference colors, fonts, logos, screenshots, copy, proprietary assets, or exact layouts.

## Visual Direction

The interface should feel like a quiet screening room crossed with a carefully typeset film programme, not a marketing landing page. Home and catalog are poster-first and fast to scan; film detail becomes editorial; watch mode removes everything that competes with the picture; admin remains dense and operational. Avoid decorative cards, floating section containers, illustration, abstract orbs, oversized marketing copy, and gradients used as decoration. A dark legibility overlay on a photographic hero is allowed.

Do not reproduce another site's logo, wording, asset selection, or exact page composition.

## Canonical Tokens

### Color

| Token | Value | Use |
|---|---|---|
| `--color-canvas` | `#14181c` | Body, navigation, footer |
| `--color-surface` | `#202830` | Menus, dialogs, review/editorial blocks |
| `--color-surface-raised` | `#2c3440` | Inputs, hover states, separators |
| `--color-control` | `#445566` | Secondary controls only |
| `--color-text` | `#99aabb` | Primary body and UI text |
| `--color-heading` | `#aabbcc` | Headings and emphasis |
| `--color-muted` | `#667788` | Secondary metadata and inactive icons |
| `--color-bright` | `#ddeeff` | Focused/high-contrast labels |
| `--color-white` | `#ffffff` | Short maximum-contrast text only |
| `--color-accent` | `#00e054` | Primary CTA, filled stars, rare brand mark |
| `--color-accent-strong` | `#00c030` | Accent hover/pressed state; not a success status |
| `--color-danger` | `#e05a47` | Destructive/error semantics only |
| `--color-warning` | `#e0a800` | Warning semantics only |

Semantic danger and warning colors are allowed because status must not be encoded as green or by text alone. Keep them rare and localized; they are not decorative palette accents.

### Typography

| Role | Family | Weight | Size / line height |
|---|---|---:|---|
| UI body | DM Sans | 400 | 14px / 1.5 |
| UI emphasis | DM Sans | 700 | 14px / 1.4 |
| Metadata | DM Sans | 400 | 11px / 1.4 |
| Section heading | DM Sans | 700 | 22px / 1.25 |
| Editorial body | Source Serif 4 | 400 | 15px / 1.67 |
| Editorial emphasis | Source Serif 4 | 700 | 22px / 1.25 |
| Hero display | Source Serif 4 | 700 | 36px / 1.33 |

Load DM Sans and Source Serif 4 with `next/font/google`, weights 400 and 700, `display: 'swap'`, and the Latin plus Latin Extended subsets needed for Turkish. Next.js must fetch them at build time and self-host the resulting files at runtime; the browser must not call Google Fonts. Preload the UI face and the hero/editorial face used above the fold, and use no synthetic weights. UI controls, tags, navigation, and metadata are always sans-serif; synopsis and long editorial prose are serif.

Long film titles must wrap without covering controls. Use 36px Source Serif 4 only when the title fits within two lines; otherwise use 26px DM Sans, switching to 22px below 480px. Never line-clamp a page/film title. Apply `word-break: normal`, `hyphens: auto`, and `overflow-wrap: anywhere` only as the final fallback for an unbroken word. Test real Turkish titles longer than 50 characters at 320 CSS px and 200% zoom.

### Geometry And Spacing

- Base spacing unit: 4px.
- Allowed spacing steps: 4, 8, 12, 16, 20, 24, 32, 40, 48, and 64px.
- Content maximum: 1200px.
- Page gutters: 16px small screens, 24px medium screens, 32px wide screens.
- Standard section separation: 64px desktop and 40px small screens.
- Rectangular radius: 3px.
- Film poster ratio: exactly 2:3. Images use `object-fit: cover`, validated/stored focal position when available, and never stretch; unsafe crops are corrected in admin rather than letterboxed ad hoc.
- Player and video preview ratio: 16:9 with stable dimensions before media loads.
- In-flow cards use color shifts or a 1px inset edge, not cast shadows.
- Menus, dialogs, and overlays may use the documented overlay shadow.

## Responsive Layout

### Navigation

- Sticky and full width on the canvas, with a constrained inner row.
- Desktop: brand left, primary links center, search and account actions right.
- Small screens: brand, search icon, and menu button share one stable-height row. The menu opens an accessible dialog/sheet; do not squeeze desktop links into overflow.
- Search becomes a dedicated full-width layer on small screens with autofocus, visible close control, and retained query.
- Every icon-only action uses Lucide and has an accessible name plus tooltip where meaning is not universal.

### Poster Grids

Use CSS Grid, not experimental masonry, because all primary posters share a 2:3 ratio.

| Container width | Columns |
|---:|---:|
| below 480px | 2 |
| 480px and above | 3 |
| 768px and above | 4 |
| 1024px and above | 6 |
| 1280px and above | 7 or 8 when the 1200px container preserves a usable poster width |

Use a 7px to 12px gap chosen once per grid. Hover labels, ratings, and loading states cannot change track dimensions.

### Hero

- Full-bleed photographic backdrop with focal-point metadata and a bottom/side dark overlay for legibility.
- Product/brand and featured film are both first-viewport signals.
- Keep enough height to carry the image, title, concise metadata, and one primary watch action while revealing the next section.
- Never place the hero content in a card or use a split text/media composition.
- If no licensed backdrop exists, replace the hero with a restrained catalog heading band; do not fabricate abstract art.

### Watch Page

- Player is the dominant unframed surface and remains 16:9.
- On desktop, essential film metadata may sit below or in a narrow adjacent utility region only when the player remains dominant.
- On small screens, controls and metadata stack below the player. No element overlays native player controls except provider-required ad UI.
- Ad loading, ad playing, video loading, unavailable, and retry states reserve stable space and do not shift the page.

## Component Contracts

### Film Poster Item

- Poster art reaches the 3px outer edge with no decorative frame.
- Title and year sit below the image; the entire item has one clear link target without nested interactive controls.
- Use a fixed aspect-ratio placeholder and meaningful alt text. A decorative duplicate poster uses empty alt text.
- Hover reveals only useful action state. Touch and keyboard users receive equivalent visible controls.

### Buttons

- Primary: Acid Green fill, near-black text for contrast, DM Sans 700, 10px 16px padding, 3px radius.
- Secondary: Graphite fill, Chalk text, no shadow, 8px 14px padding.
- Ghost: no fill; Pewter text moving to Glacier on hover/focus.
- Destructive: localized danger treatment and explicit verb.
- Use familiar icons instead of text in compact toolbars. Text remains for commands whose icon is ambiguous.
- All targets are at least 44 by 44 CSS pixels even when their visible glyph is smaller.

### Rating

- Five star controls; each position supports half-star input while exposing a clear accessible numeric value.
- Filled portion uses Acid Green; empty portion uses Fog outline.
- Keyboard arrows change the value, Home/End jump, and a separate action can remove a rating.
- Never rely on green alone; expose the numeric rating to assistive technology.

### Dialogs And Forms

- Use Radix behavior for focus trapping, return focus, escape handling, labels, and descriptions.
- Inputs use the raised surface, a visible focus ring, persistent labels, and inline field errors.
- Placeholder text is an example, not a label.
- Confirmation dialogs name the object and consequence. Destructive actions do not use a green confirm button.

### Search Combobox

- The text input uses `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls`, and `aria-activedescendant`; DOM focus remains in the input while suggestions are navigated.
- The popup uses `role="listbox"`; results use `role="option"`. Film/person sections use labeled groups without making group labels selectable.
- Arrow Down/Up moves the active option, Enter opens it, Escape closes suggestions while retaining the query, and Tab exits naturally without trapping focus.
- Pointer selection and keyboard selection produce the same destination. Closing the mobile search layer returns focus to its trigger.
- Loading/result counts use a polite live region. Empty results are not rendered as a disabled option.

### Safe Product Copy

- Map owned error/status codes to reviewed Turkish messages in module message files; never concatenate provider or rights details into UI copy.
- Generic unavailable copy: `Bu film şu anda oynatılamıyor.`
- Retryable playback copy: `Oynatma başlatılamadı. Lütfen tekrar deneyin.`
- Field validation identifies the field and correction without exposing account existence or internal state.

## State Matrix

Every data-driven surface implements these states deliberately:

| State | Required behavior |
|---|---|
| Loading | Dimensionally stable skeleton or progress indicator |
| Empty | Concise domain-specific result and next valid action |
| Error | Safe Turkish message, retry when safe, request ID for support |
| Partial | Render available metadata without invented placeholders |
| Unauthorized | Sign-in path for member features; no playback interruption for visitors |
| Unavailable | Explain that the film cannot currently play without exposing rights internals |
| Offline | Preserve current page; identify actions that could not sync |

Do not put tutorial copy, feature descriptions, keyboard-shortcut prose, or visual-style explanations into the product UI.

## Motion

- Route/section entry: 220ms ease-out opacity plus at most 8px vertical translation.
- Optional rail stagger: 35ms between no more than the first six visible items.
- Dialog/layer entry: 160ms ease-out. Hover/focus color: 120ms ease-out.
- Player and ad transitions communicate real state only; avoid continuous decorative motion.
- `prefers-reduced-motion` removes translation, stagger, and nonessential transition duration.
- Hover effects never move layout, resize cards, or hide information required to act.

## Accessibility And Visual Verification

- Target WCAG 2.2 AA, including text contrast, focus visibility, headings, landmarks, forms, dialogs, and player controls.
- Test at 360x800, 768x1024, 1440x900, and one wide desktop viewport.
- Use Playwright screenshots for home, catalog, detail, watch, auth, and admin states in light-free dark rendering.
- Verify no overlap, clipped Turkish text, blank media, layout shift, horizontal overflow, or inaccessible keyboard path.
- For the player, assert both nonblank rendered pixels and a usable control surface after media/provider fakes initialize.
