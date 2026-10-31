# Claude Code Review: Stage 4

Date: 2026-10-31

Scope: front-end dependency upgrade (React 19, React Router 8, Vite 8, Node 22), `main..dev`.

## Findings Fixed

- Medium: `PhotoModal` kept its window `keydown` handler active while `FullscreenImageViewer` was open, so one Escape closed both layers and ArrowLeft/Right switched the photo behind the fullscreen view. Fixed by not registering the modal's key handler while the viewer is open; focus returns to the modal close button when the viewer closes. (Pre-existing, found during Stage 4 verification.)
- Medium: the portfolio category filter stored the localized category label, so switching language while filtered showed 0 photos. Fixed by filtering on a language-independent key (the English category value) and rendering the label for the current language. (Pre-existing, found during Stage 4 verification.)
- Low: `npm audit fix` also upgraded the API's Fastify 5.8.5 to 5.12.7 (and `fast-uri`) without being recorded. Fixed by documenting it in `progress.md` and `decisions.md`.

## Findings Accepted

- `.claude/launch.json` is a tool-specific dev-server config; it is kept and recorded in `progress.md`.

## Follow-Up Verification

- `npm run typecheck`: passed.
- `npm run build`: passed.
- Browser: with the Architecture filter active, switching English → 简体中文 keeps the filter (3 photos, chip highlighted).
- Browser: in fullscreen, ArrowRight no longer changes the photo; the first Escape closes only the fullscreen viewer, the second closes the modal.
