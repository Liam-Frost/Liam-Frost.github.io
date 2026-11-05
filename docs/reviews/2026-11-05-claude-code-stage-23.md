# Claude Code Review: Stage 23

Date: 2026-11-05

Scope: PR 48 (`codex/featured-quilt-wall`): `justified-layout.ts`, `FeaturedQuiltWall`, `HomeCollection`, `ScrollManager`, `featured-wall.css`, `pickHomeWall`, the `featuredWall` setting (shared type, validation, store, admin dialog) and their tests.

## Findings Fixed

- Medium (Codex P2): tiles grew by their raw aspect ratio. When a row's ratios add up to less than 1 (one portrait cover, a normal case for a small collection), flexbox hands out only that fraction of the row, so the cover was squeezed and a third of the canvas stayed empty (measured: 40 px of 120). Shares are now normalised per row.
- Medium (found in the browser): the wall has a px width, and the page's `<main>` is a grid item with `min-width: auto`, so the wall held the page open: after the window got narrower, the host never shrank, `ResizeObserver` never fired and the page scrolled sideways until a reload. The host now has `contain: inline-size`.
- Low: the ids shown by the wall were reported after paint, so the 在看 / 最近看完 shelves first excluded the three legacy picks and then changed. Reported in a layout effect now, before paint.
- Low: `home.wall.items` carried each featured entry's review excerpt in every language, unused by the wall; it carries ids only.

## Checked

- Layout: complete rows only, ordered prefix, no repeats, sparse collections shrink the canvas; heights within 0.6–1.7 of the target; unknown sizes measured and cached by URL.
- Settings: validated on save (1–8, 100–360, integers) in the admin and the API; old or broken stored values fall back field by field; saving refreshes the cache.
- Order: 固定顺序 exactly the admin's order after the visibility rules; 自动轮换 the same for every visitor on a day.
- Interactions: songs use the existing corner player (play, pause), Spotify embed mode only selects; other entries link to their details; hover, focus and touch reveal the overlay without changing the layout.
- `ScrollManager`: the anchor waits for the section to mount (observer disconnected after 8 s or when found).

## Not Changed

- The wall shows no review excerpt or rating, unlike the old cards (the reference design has none).
- `justified-layout.test.ts` lives in `apps/api/test` and imports from `apps/web`, since the site has no test runner.
- The admin's link to the home page is `/#/#watching`, like its other links to the site.

## Verification

- `npm test`: 248 passed. typecheck, lint, format, build: see the PR.
- Browser: `featured-quilt-wall.md` (Verification).
