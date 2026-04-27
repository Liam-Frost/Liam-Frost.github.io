# Progress

## 2026-04-26

### Stage 0: Baseline Preservation

Status: complete.

- Created `dev` branch from `main`.
- Committed the pre-migration front-end state so the current UI can be recovered easily.

### Stage 1: Repository and API Foundation

Status: implementation complete; external Claude Code review is blocked by local authentication.

- Moved the current front-end into `apps/web`.
- Added `apps/api` Fastify service scaffold.
- Added `packages/content` for shared photography content.
- Added `/api/health`, `/api/photos`, `/api/photos/:id`, and `/api/spotify` endpoints.
- Added image storage config scaffolding for `remote-url`, `local`, and `r2`.
- Updated docs to record architecture, progress, and decisions.
- Verified `npm run typecheck` passes.
- Verified `npm run build` passes.
- Verified API runtime endpoints: `/api/health` and `/api/photos` returned successfully with 40 photos.
- Attempted Claude Code CLI review via local `claude`, local `claude-code`, and `npx @anthropic-ai/claude-code`.
- Claude Code CLI review could not complete because the environment is not logged in: `Not logged in · Please run /login`.

### Upcoming

- Run Claude Code CLI review after authentication is available.
- Fix any external review findings.
- Prepare PR after external review is complete, or create it earlier if the user approves proceeding without that review.

## Future Stages

- Add PostgreSQL and Prisma.
- Migrate photo content from seed data into database records.
- Add `/admin` authentication.
- Add photo CRUD and image upload processing.
- Add projects module.
- Add books, movies, TV, and anime module with metadata import.
- Add VPS deployment files, Nginx, HTTPS, and backups.
