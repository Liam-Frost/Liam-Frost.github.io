# Progress

## 2026-04-26

### Stage 0: Baseline Preservation

Status: complete.

- Created `dev` branch from `main`.
- Committed the pre-migration front-end state so the current UI can be recovered easily.

### Stage 1: Repository and API Foundation

Status: implementation complete; Claude Code review complete and fixes applied.

- Moved the current front-end into `apps/web`.
- Added `apps/api` Fastify service scaffold.
- Added `packages/content` for shared photography content.
- Added `/api/health`, `/api/photos`, `/api/photos/:id`, and `/api/spotify` endpoints.
- Added image storage config scaffolding for `remote-url`, `local`, and `r2`.
- Updated docs to record architecture, progress, and decisions.
- Verified `npm run typecheck` passes.
- Verified `npm run build` passes.
- Verified API runtime endpoints: `/api/health` and `/api/photos` returned successfully with 40 photos.
- Ran Claude Code CLI review via `npx @anthropic-ai/claude-code` after authentication was available.
- Fixed review findings for Spotify API error handling, Spotify URL validation, default API CORS origins, GH Pages API fetch disablement, SpotifyDock touch dismissal, SpotifyCard cover accessibility, CI typecheck, and a misleading featured photo comment.
- Re-verified `npm run typecheck` passes after review fixes.
- Re-verified `npm run build` passes after review fixes.
- Re-verified API route behavior with Fastify `inject`: `/api/health` returned `200`, `/api/photos` returned `200` with 40 photos.
- Pushed `dev` to `origin/dev`.
- Removed an empty untracked root `src/` directory left behind by the Windows directory move; tracked source now lives under `apps/web/src` and `packages/content/src`.
- Found GitHub CLI at `C:\Program Files\GitHub CLI\gh.exe`, but PR creation is blocked because `gh` is not authenticated in this environment.
- Created PR #1 after GitHub CLI authentication became available.

### Stage 2: PostgreSQL and Prisma Foundation

Status: implementation complete; Claude Code review complete and fixes applied.

- Added Prisma dependencies to `apps/api`.
- Added PostgreSQL `Photo` model in `apps/api/prisma/schema.prisma`.
- Added DB client helpers and photo repository with database-first, seed-fallback behavior.
- Updated photo API routes to read through the repository.
- Added seed script to upsert shared photo content into PostgreSQL.
- Added `compose.yaml` with local PostgreSQL service.
- Added root database scripts: `db:generate`, `db:push`, `db:migrate`, `db:seed`, and `db:studio`.
- Ran `npm run db:generate` successfully with Prisma 6.19.3.
- Ran `npm audit --audit-level=high`; result: 0 vulnerabilities.
- Ran `npm run typecheck`; result: passed.
- Ran `npm run build`; result: passed.
- Verified API seed fallback with Fastify `inject`: health returned `database: seed`, photos returned 40 items, existing photo returned 200, missing photo returned 404.
- Docker is not available in the current local shell, so the real PostgreSQL container path could not be verified here.
- Ran Claude Code CLI review for Stage 2.
- Fixed review findings: local-only Postgres port binding, Prisma `Visibility` enum, seed error handling, `db:migrate` seeding workflow, exact Prisma version pins, and missing `db:migrate` docs.
- Re-ran `npm run db:generate`, `npm run typecheck`, `npm run build`, `npm audit --audit-level=high`, and Fastify seed-fallback route checks after review fixes.
- Created Stage 2 PR #2: https://github.com/Liam-Frost/Liam-Frost.github.io/pull/2

### Upcoming

### Stage 3: Admin Authentication Foundation

Status: implementation complete; Claude Code review complete and fixes applied.

