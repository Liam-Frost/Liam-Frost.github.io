# Claude Code Review: Stage 12

Date: 2026-10-31

Scope: public collection (`6336470..0a6a07f`): `/api/collection` and `/api/collection/:id`, the `/collection` page, detail panel, home "最近在看" section, translations, and the TMDB original-language title fix.

## Findings Fixed

- Medium: without `?kind`, the page opened on the first shown kind even when it was empty, while other kinds had entries. It now opens the first kind that has entries.
- Medium: the detail panel's backdrop sat below the Spotify dock (z-index 100 vs 120), so on phones the dock covered the panel's last lines and the source link. The panel now sits above it.
- Low: the panel is a modal dialog but Tab left it for the covered page. Tab and Shift+Tab now cycle within the panel.
- Low: the collection page was in the main bundle. It is lazy-loaded like the project detail page (main bundle 452 kB; the page is an 8 kB chunk).

## Found During Browser Verification (Fixed Before Review)

- English titles were missing for English-language productions (e.g. Breaking Bad showed its Chinese title in English): TMDB leaves the original language's translation empty. Imports now use the original title for the work's own language (English, French or Japanese).

## Follow-Up Verification

- `npm test`: 103 passed. `npm run typecheck`, `npm run build`: passed.
- The lazy-loaded page renders (with no API it shows the empty message).
