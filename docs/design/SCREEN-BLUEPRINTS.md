# Screen Blueprints

Status: **Approved page-level design contract**

These blueprints translate the hybrid references into Film Platform screens. Canonical tokens and component behavior remain in `docs/05-DESIGN-SYSTEM.md`.

## Shared Frame

- The viewport uses the uninterrupted cool-dark canvas; page sections are not floating cards.
- Public routes share one sticky navigation row: 64px desktop, 56px small screens.
- Desktop navigation contains brand, catalog link, search trigger/input, and account action. Mobile contains brand, search icon, and menu icon in stable 44px targets.
- Main content uses a 1200px maximum with 16/24/32px responsive gutters; photographic hero and theater-stage backgrounds may run full bleed.
- Each route has one visible `h1`, a skip link, predictable landmarks, and focus restoration after dialogs/layers.
- Loading, empty, partial, error, unavailable, unauthorized, offline, and permission states reserve the same layout footprint as success where possible.

## Home `/`

Primary reference assignment: HBO Max hierarchy, Netflix rail behavior, Film Platform tokens.

### Reading Order

1. Persistent navigation.
2. Featured-film photographic hero.
3. Signed-in continue-watching rail when non-empty.
4. Featured editorial collection.
5. Newly added rail.
6. Popular/top-ten rail.
7. Genre-led rails with non-empty content only.
8. Footer.

## Footer

- Use the Canvas surface with one 1px top divider; it is a full-width band, not a card.
- The inner content uses the shared 1200px maximum and 64px desktop / 40px small-screen vertical padding.
- Desktop organizes two to four concise link groups. Small screens stack groups without accordion behavior unless the list later becomes materially longer.
- Include catalog/navigation links, privacy, terms, cookie/consent settings, support/takedown contact, and required TMDB/provider attribution.
- Use UI 12px/14px Text and Muted roles with Bright hover/focus. Do not add app-download badges, social links, or claims for products that do not exist.
- The footer remains reachable when catalog pagination is used; a future infinite-scroll decision must preserve an explicit route to it.

### Hero

- Use one licensed backdrop with stored focal point, natural color, and a legibility overlay only behind content.
- Desktop height: 560px below navigation. Small-screen height: 480px. The next section must remain visible in an 800px-tall viewport.
- Content is bottom-left aligned inside the shared container, maximum 560px wide.
- Show product mark/identity, film title, year/runtime/age rating, one concise synopsis line group, primary watch action, and one secondary detail action.
- Use Source Serif 4 display only for a short title; long titles switch to the DM Sans heading style without shrinking continuously with viewport width.
- Do not autoplay video/audio. A static backdrop is the default MVP hero.

### Rails

- Rail heading and optional `Tümünü gör` link share one unframed row.
- Poster cards remain 2:3. Target card widths: 132px small, 156px medium, 176px wide screens.
- Use horizontal overflow with `scroll-snap-type: x proximity`, not a custom drag engine.
- Desktop previous/next controls are 44px icon buttons and appear only when content exists beyond the viewport. Disabled controls remain stable but are not focusable.
- One activation scrolls by approximately one visible group while preserving a partially visible continuation card.
- Keyboard focus follows DOM order and never becomes trapped in the rail. Focused off-screen items scroll into view.
- Touch uses native momentum. Hide decorative scrollbars without removing keyboard or pointer scrolling.
- Loading skeletons preserve exact card tracks. An empty rail is omitted, not rendered as an empty frame.
- The top-ten variant may place large outlined numbers behind posters, but numbers remain decorative and accessible names expose rank in text.

## Catalog `/filmler`

Primary reference assignment: HBO Max poster-first hierarchy with Letterboxd density.

- Begin with a compact title and result count, not a marketing hero.
- Desktop filters occupy one toolbar above the grid. Mobile uses a filter icon button opening an accessible sheet; active filters remain visible as removable tags below the heading.
- Genre, year, and sort state live in the URL and survive refresh/back navigation.
- The primary grid follows the canonical 2/3/4/6/7-8 responsive columns.
- Poster, title, year, and optional rating are the only repeated-card content. Synopsis and action clusters do not appear in grid cards.
- Pagination/load-more preserves focus and URL state. Do not implement infinite scroll without a reachable footer and explicit product decision.
- Zero results retain the title and active filters, explain the result, and offer one clear filter-reset action.

## Search `/arama`

- Desktop search may expand from navigation into a stable input; mobile opens a full-width search layer.
- Suggestions form an accessible combobox with film/person grouping, keyboard navigation, and a visible close action.
- Input focus remains in the combobox while `aria-activedescendant` tracks options. Arrow keys navigate, Enter opens, Escape closes suggestions but retains the query, and closing the mobile layer returns focus to the search trigger.
- Search-result pages use the catalog grid, with matched person/title context above it.
- A blank query shows no fabricated trending search list. A query under two characters gives concise input guidance outside the results region.
- Recent searches remain device-local only after an explicit later product decision; MVP does not persist them.

