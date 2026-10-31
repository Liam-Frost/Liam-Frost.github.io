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
- Ran Claude Code review (`docs/reviews/2026-10-31-claude-code-music-player.md`) and fixed ten findings.

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
- Ran `npm audit fix` (non-breaking). Remaining: 3 high findings in the Prisma 6 CLI dependency chain (`deepmerge-ts` via `@prisma/config`); the fix requires a Prisma major upgrade (done below, at the user's request). The non-breaking fix also upgraded the API's Fastify 5.8.5 to 5.12.7 and `fast-uri`; the API was re-checked in dev (`/api/photos`, `/api/spotify`, `/api/admin/session` returned 200).
- Manually verified in the browser with the API running in seed mode: home page, portfolio, category filter, photo modal, fullscreen viewer, theme switching (light/dark), language switching, 404 page, `/admin` login page, Spotify dock. No React errors in the console; 404 console entries come from the existing Flickr size fallback chain.
- Found two pre-existing issues during verification: a single Escape closed both the fullscreen viewer and the photo modal; the portfolio category filter stored a localized label, so switching language while filtered showed 0 photos.
- Ran Claude Code review for Stage 4 (`docs/reviews/2026-10-31-claude-code-stage-4.md`).
- Fixed review findings: the photo modal ignores keys while the fullscreen viewer is open; the category filter uses a language-independent key; documented the Fastify upgrade.
- Re-ran `npm run typecheck`, `npm run build`, and browser checks for both fixes.
- Created Stage 4 PR #4: https://github.com/Liam-Frost/Liam-Frost.github.io/pull/4
- At the user's request, upgraded Prisma 6.19.3 to 7.10.1 in the same PR: `prisma-client` generator with output in `apps/api/src/generated/prisma`, `apps/api/prisma.config.ts`, `@prisma/adapter-pg` driver adapter with a 5s connect timeout, scripts that run `prisma generate` explicitly.
- Replaced the hand-written Prisma delegate shims in `photos.ts` / `seed.ts` with the generated types. This exposed a seed bug: nullable Json fields were written as `null`, which Prisma rejects; the seed now uses `Prisma.DbNull`.
- Ran `npm audit`; result: 0 vulnerabilities.
- Verified the real PostgreSQL path for the first time (no Docker; used `prisma dev` local Prisma Postgres): `prisma db push`, `npm run db:seed` (40 photos), API reads from the database (an edited row is returned, hiding a photo drops the public list to 39), missing photo returns 404, refused connection falls back to seed data in ~150 ms, unreachable host falls back after ~5 s.
- Ran a second Claude Code review for the Prisma upgrade and fixed its findings: honor `?schema=` in `DATABASE_URL`, log idle pool errors, stop regenerating the client in `start`, share the `DATABASE_URL` check, document the SSL behavior change. Verified a non-`public` schema end to end with `prisma dev`.

### Upcoming

- Stage 4 PR #4 merged on 2026-10-31.

### Stage 5: Back-End Foundation and Admin Auth Hardening

Status: implementation complete; Claude Code review complete and fixes applied.

- Added `apps/api/src/config/env.ts`: Zod-validated configuration, reporting every problem at once and stopping startup on invalid values.
- Added unified error handling (`HttpError`, `{ error: { code, message } }` for all errors including 404 and Fastify client errors), security response headers, and log redaction of auth headers and cookies.
- Added Zod input validation for login, photo params and the Spotify query.
- Refactored admin auth into a per-server `AdminAuthService` (rate limiter and revocations are no longer module globals).
- Added CSRF protection (`x-admin-request: 1` on admin writes) and switched the session cookie to `SameSite=Strict`.
- Added configurable `ADMIN_PATH` (validated, only revealed to a signed-in admin) and `ADMIN_ALLOWED_IPS` (IPv4/IPv6/CIDR; other IPs get the same 404 as an unknown route), plus `TRUST_PROXY`.
- Required `ADMIN_PASSWORD_HASH` and `ADMIN_SESSION_SECRET` to be set together; the secret must be at least 32 characters; `ADMIN_USERNAME` defaults to `admin`.
- Added `packages/shared` (admin path rules, CSRF header name, API types) for the API, web and the upcoming admin app.
- Updated the temporary `apps/web` `#/admin` page for the CSRF header and new error shape.
- Added Vitest with 27 API tests; root `npm test` runs workspace tests and CI now runs `npm test`.
- Ran `npm test` (27 passed), `npm run typecheck`, `npm run build`.
- Ran Claude Code review for Stage 5 (`docs/reviews/2026-10-31-claude-code-stage-5.md`) and fixed its findings: `TRUST_PROXY` accepts a proxy IP/CIDR list so a directly reachable API cannot be fooled by a spoofed `X-Forwarded-For`; blank numeric settings fall back to defaults; removed the unused `databaseUrl` config field and a duplicate configured check. Tests: 30 passed.
- Verified in the browser against a running API with a throwaway test password and `ADMIN_PATH=studio`: wrong password shows the server message, login works, `adminPath` is returned only after login, logout works, a POST without the CSRF header gets 403.

### Upcoming

- Stage 5 PR #5 merged on 2026-10-31.

### Stage 6: Admin App Scaffold

Status: implementation complete; Claude Code review complete and fixes applied.

- Added `apps/admin`: React 19.3, React Router 8, TanStack Query 5, Tailwind 4, Vite 8 with `@vitejs/plugin-react`; design tokens and components (Field, Toast, buttons, cards) adapted from `internal-developer-tools-portal`.
- Login page, "not configured" notice, layout with Overview / Photos / Projects navigation (sidebar on desktop, top bar on mobile), logout, placeholders for Photos (Stage 7) and Projects (Stage 8).
- API client with CSRF header and the shared error shape; any 401 returns to the login screen; logout drops cached admin data.
- API hosts the admin build at `ADMIN_PATH` (`routes/admin-app.ts`): injects `<base>` and the mount-path `<meta>`, serves only hashed assets and the favicon, strict CSP, IP allowlist 404. Implemented without `@fastify/static` (its `glob` dependency had moderate advisories).
- Admin dev server injects the same `<meta>` from `ADMIN_PATH` and proxies `/api` and `/uploads` to the API.
- Removed the temporary `apps/web` `#/admin` page, its route and CSS, and the web dependency on `@liam-frost/shared`.
- Root `npm run dev` starts API, web and admin with `concurrently`; `npm run build` also builds the admin app; `.claude/launch.json` has an `admin` entry.
- Added 5 API tests for admin hosting; `npm test`: 35 passed. `npm run typecheck`, `npm run build`, `npm audit` (0 vulnerabilities) passed.
- Browser checks with a throwaway test password: dev server (root URL shows a bare 404, `/admin/photos` shows login, wrong password shows the server message, login, navigation, mobile width without horizontal scroll, logout returns to login) and the API-served build at `http://localhost:8787/admin/photos` (assets load on a nested route, no CSP errors, login works, favicon served, session cookie not visible to scripts).
- Fixed during verification: the admin dev proxy read `PORT` from `loadEnv`, which includes the dev server's own `PORT`, so it proxied to itself; logout used `queryClient.clear()`, which detached the mounted session query so the UI stayed on the dashboard.
- Ran Claude Code review for Stage 6 (`docs/reviews/2026-10-31-claude-code-stage-6.md`) and fixed: logout button accessible name on mobile, retry for network errors, internal stage names in placeholder pages.

### Upcoming

- Stage 6 PR #6 merged on 2026-10-31.

### Stage 7: Photo Management and Upload Pipeline

Status: implementation complete; Claude Code review complete and fixes applied.

- Prisma: `ImageStorage` enum, `storage`, `storageKey`, `variants` on `Photo`. Committed the first migrations (`init`, `photo_uploads`) and added `npm run db:deploy`.
- `PhotoRepository` interface with a Prisma implementation (in-memory one for tests); replaced `db/photos.ts` and the unused `storage/config.ts` / `storage/images.ts`.
- Upload pipeline (`sharp` 0.35, `exif-reader`, `@fastify/multipart`): format and pixel limits, EXIF auto-rotation, WebP sizes 640/1280/2048/3072 without upscaling, metadata stripped from outputs, private original kept, EXIF suggestions for camera/lens/settings/date.
- Local storage under `UPLOAD_DIR`; `/uploads/photos/<id>/<n>.webp` served with an immutable cache, nothing else reachable.
- Admin API: list, get, upload (creates a hidden photo), patch (Zod-validated localized fields), delete (removes files), complete-list reorder (409 when stale).
- Public API: database photos are public-only, `GET /api/photos/:id` no longer returns hidden photos (it did before), no seed fallback for an empty database, `featured` and `variants` in the response.
- Admin UI: Photos page with upload (button or drop, sequential with progress), filters, grid with Flickr thumbnails, drag-and-drop and arrow reordering, delete confirmation; editor dialog with five language tabs, tags per language, public/featured switches. Ported Dialog and Switch from the portal.
- Web: uploaded photos use their generated sizes (`srcset`, 1280 px lightbox medium, viewport-sized full image); the home "featured" section now follows the `featured` flag (seed content marks the original ten); dev server proxies `/uploads`.
- Tests: 47 passed (12 new for photos).
- Verified end to end against a local Prisma Postgres (`prisma dev`) with seeded data and a throwaway admin password: 40 seed photos listed with Flickr thumbnails; a 3000x2000 upload produced 640/1280/2048/3000 sizes and a hidden photo; editing in two languages, publishing and featuring saved correctly; the public portfolio, home featured section and lightbox (1280 medium then 3000 full) showed it; arrow and drag-and-drop reordering persisted; delete removed the row and files. Mobile width without horizontal scroll.
- Ran Claude Code review for Stage 7 (`docs/reviews/2026-10-31-claude-code-stage-7.md`) and fixed: LF-only migration files via `.gitattributes` (Prisma checksums), hidden photos' images served only to the admin, decode the original once per upload, accurate upload error codes, uploads finished before the admin list loads.

### Upcoming

- Stage 7 PR #7 merged on 2026-10-31.

### Stage 8: Projects Module

Status: implementation complete; Claude Code review complete and fixes applied.

- User decisions: the home-page projects section sits between the introduction and the photos; everything else follows the proposed defaults (fields, list page, detail page, card style).
- Prisma `Project` model and `ProjectStatus` enum; migration `20261031090000_projects`.
- `ProjectRepository` with Prisma implementation (in-memory one for tests).
- Admin API: create (hidden, unique slug), edit (Zod: localized texts, slug, status, months with end >= start, tech stack without duplicates, http(s) links), cover upload (replaces and deletes the old one), screenshots (add, reorder, delete), delete (removes the project folder), complete-list reorder.
- Public API: `GET /api/projects` (public summaries, no body), `GET /api/projects/:slug` (public only).
- `/uploads/projects/<id>/<imageId>/<n>.webp` with the same visibility rules as photos.
- Shared upload reading and image saving between photos and projects (`routes/read-upload.ts`, `saveImage`).
- Admin UI: Projects list (create dialog with slug suggestion, reorder, delete) and a full editor page (language tabs, Markdown body, publish panel, info, tech stack chips, links, cover and screenshots).
- Web: home "projects" section after the tech stack and before the featured photos (up to four featured projects, hidden when none), nav link, `/projects` with tech filters, `/projects/:slug` with cover, meta, links, Markdown body (no raw HTML), screenshots and fullscreen viewer; strings in five languages; detail page lazy-loaded.
- Tests: 55 passed (8 new for projects).
- Verified end to end against a fresh local PostgreSQL (all three migrations applied with `db:deploy`, seed, throwaway admin password): created a project from the admin (slug suggested), filled two languages, Markdown with a table, code block and a `<script>` line, status, months, tech stack, repo link, public and featured; uploaded a cover (640/1280/2048/2400) and two screenshots, reordered them; the home page showed the section between `skills` and `featured`; `/projects` listed it; the detail page rendered the Markdown (script shown as text, links with `noopener`), screenshots in the new order and the fullscreen viewer; an unknown slug showed the 404 message; mobile width without horizontal scroll; deleting the project removed its files.
- Ran Claude Code review for Stage 8 (`docs/reviews/2026-10-31-claude-code-stage-8.md`) and fixed: lost updates from concurrent project image changes (per-project lock, new test), lighter image visibility lookup, 503 instead of 500 for the project detail without a database, shared `IconButton`, unsaved-changes indicator and confirmations in the editor. Tests: 56 passed.

### Stage 9: Full Local Run With Docker Compose

Status: implementation complete; Claude Code review complete and fixes applied.

- API production build: esbuild bundle in `apps/api/dist` (server, `hash-password`, `seed`) with the workspace packages and the generated Prisma client; `prisma` moved to `dependencies` for `migrate deploy` in the image.
- The API serves the public site build at `/` (exact-file allowlist built at startup, CSP with the inline bootstrap script's hash), next to the admin build and `/uploads`.
- Multi-stage `Dockerfile`: one image, non-root, health check, migrations on start (`docker/entrypoint.sh`).
- `compose.yaml`: PostgreSQL + app + Caddy (`docker/Caddyfile`), volumes for the database, uploads and Caddy data; app trusts proxy headers from the compose subnet only; settings from `.env` (`.env.example`).
- `docker/smoke-test.sh` and `.github/workflows/docker.yml`: build, start, check site/admin/seed/login/upload/music, restart, check data and migrations, clean up.
- Runbook: `docs/local-development.md`.
- This machine has no Docker or WSL: the stack was verified by the smoke test on GitHub Actions (passed), and the same production build ran here outside Docker against a temporary PostgreSQL (migrations with the Prisma CLI, seed, admin login, project with uploaded cover, single-origin site/admin/API in the browser).
- Ran Claude Code review for Stage 9 (`docs/reviews/2026-10-31-claude-code-stage-9.md`) and fixed five findings. Tests: 79 passed.

### Stage 11: Collection Data and Admin (Films, Series, Anime)

Status: implementation complete; Claude Code review complete and fixes applied.

- User decisions (see `docs/plan-collection.md`): no mainland China accessibility requirement; films, series and anime added one by one; ratings out of five; multilingual short reviews; "want" entries controlled by a global switch plus per-entry visibility.
- `MediaItem` model and migration `20261031150000_media` (checked against a real database with `prisma migrate diff`: empty).
- TMDB (v3 key or v4 token) and Bangumi sources: search, details in every site language TMDB provides, localized genres, credits, episode counts; posters downloaded from allowlisted hosts into the WebP pipeline.
- Admin routes for listing, searching, importing, manual creation, editing, poster replacement, deletion and display settings; poster visibility follows the entry, its kind and the "want" switch.
- Admin UI: 收藏 page (kind tabs, status filters, title filter, display settings), add dialog (search, already-added marks, manual entry), editor (status, stars, date, rewatches, progress, multilingual title/review/synopsis, details, poster, publish switches).
- Tests: 98 passed.
- Verified in the browser against a temporary PostgreSQL with live Bangumi data: searched and imported two anime (titles, year, credits, genres, 12 / 28 episodes, poster), edited status, rating, progress and reviews in two languages, featured; status filter, display settings, manual entry, duplicate import (409), deletion; phone width. The "TMDB not configured" path was checked. With the user's TMDB read access token, real searches and imports were checked for a film, a series and an anime film (titles in all five languages where TMDB has them, localized genres, directors, 20 episodes, 780x1170 posters); TMDB's zh-TW genre names turned out to be Simplified and are now left out.
- Ran Claude Code review for Stage 11 (`docs/reviews/2026-10-31-claude-code-stage-11.md`) and fixed six findings.

### Stage 12: Public Collection Page

Status: implementation complete; Claude Code review complete and fixes applied.

- Public API: `GET /api/collection` (shown kinds and entry summaries, without synopsis and review) and `GET /api/collection/:id` (synopsis, review, source link); both apply the visibility rules; an unreachable database gives an empty collection or 503.
- `/collection` page: kind tabs with counts, status buttons (in the URL), genre / year / minimum-rating filters, poster and list views (remembered per browser), detail panel addressed by `?item=` (Back and Esc close it; Tab stays inside), TMDB / Bangumi attribution; lazy-loaded.
- Home "最近在看" section after the projects and before the featured photos: up to six finished or ongoing entries, newest first, hidden when empty.
- Nav link 收藏 and about 40 strings in each of the five languages.
- TMDB imports use the original title for the work's own language (found in the browser: Breaking Bad had no English title).
- Tests: 103 passed.
- Verified in the browser with a temporary PostgreSQL and real TMDB / Bangumi imports (films, series, anime, a hidden entry, a "want" entry): home section, collection page, tabs, filters, list view, detail panel, Esc / Back, English, phone width (two columns, full-screen panel, no horizontal scroll).
- Ran Claude Code review for Stage 12 (`docs/reviews/2026-10-31-claude-code-stage-12.md`) and fixed four findings.

### Stage 12 Follow-Up: Sample Data, Proxy, Romaji

- `npm run db:seed:collection`: sample films, series and anime with ratings, reviews and statuses (13 entries imported into the user's local database for testing).
- The user's collection searches failed with "无法连接": `HTTPS_PROXY` existed only in the Claude app's environment, not in the user's terminal. The proxy now goes in `apps/api/.env` (added for the user), and the error message says so. Verified both ways with real TMDB and Bangumi searches.
- Anime titles in English and French now use the romaji name from AniList (new imports, and `npm run db:backfill:romaji` for existing ones; 4 entries updated in the user's database). Tests: 107 passed.
- Fixed a blank page when the site language is 繁體中文 and the page is reloaded (present since Traditional Chinese was added): the saved `zh-Hant` was lowercased to `zh-hant`, which matched no translation table. Language codes now map back to their canonical form, and an unknown language falls back to Simplified Chinese.

### Upcoming

- Review and merge the Stage 12 PR, then Stage 13 (music collection and player; needs a Spotify developer app).
- Stage 10: VPS deployment and CI/CD (needs the VPS provider/OS/specs, DNS manager and domain from the user).
- Stage 5: back-end foundation and admin auth refinement (`ADMIN_PATH`, IP allowlist, CSRF, Zod, tests). See `docs/plan-admin-projects-deploy.md`.

## Future Stages

- Verify PostgreSQL path with Docker or a real VPS database.
- Add photo CRUD and image upload processing.
- Add projects module.
- Add books, movies, TV, and anime module with metadata import.
- Add VPS deployment files, Nginx, HTTPS, and backups.
