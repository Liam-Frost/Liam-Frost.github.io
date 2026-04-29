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

### Upcoming

- Create Stage 3 PR.

## Future Stages

- Verify PostgreSQL path with Docker or a real VPS database.
- Add photo CRUD and image upload processing.
- Add projects module.
- Add books, movies, TV, and anime module with metadata import.
- Add VPS deployment files, Nginx, HTTPS, and backups.
