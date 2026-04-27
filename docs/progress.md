# Progress

## 2026-04-26

### Stage 0: Baseline Preservation

Status: complete.

- Created `dev` branch from `main`.
- Committed the pre-migration front-end state so the current UI can be recovered easily.

### Stage 1: Repository and API Foundation

Status: in progress.

- Moved the current front-end into `apps/web`.
- Added `apps/api` Fastify service scaffold.
- Added `packages/content` for shared photography content.
- Added `/api/health`, `/api/photos`, `/api/photos/:id`, and `/api/spotify` endpoints.
- Added image storage config scaffolding for `remote-url`, `local`, and `r2`.
- Updated docs to record architecture, progress, and decisions.

### Upcoming

- Install/update workspace dependencies and lockfile.
- Run type checks and front-end build.
- Run API health verification.
- Invoke Claude Code CLI review for the stage if the CLI is available.
- Fix review/build findings, commit, and prepare PR.

## Future Stages

- Add PostgreSQL and Prisma.
- Migrate photo content from seed data into database records.
- Add `/admin` authentication.
- Add photo CRUD and image upload processing.
- Add projects module.
- Add books, movies, TV, and anime module with metadata import.
- Add VPS deployment files, Nginx, HTTPS, and backups.
