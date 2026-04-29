# Development Log

## 2026-04-26

- User requested starting the migration to a full personal site with separate front-end and back-end.
- User required the migrated page to look and behave the same as before migration.
- User required a clean repository structure separating front-end and back-end code.
- User required project docs under `docs` with progress, logs, and decision records.
- User required frequent commits to `dev`, Claude Code CLI review after major stages, fixes from review, and PR notification.
- User required future image storage to support Cloudflare R2 while also allowing local paths or image-host URLs.
- The model created `dev` and committed the current front-end baseline before structural migration.
- The model started Stage 1 by moving the front-end to `apps/web`, adding `apps/api`, and extracting shared photo data to `packages/content`.
- The model installed npm workspace dependencies with `npm install`.
- The model verified `npm run typecheck` and `npm run build` successfully.
- The model started the API temporarily and verified `/api/health` plus `/api/photos`; the API returned 40 photos.
- The model attempted Claude Code CLI review. Local `claude` and `claude-code` commands were unavailable; `npx @anthropic-ai/claude-code` resolved version `2.1.119` but could not run the review because the environment is not logged in.
- The model performed a local self-check and changed API startup so importing `buildServer()` will not automatically bind a port.
- After the user logged into Claude Code, the model ran a full `main..dev` Claude Code review.
- The model fixed the review findings: added Spotify URL validation and external-call error handling, changed default CORS from allow-all to local dev origins, disabled API fetching for the GH Pages workflow, added a touch-accessible SpotifyDock close control, avoided rendering a no-op Spotify cover button without audio, added CI typecheck, and corrected a misleading homepage photo comment.
- The model re-ran `npm run typecheck`, `npm run build`, and Fastify route injection checks for `/api/health` plus `/api/photos`; all passed.
- The model pushed `dev` to `origin/dev`.
- The model attempted `gh pr create`, but GitHub CLI was not initially available in the shell PATH. GitHub returned the branch PR creation URL for manual continuation.
- After the user installed GitHub CLI, the model found `gh.exe` at `C:\Program Files\GitHub CLI\gh.exe`, removed the empty untracked root `src/` directory, and retried PR creation. The retry is blocked because GitHub CLI is installed but not authenticated in this environment.
- After GitHub CLI authentication became available, the model created PR #1.
- The user asked to continue the next stage.
- The model started Stage 2 by adding Prisma/PostgreSQL foundations while preserving seed fallback behavior.
- The model added a local PostgreSQL `compose.yaml`, Prisma `Photo` model, DB client helpers, photo repository, and seed script.
- The model added `dotenv` loading so local `apps/api/.env` values are available to the API server and seed script.
- The model upgraded Prisma from 6.19.0 to 6.19.3 after `npm audit` found a high-severity issue in the Prisma CLI dependency chain; `npm audit --audit-level=high` then reported 0 vulnerabilities.
- The model verified `npm run db:generate`, `npm run typecheck`, `npm run build`, and seed-fallback photo API behavior with Fastify `inject`.
- Docker is not installed in the current shell, so the real PostgreSQL container verification is deferred.
- The model ran Claude Code CLI review for Stage 2.
- The model fixed Stage 2 review findings by binding Postgres to localhost only, replacing string visibility with a Prisma enum, improving seed error handling, making `db:migrate` seed after migration, pinning Prisma versions exactly, and documenting `db:migrate`.
- The model re-ran `npm run db:generate`, `npm run typecheck`, `npm run build`, `npm audit --audit-level=high`, and seed-fallback route checks; all passed.
- PR #1 had already been merged, so Stage 2 changes were opened as PR #2: https://github.com/Liam-Frost/Liam-Frost.github.io/pull/2
- PR #2 was merged before Stage 3 work began.
- The model fast-forwarded local `dev` to latest `origin/main` and pushed `dev` so the next stage starts from the merged state.
- The model started Stage 3 by adding admin authentication endpoints, password hashing, signed HttpOnly session cookies, and a hidden `/admin` front-end login page.
- The model documented admin setup and Stage 3 scope in `docs/admin.md`.
- The model verified Stage 3 with `npm run typecheck`, `npm run build`, `npm audit --audit-level=high`, `npm run auth:hash -- test-password`, and Fastify `inject` checks for configured and unconfigured admin auth flows.
- The model ran Claude Code CLI review for Stage 3.
- The model fixed Stage 3 review findings by adding manual login rate limiting, making `requireAdmin` a preHandler-style guard, adding in-memory session revocation on logout, documenting explicit scrypt parameters, and strengthening production cookie documentation.
- The model re-ran verification after review fixes, including a login rate-limit check where the 9th bad attempt returned `429`.

## Notes

- A direct Windows directory rename of `src` failed with `Permission denied`; the migration continued by moving source subdirectories individually.
- The tracked `my-app` Vite scaffold was removed as unused project noise during the repository structure cleanup.
