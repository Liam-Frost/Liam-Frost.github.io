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

Status: in progress.

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

### Upcoming

- Run Claude Code CLI review for Stage 2.
- Fix any Stage 2 review findings.
- Push Stage 2 commits to `origin/dev`, updating PR #1.

## Future Stages

- Verify PostgreSQL path with Docker or a real VPS database.
- Add `/admin` authentication.
- Add photo CRUD and image upload processing.
- Add projects module.
- Add books, movies, TV, and anime module with metadata import.
- Add VPS deployment files, Nginx, HTTPS, and backups.
