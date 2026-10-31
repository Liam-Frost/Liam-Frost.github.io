# Claude Code Review: Stage 11

Date: 2026-10-31

Scope: collection backend and admin (`3ecbf36..d8c3c91`): `MediaItem` model and migration, TMDB / Bangumi sources, admin media and settings routes, poster serving, admin collection list, add dialog and editor.

## Findings Fixed

- Medium: TMDB translations fell back across Chinese regions, so a film with only a Simplified (CN) translation got the same text as its Traditional title. Chinese now uses only its own regions (CN/SG, TW/HK); other languages still fall back to any region.
- Medium: posters were downloaded from any https URL in the source responses, following redirects. Downloads are now limited to `image.tmdb.org` and `lain.bgm.tv`, and redirects are refused.
- Low: `watchedOn` accepted impossible dates such as `2026-02-31`. A round-trip check rejects them; it is written so that a value that already failed the format check cannot throw.
- Low: a failed TMDB genre list call made the whole import fail. Genre names now fall back to the details' Chinese names.
- Low: a source response without `results` / `data` caused a 500. It is now treated as no results.
- Low: every poster request read the collection settings from the database. `CollectionSettingsStore` caches them for 30 s, and saves update the cache at once.

## Found During Browser Verification (Fixed Before Review)

- The add dialog's search field did not get focus: `showModal()` focuses the first focusable element (the close button), so typing and Enter closed the dialog. `Dialog` now focuses an element marked `data-autofocus`.
- Bangumi tags mixed genres with studios and publishers, and the 原作 credit carried a long note. Tags named in the infobox are dropped (case-insensitive), and notes in parentheses are removed from credits.
- Bangumi `total_episodes` counts specials, openings and endings (16 for a 12-episode show). The main episode count (`eps`) is used.

## Follow-Up Verification

- `npm test`: 98 passed. `npm run typecheck`, `npm run build`: passed.
