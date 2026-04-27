# Claude Code Review: Stage 1

Date: 2026-04-26

Scope: `git diff main...HEAD` on `dev` after the full-stack workspace migration.

## Findings Fixed

- High: `apps/api/src/routes/spotify.ts` called `spotify.getPreview` without local error handling. Fixed by wrapping the external call and returning `502` with a safe message.
- Low-medium: `apps/api/src/routes/spotify.ts` accepted arbitrary URL input. Fixed by allowing only `https://open.spotify.com/*` URLs.
- Medium: GitHub Pages builds would fetch `/api/photos` and receive a static-host 404. Fixed by adding `VITE_DISABLE_API_FETCH=true` to the GitHub Pages workflow and teaching the web app to keep seed data without fetching when that flag is enabled.
- Medium: `SpotifyDock` had no touch-friendly close affordance. Fixed by adding an explicit close button and blur-based collapse behavior.
- Medium: `SpotifyCard` rendered a cover button without an accessible action when no audio preview existed. Fixed by rendering a non-interactive cover container when audio is absent.
- Low: default API CORS allowed all origins. Fixed by defaulting to local development origins and leaving production origins configurable.
- Low: a featured photo comment mislabeled a Vancouver photo as Kyoto. Fixed the comment.
- Test gap: CI did not run typecheck. Fixed by adding `npm run typecheck` to the GitHub Pages workflow before build.

## Findings Deferred

- `packages/content` exports raw TypeScript source. This is accepted for now because it is workspace-only and consumed by Vite/tsx in this stage. Revisit when the package needs standalone Node consumption or publishing.
- No automated route or visual regression tests exist yet. This will be addressed in later stages after the database/admin surface begins to stabilize.

## Follow-Up Verification

- `npm run typecheck`: passed.
- `npm run build`: passed.
- Fastify `inject` verification: `/api/health` returned `200`; `/api/photos` returned `200` with 40 photos.
