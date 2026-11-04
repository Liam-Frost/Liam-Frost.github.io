# Claude Code Review: Stage 21

Date: 2026-11-04

Scope: branch `stage-21-home-collection`: `featuredOrder` and its migration, `homeFeatured` in the collection settings, `pickHomeFeatured` / `excerpt` (`apps/api/src/media/home.ts`), `home.featured` in `GET /api/collection`, `PUT /api/admin/media/featured-order`, the admin 首页精选 dialog and setting, and the site's `HomeCollection`.

## Found During Verification (Fixed)

- Medium: settings saved before Stage 21 have no `homeFeatured`; a required field would have failed validation and silently reset every display switch to the defaults. The field defaults to `rotate` (test with older settings).
- Medium: Prisma's `update` sets `updatedAt`, so saving the order would have moved every featured entry to the top of the site's recent lists. The order is written with raw updates; checked in the browser (reordered entries kept their times).
- Low: with two featured entries the third column stayed empty; one or two picks now get wider cards.
- Low: on tablets the hidden recent cards would have been shown again with `display: block`, breaking the card layout; the rule now only hides.
- Low: in 显示设置 the divider ran through the 首页精选 heading (a fieldset legend sits on the border).

## Follow-Up Fixes

- Every page was wider than a 320 px screen. The header looked responsible (it was 349 px wide), but it only stretched with the page: hiding sections one at a time showed the contact email (24 px, no break opportunity) set the page width. It scales with the screen below 400 px and has `overflow-wrap: anywhere`.
- The page moved 15 px sideways whenever scrolling was locked (`body { overflow: hidden }` for drawers, the lightbox and the fullscreen viewer) or a short page got a scrollbar. `html { scrollbar-gutter: stable }` in the site and the admin keeps the scrollbar's room. `clientWidth` still reports the larger width while locked, but laid-out content does not move (measured on the header).

## Checked

- Rotation: the same picks all day, different the next day, every featured entry within a week, three different kinds when there are enough; only shown entries are picked (hidden entries, hidden kinds and hidden "want" entries never are).
- Fixed order: the saved order, never-ordered entries after it newest first; the order request must list every featured entry once (hidden ones too), and needs a signed-in admin and the CSRF header.
- Excerpts: whole sentences when one ends within 90 characters, otherwise cut with "…"; emoji are never split. Only the three picks carry review text.
- The site: each entry appears once across the parts; empty parts are hidden; an API without `home` (older server) gives no featured part instead of an error; static builds still hide the section.

## Not Changed

- Rotation is by day in `ANALYTICS_TIMEZONE`, like the site's statistics; picks change at midnight there.
- Songs can be featured; their card has no play button (it links to the song, which has one).

## Verification

- `npm test`: 213 passed. `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`: passed.
- Browser, temporary database with the sample collection: see `progress.md` (Stage 21).
