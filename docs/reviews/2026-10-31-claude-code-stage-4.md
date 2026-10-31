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

## Second Review: Prisma 7 Upgrade

Scope: `9663797..8a08984` (Prisma 6.19.3 → 7.10.1).

### Findings Fixed

- Medium: node-pg ignores Prisma's `?schema=` URL parameter, so a non-`public` schema would silently read `public` and fall back to seed data. Fixed by reading `schema` from `DATABASE_URL` and passing it to `PrismaPg`.
- Low: idle pool connection errors were swallowed (no `onPoolError`). Fixed by logging them as warnings.
- Low: `start` ran `prisma generate` on every start, requiring the Prisma CLI at runtime. Fixed: only `dev`, `build`, and `typecheck` generate.
- Low: `getPrismaClient` duplicated the `hasDatabaseUrl` check. Fixed with a shared `readDatabaseUrl` helper.
- Informational: Prisma 7 / node-pg verifies SSL certificates. Documented in `database.md`.

### Follow-Up Verification

- `npm run typecheck`, `npm run build`: passed.
- Local Prisma Postgres (`prisma dev`) with `DATABASE_URL=...&schema=site`: `db push` created tables in `site`, seed wrote 40 rows to `site."Photo"`, no `public."Photo"` table exists, and the API returned an edited `site` row.