- Added admin password hashing command: `npm run auth:hash -- your-password`.
- Added API admin auth configuration using `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, and `ADMIN_SESSION_SECRET`.
- Added scrypt password verification and HMAC-signed HttpOnly session cookies.
- Added API routes: `GET /api/admin/session`, `POST /api/admin/login`, and `POST /api/admin/logout`.
- Added reusable `requireAdmin()` guard for future admin CRUD routes.
- Added hidden front-end `/admin` route with login form and authenticated placeholder dashboard.
- Added `docs/admin.md` with setup and scope.
- Ran `npm run typecheck`; result: passed.
- Ran `npm run build`; result: passed.
- Ran `npm audit --audit-level=high`; result: 0 vulnerabilities.
- Verified `npm run auth:hash -- test-password` generates a scrypt password hash.
- Verified admin API flow with Fastify `inject`: unauthenticated session, failed login, successful login with cookie session, authenticated session, logout, and unconfigured auth response.
- Ran Claude Code CLI review for Stage 3.
- Fixed review findings: added real login rate limiting, converted `requireAdmin` into a preHandler-style guard, added in-memory session revocation on logout, documented scrypt parameters explicitly, and strengthened production cookie documentation.
- Re-ran `npm run typecheck`, `npm run build`, `npm audit --audit-level=high`, admin auth flow checks, session revocation checks, and login rate-limit checks after review fixes.
- Created Stage 3 PR #3: https://github.com/Liam-Frost/Liam-Frost.github.io/pull/3

- PR #3 merged on 2026-10-31.

## 2026-10-31

### Stage 4: Front-End Dependency Upgrade

Status: implementation complete; Claude Code review complete and fixes applied.

- Upgraded `apps/web` to React 19.3.1 and React DOM 19.3.1, with `@types/react` / `@types/react-dom` 19.3.0.
- Replaced `react-router-dom` 6 with `react-router` 8.5.1 (v8 ships a single package); updated all imports.
- Upgraded Vite 6 to 8.3.5, `@vitejs/plugin-react-swc` to 4.3.3, `lucide-react` 0.562 to 1.65.0, `@icons-pack/react-simple-icons` to 13.15.1.
- Ran `npm dedupe` to remove a stale hoisted React 18 copy that would have caused duplicate React instances.
- Set CI Node version to 22 and added root `engines.node >=22.22.0` (required by React Router 8).
- Added `.claude/launch.json` for local web/API dev servers.
- Ran `npm run typecheck`; result: passed.
- Ran `npm run build`; result: passed (Vite 8).
- Ran `npm audit fix` (non-breaking). Remaining: 3 high findings in the Prisma 6 CLI dependency chain (`deepmerge-ts` via `@prisma/config`); the fix requires a Prisma major upgrade and is deferred. The non-breaking fix also upgraded the API's Fastify 5.8.5 to 5.12.7 and `fast-uri`; the API was re-checked in dev (`/api/photos`, `/api/spotify`, `/api/admin/session` returned 200).
- Manually verified in the browser with the API running in seed mode: home page, portfolio, category filter, photo modal, fullscreen viewer, theme switching (light/dark), language switching, 404 page, `/admin` login page, Spotify dock. No React errors in the console; 404 console entries come from the existing Flickr size fallback chain.
- Found two pre-existing issues during verification: a single Escape closed both the fullscreen viewer and the photo modal; the portfolio category filter stored a localized label, so switching language while filtered showed 0 photos.
- Ran Claude Code review for Stage 4 (`docs/reviews/2026-10-31-claude-code-stage-4.md`).
- Fixed review findings: the photo modal ignores keys while the fullscreen viewer is open; the category filter uses a language-independent key; documented the Fastify upgrade.
- Re-ran `npm run typecheck`, `npm run build`, and browser checks for both fixes.
- Created Stage 4 PR #4: https://github.com/Liam-Frost/Liam-Frost.github.io/pull/4

### Upcoming

- Review and merge Stage 4 PR #4.
- Stage 5: back-end foundation and admin auth refinement (`ADMIN_PATH`, IP allowlist, CSRF, Zod, tests). See `docs/plan-admin-projects-deploy.md`.

## Future Stages

- Verify PostgreSQL path with Docker or a real VPS database.
- Add photo CRUD and image upload processing.
- Add projects module.
- Add books, movies, TV, and anime module with metadata import.
- Add VPS deployment files, Nginx, HTTPS, and backups.
