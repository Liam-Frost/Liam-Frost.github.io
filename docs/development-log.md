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

## Notes

- A direct Windows directory rename of `src` failed with `Permission denied`; the migration continued by moving source subdirectories individually.
- The tracked `my-app` Vite scaffold was removed as unused project noise during the repository structure cleanup.