## Film Detail `/film/[slug]`

Primary reference assignment: A24 editorial hierarchy rendered with Film Platform type and color.

### Header Field

- A full-bleed licensed backdrop creates the cinematic field, with stored focal point and dark bottom overlay.
- Place the title block left aligned inside the shared container. It is unframed and visually dominant.
- Title is followed by one compact metadata line: original title when different, year, runtime, age rating, and genres.
- Primary watch action appears only for currently playable content. Secondary actions are detail-safe commands such as watchlist and rating.
- Do not place title/actions inside a floating glass card.

### Editorial Body

- Desktop uses an unframed poster column plus a flexible reading column; mobile stacks poster, actions, synopsis, and credits.
- Synopsis uses Source Serif 4 at the editorial body measure, maximum 68 characters per line.
- Credits appear as ordered label/value rows: director, writers, principal cast. Avoid one card per person.
- Rating summary exposes average and count; member rating is a separate interactive control.
- Subtitle languages, availability, and content notices use compact DM Sans metadata.
- Similar films use one standard poster rail after the editorial content; they do not interrupt synopsis/credits.

## Watch `/izle/[slug]`

Primary reference assignment: Frame.io media dominance with HBO Max restraint.

- Navigation collapses to brand, back-to-detail, and account essentials; the player remains the first visual priority.
- A full-width pure-black theater band contains one centered 16:9 player with a 1200px maximum.
- No decorative card, border, gradient, glow, poster frame, or unrelated overlay surrounds the player.
- Before initialization, reserve the exact player ratio and show one centered state label/progress indicator.
- Preroll loading, ad playback, empty-ad, error-ad, ad-timeout, video loading, playing, paused, seeking, captions-loading, unavailable, and retry states occupy the same media frame.
- Provider-required ad UI is the only layer allowed above native player controls. Site navigation and metadata never cover controls.
- Keyboard and screen-reader controls remain available even when pointer chrome visually recedes.
- Below the theater band, show film title, concise metadata, watchlist/rating, synopsis disclosure, and support/error request ID when relevant.
- Related films are omitted from the initial watch viewport and appear only after essential metadata.

## Authentication And Account

- Auth routes are compact product surfaces, not promotional landing pages.
- Use one constrained form column on the canvas with persistent labels, provider status, generic account-enumeration-safe feedback, and a clear return path.
- Account pages use full-width bands or a simple two-column settings layout at desktop; do not nest cards.
- Watchlist and history reuse canonical poster grids/rails. Empty states name the missing collection and one valid next action.
- Destructive account deletion is visually separated, uses danger semantics, and never uses the Acid Green confirm action.

## Admin `/yonetim`

- Admin is a quiet operational mode using the same tokens but denser 12/14px UI type and no photographic hero.
- Desktop uses stable side navigation plus a main work region. Small screens switch to a menu layer; tables become prioritized lists rather than horizontally crushed grids.
- Tables, forms, state badges, audit entries, and previews remain unframed where spacing and hairlines are sufficient.
- Film edit pages group editorial metadata, imagery, credits, asset, subtitles, rights, and publication into clear sections without placing cards inside cards.
- Persistent publication status and save/validation summary remain visible without covering content.
- Preview uses the real public detail component in preview mode rather than a separately styled imitation.
- Dangerous rights, role, asset, publish, and unpublish operations expose actor permission, consequence, validation result, and audit outcome.

## Responsive Checkpoints

| Width | Required transformation |
|---:|---|
| 360px | Single-column chrome, 2-column catalog, 132px rails, stacked detail/player metadata |
| 480px | 3-column catalog where text remains readable; mobile layers remain active |
| 768px | 4-column catalog, wider rails, two-column forms only when labels fit |
| 1024px | Desktop navigation, 6-column catalog, detail poster/reading split |
| 1440px | 1200px content maximum, full desktop controls, no uncontrolled line growth |

No component may change height because a hover label, rating, icon, loading indicator, error, or translated Turkish string appears.

## Screenshot Acceptance Set

Capture deterministic Playwright evidence for:

- home hero plus first rail at 360x800 and 1440x900;
- rail beginning, middle, end, keyboard focus, and top-ten variant;
- populated/empty filtered catalog;
- search layer, suggestions, and results;
- detail with short title, long Turkish title, missing optional metadata, and unavailable playback;
- watch preroll, playing, buffering, captions, error, and unavailable states;
- account empty/populated library;
- admin list, edit validation, rights, publication, and audit views.

Reject screenshots with clipped text, hidden focus, blank media, nested-card framing, unexpected palette colors, oversized marketing composition, layout shift, or horizontal page overflow.