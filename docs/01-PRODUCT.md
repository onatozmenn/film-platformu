# Product Specification

Status: **Approved baseline for MVP**  
Working product name: **Film Platform**  
Primary locale: **Turkish (`tr-TR`)**

## Product Promise

Film Platform is a fast, editorially curated place to discover and watch licensed films. Visitors can watch without creating an account. An optional account adds a watchlist, ratings, and synchronized viewing progress. The MVP is free to viewers and funded by restrained in-player advertising.

This is not a clone of any reference site. The product may borrow familiar catalog and watch-page information architecture, but its brand, copy, code, visual assets, and content inventory must be original or properly licensed.

## Fixed Product Decisions

| Area | MVP decision |
|---|---|
| Access | Free; playback does not require an account |
| Revenue | Ad-supported, one preroll opportunity per playback session |
| Video | Mux managed video, hidden behind a provider adapter |
| Accounts | Optional; email-link sign-in first |
| Market | Turkish-first UI and catalog |
| Brand | `Film Platform` is a temporary name read from configuration |
| Content | Operator-owned or distribution-licensed films only |
| Editorial model | Curated catalog; no public user uploads |

## Users And Roles

| Role | Capabilities |
|---|---|
| Visitor | Browse, search, inspect details, and watch published films |
| Member | Visitor capabilities plus watchlist, rating, and cross-device progress |
| Editor | Create and edit metadata, collections, credits, subtitles, and publication schedules |
| Admin | Editor capabilities plus rights, playback assets, role management, and audit access |

Authorization is additive. An editor is not automatically allowed to change user roles or rights windows unless also granted the admin role.

## MVP Journeys

### 1. Discover From The Home Page

- The first viewport identifies the product and features one currently watchable film against a real cinematic still.
- A hint of the next catalog section remains visible on common mobile and desktop viewports.
- Curated rows show featured, newly added, and popular films. Signed-in members may also see continue-watching.
- Every film tile exposes a stable path to its detail page and has useful image alternative text.
- Empty collections disappear rather than rendering empty chrome.

### 2. Browse And Search

- `/filmler` supports genre, release year, and sort filters in the URL.
- `/arama?q=` returns title, original-title, and credited-person matches.
- Search suggestions are debounced, keyboard navigable, and never reveal draft or rights-ineligible content.
- Filtered pages are linkable, refresh-safe, and provide a clear no-results state.

### 3. Inspect A Film

- `/film/[slug]` shows poster, backdrop, title, original title when different, year, runtime, age rating, genres, synopsis, principal credits, average rating, and available subtitle languages.
- Age ratings are informational in MVP. They do not gate playback or prove a viewer's age.
- The watch action appears only when the film is playable at request time.
- Missing optional metadata is omitted cleanly; fabricated metadata is never displayed.
- Similar films are deterministic from shared genres in MVP, not an opaque recommendation model.

### 4. Watch With A Restrained Ad

- `/izle/[slug]` asks the server for a short-lived playback grant. The server rechecks publication state, rights window, territory, and asset readiness.
- Each newly created playback session has at most one preroll opportunity. The MVP has no popups, overlays, postroll, or midroll ads.
- The first production ad adapter uses Google IMA with a Google Ad Manager VAST tag. Test tags are used outside production.
- If consent forbids personalized advertising, request a non-personalized ad. Do not initialize optional ad tracking before consent.
- If the ad provider is blocked, empty, or unavailable, record a coarse failure reason and continue to the film. Do not implement anti-ad-block circumvention.
- Playback never autoplays with sound. Native controls, keyboard operation, captions, and reduced-motion preferences remain usable.
- Members resume from saved progress. Visitors may keep progress only in local storage on that device; local data is never presented as synchronized.

### 5. Use An Optional Account

- Email-link sign-in avoids collecting passwords in MVP.
- A member can add or remove a film from a watchlist, rate it in half-star steps from 0.5 to 5, resume viewing, and clear their own history.
- Account deletion immediately revokes sessions and disables sign-in, then purges member/profile/auth data within 30 days. Initiation is irreversible in MVP; the same email may register again only after final purge.
- Authentication failure never blocks visitor playback of otherwise public content.

### 6. Curate The Catalog

- Editors can create a draft manually or import allowed metadata from TMDB, retaining source attribution.
- Admins attach a Mux asset, inspect processing status, add subtitle metadata, define a rights window, and preview the film before publication.
- Publication is rejected until all watchability invariants pass.
- Unpublishing takes effect for new playback grants immediately and does not delete the film record.
- Every role, rights, asset, and publication mutation creates an immutable audit event.

## Content Lifecycle

```text
DRAFT -------> PUBLISHED -> UNPUBLISHED -> DRAFT
    |                 ^
    +-> SCHEDULED ----+
                    |
                    +--------> DRAFT
```

- `IN_REVIEW` is not an MVP state; editorial review happens while a record remains `DRAFT`.
- `SCHEDULED` requires a future `publishAt` time.
- An authenticated internal cron command attempts due transitions. Reaching `publishAt` alone does not make a film public and never overrides missing rights or an unready asset.
- Expired rights make content unplayable even if its editorial state remains `PUBLISHED`.
- Deletion is an administrative retention operation, not an editorial workflow state.

## MVP Acceptance Boundary

The MVP is complete when a visitor can discover, search, inspect, and play a licensed film with the preroll policy; a member can persist watchlist, rating, and progress; and an admin can take a film from draft through safe publication. These journeys must pass the quality gates in `docs/07-QUALITY.md` on mobile and desktop.

## Explicitly Out Of Scope

- Subscription, rental, purchase, or payment processing
- User-uploaded video, public reviews, comments, follows, or chat
- Offline downloads, live channels, casting, or native mobile apps
- Machine-learning recommendations or per-user ad profiling
- Age-verification or age-based playback enforcement
- Midroll, postroll, page-banner, popup, or interstitial advertising
- Multi-tenant catalogs, multiple storefronts, or multi-region rights sales
- Self-hosted transcoding, HLS packaging, or DRM key infrastructure
- Scraping metadata, posters, subtitles, or streams from third-party film sites

## Owner Inputs Required Before Production

The coding agent must not invent these values:

- final brand name, logo, domain, and support address;
- proof of distribution rights and allowed territories for every film;
- Mux production account and signed-playback policy;
- Google Ad Manager account, approved VAST configuration, and ads.txt values;
- TMDB API credentials and required attribution treatment;
- privacy notice, cookie/consent policy, terms, takedown contact, and age-classification policy reviewed for the launch territories.
