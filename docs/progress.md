# Progress

## 2026-11-08: Website Settings and the Admin Interface

- Website Settings: all four phases are in (`website-settings-ui.zh-CN.md`): grouped settings, the tag dictionary, Simplified Chinese and English for the admin, account security and an in-app admin address switch (PRs #82, #83, #84).
- Logos, the avatar and the favicon are uploaded directly; page titles sit beside the favicon.
- Admin settings audit (`archive/admin-settings-audit/`) and the fixes from it: container-query layout, one surface contract, a Base UI `Select` everywhere, shared language tabs, one set of draft and leave rules, field-level saves, a phone navigation drawer, side-by-side cards of equal height.
- Tests: 395 API tests; Playwright layout and behaviour checks in `apps/admin/e2e` on Chromium, Firefox and WebKit.

## 2026-11-02: Analytics collection control

- Added an authenticated total switch on the analytics page. Its value is stored in the database and survives application restarts and clearing statistics.
- Removed the `ANALYTICS_ENABLED` environment toggle. Disabled collection stops visitor events, API metrics and job/source events while leaving historical reports available.
- Regression coverage checks authorization, CSRF, input validation, persistence across application instances and discarding buffered metrics when collection is disabled.
- Server configuration, credentials and operation guides are maintained outside this repository; only the CI/CD workflow definition is committed here.

## Repository maintenance (2026-11-01)

Local implementation and checks complete: PR CI, grouped Dependabot configuration,
MIT license/content rights, security policy, lint and formatting baseline, README
and maintenance documentation. All 157 tests, typecheck, lint, formatting and full
build pass. The initial PR CI and Docker integration runs also passed. Follow-up
CodeQL findings are addressed with global request limiting and stronger plain-text
description cleanup; regression coverage now totals 162 tests.

Pages HTTPS remains blocked on certificate issuance. Initial CodeQL alert triage,
the fixed regex, request limiting and the development dependency
advisory are documented in `repository-maintenance.md`. No VPS work is included.

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

### Music Player and Database Error Message

Status: implementation complete; Claude Code review complete and fixes applied.

- Database connection errors answer `503 DATABASE_UNAVAILABLE`; the admin shows "数据库连接失败" with setup steps instead of a bare 500.
- User decision: option B (keep the site's card, configure the playlist in the admin).
- `Setting` model (migration `20261031120000_settings`) and `SettingsRepository` (Prisma, in-memory).
- Playlist sync from Spotify's embed page with oEmbed covers (cached, 20 s budget per sync), failures keep the last good playlist; 6-hour refresh, 10-minute retry backoff per playlist; the first visitor waits at most 8 s.
- Routes: `GET /api/spotify/player`, `GET/PUT /api/admin/spotify`, `POST /api/admin/spotify/sync`. Removed the broken `/api/spotify?url=` route and `spotify-url-info`.
- The API honours `HTTPS_PROXY` (`http.setGlobalProxyFromEnv`); found because Node's fetch bypassed the local proxy that curl used.
- Admin "音乐" page: settings form and playlist status with the synced track list.
- Web player: plays the playlist (shuffled per round or in order) and loops; previous/next, media keys; hiding keeps the music playing (pulsing button); the two-second track rotation is gone. Static builds fall back to `site.ts` tracks.
- Tests: 74 passed.
- Verified with a temporary local PostgreSQL and a throwaway admin account: the real City Pop Best playlist synced (100 tracks, about 13 s the first time and 1.5 s with cached covers); the site played a preview, skipped to the next track, advanced on its own at the end of a preview, kept playing when hidden; the admin rejected a non-playlist link, normalized a link with `?si=`, saved sequential order and volume 50 (the site's player followed), and "立即同步" reported 100 tracks.
- Ran Claude Code review (`docs/archive/reviews/2026-10-31-claude-code-music-player.md`) and fixed ten findings.

### Upcoming

- Stage 19c: R2 storage for uploaded images (not started; uploads use the local store).
- Deployment and operations are tracked privately.
