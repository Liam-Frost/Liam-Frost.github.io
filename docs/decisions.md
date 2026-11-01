# Decisions

## User Decisions

### 2026-11-01: Cookieless Visitor Analytics, Admin Only

The user chose cookieless analytics for Stage 18: visitors are counted per day by a server-side hash with a daily salt, nothing identifying is kept in the browser, and returning visitors are not counted. Countries are collected (country code only). Statistics are shown only in the admin, not on the public site.

### 2026-11-01: Evaluate Node 26 and track TypeScript 7 support

User requested actual Node 26 compatibility validation after merging Dependabot
PRs #19, #20 and #23, and a way to revisit TypeScript 7 when lint tooling supports it.
Prepare a candidate PR that moves CI, Pages builds, the Docker image and Node types
together, with a minimum of Node 26.13.0 (the first Node 26 LTS release). Main stays
unchanged until review. Record the local runtime separately from hosted Linux/Docker
validation; green Node 22 tests alone are not evidence for the Node 26 container.

Keep TypeScript on the current supported version and PR #22 open. A weekly Monday
10:00 Asia/Shanghai chat monitor checks typescript-eslint's stable support range,
not merely ESLint's version, and reports only an actionable change or a problem
requiring user attention. It does not upgrade or merge automatically.

### 2026-11-01: Repository licensing and maintenance

Original code and technical documentation use the standard MIT license, attributed
to Liam Frost. Retaining the copyright/license notice is required; visible website
attribution is optional. Personal content and third-party materials are outside
the software license. Complete repository maintenance without VPS deployment work.

Implementation choices: use supported ESLint 10 with TypeScript recommended rules
and React Hooks checks, separate Prettier formatting, and a stable `Quality checks`
CI job. Preserve the Docker smoke test. Dependabot targets main so security-update
configuration applies, grouping related packages without automatic merging.
Establish LF formatting through EditorConfig and Git attributes. Security alert
triage and outstanding certificate/development-tool advisories are recorded in
`repository-maintenance.md` rather than silently dismissed or force-upgraded.

PR CodeQL findings prompted a follow-up: register the maintained Fastify rate-limit
plugin before routes (making `buildServer` asynchronous), with a shared 600/minute
client budget, health exemption, bounded cache and structured 429 responses. Keep
the stricter login limiter. Extract provider description text with a shared single-pass
scanner that never copies angle brackets, so nested tags cannot re-form markup. Validate both changes with regression
coverage and CI; do not suppress the scan findings.

### 2026-11-04: Stage 17 Scope

Before the yearly review, Stage 17 adds bulk actions in the admin, music views by album / artist / playlist with real playlists, and a Steam library sync (playtime, last played; purchase dates are not available from Steam's public API and are entered by hand). Plan: `docs/plan-collection.md` (Stage 17a-d).

### 2026-11-01: More Collection Kinds and Links

The collection should also cover books, comics, games and people (actors, directors, singers, writers and so on), and entries should link to each other: songs as soundtracks of works, adaptations of comics and books, and people's roles in works. Books, comics and games are new `MediaItem` kinds; people get their own table; links live in one relation table, stored once and shown on both sides. Plan: `docs/plan-collection.md` (Stages 14-16).

### 2026-10-31: Collection Module Scope

Movies, TV, anime and music get a collection module (`docs/plan-collection.md`). Mainland China accessibility is not a concern. There are no existing records for films, series or anime, so they are added one by one (search to prefill); music comes from a Spotify Liked Songs import plus manual additions. Ratings are out of five; short reviews are multilingual. Whether "want to watch" items show on the site is a global switch in the admin, plus each item's own visibility.

### 2026-10-31: Spotify Player Managed in the Admin (Option B)

The site keeps its own Spotify card. The API syncs a configurable playlist and the player loops through its 30-second previews (shuffled by default). The admin's "音乐" page sets the playlist, shuffle, volume and auto-collapse. The official Spotify embed player (option A) was not chosen: it cannot shuffle and does not match the site's style.

### 2026-10-31: Projects Section Placement and Defaults

The home-page projects section goes between the introduction and the photos. The other proposed defaults were accepted: localized title, summary and Markdown body; cover and screenshots; tech stack; repo/demo/docs links; status and months; public/featured; a `/projects` list with tech filters and a `/projects/:slug` detail page; cards in the existing style.

### 2026-04-26: Full-Stack VPS Migration

The project should move away from a pure static GitHub Pages site and become a full personal site deployed to a VPS with front-end and back-end separation.

### 2026-04-26: Preserve Existing UI

The migrated site must look and behave the same as before migration. Architecture changes should not cause visual disorder or functional regressions.

### 2026-04-26: Documentation Under `docs`

The project should keep detailed documentation, progress records, development logs, and user/model decision records under `docs`.

### 2026-04-26: Commit and Review Workflow

Development should commit frequently to `dev`. After a major stage, run Claude Code CLI review, fix findings, then prepare a PR and notify the user.

### 2026-04-26: Flexible Image Storage

The future image storage direction is Cloudflare R2, but the system should also allow local paths and existing image-host URLs.

### 2026-10-31: Standalone Admin App

The admin UI should be a separate app (`apps/admin`), borrowing auth, upload and admin UI patterns from `internal-developer-tools-portal`. The full stack should run locally first, then deploy to a VPS with CI/CD. Plan: `docs/plan-admin-projects-deploy.md`.

### 2026-10-31: Configurable Admin Path

The admin login address should be configurable like `internal-developer-tools-portal` (`ADMIN_PATH`), and must not be exposed to non-admin visitors.

### 2026-10-31: Upgrade React to Latest

React and related dependencies should be upgraded to the latest versions. This upgrade is exempt from the "Preserve Existing UI" decision.

## Model Decisions

### 2026-11-02: Analytics Details for Stages 18b and 18c

The model chose: a cached content catalog (five minutes, reloaded at most every 30 seconds on a miss) to reject content that does not exist or is not public, and hourly name snapshots instead of storing names on every event; small groups folded into 其他 for sources, countries and UTM values, and hidden heatmap cells, using `ANALYTICS_MIN_GROUP_SIZE`; a country ranking with flags rather than a map; Web Vitals measured only on the landing page of half of the visits, as fixed histogram buckets that include Google's limits so ratings are exact; public API timings kept in memory and written once a minute; the job and source log written through callbacks on the existing import and sync jobs and a wrapper around the media sources, with repeated successes noted at most every ten minutes; demo data allowed only in a database whose name or schema contains "demo".

Reason: the admin should see what matters without the site sending more, without single visitors standing out, and without a second scheduler.

### 2026-11-02: Analytics Details for Stage 18a

The model chose: page views by route template rather than full address; content views read from the address (projects, `?photo=`, `?item=`, `?person=`, playlists), so no page component needs its own tracking call; referrer, UTM, country, device and browser stored once per session rather than per event; beacons sent as `text/plain` (no CORS preflight); the signed-in admin excluded on the server by the session cookie rather than a browser flag; content ids validated by format only until Stage 18b adds name snapshots; a Spotify-player play counted when the song is loaded, since the iframe hides playback. Countries use the `maxmind` package for GeoLite2 files.

Reason: fewer moving parts in the site, smaller raw tables, and no identifying data in the browser.

### 2026-11-01: Steam Through "Sign in Through Steam" and the Site's Web API Key

The model chose Steam's OpenID sign-in to prove the admin's SteamID and the site's Web API key to read the library, storing only the SteamID, name and avatar.

Reason: Steam has no OAuth for other sites. The callback is checked with Steam (`check_authentication`) so a forged answer cannot connect another account. Purchase dates are not in any public Steam API, so they are entered by hand.

### 2026-11-04: IGDB Searches Skip Mods and Updates

Game searches leave out IGDB game types 3, 5, 12, 13 and 14 (bundles, mods, forks, packs, updates).

Reason: IGDB ranked a fan mod named "Hollow Knight" (Vita only, no developer) above the game itself; the sample import picked the mod. Ports, remakes, remasters and expansions stay searchable.

### 2026-11-03: Book and Comic Sources Without Keys

Books come from Open Library and Bangumi, comics from AniList and Bangumi; Google Books is used when `GOOGLE_BOOKS_API_KEY` is set (added the same day, once the user had a key).

Reason: Google Books answered every keyless request with a daily quota of zero, so it needs a Google Cloud key; Open Library covers most books and Bangumi covers Chinese and Japanese novels and comics with Chinese names, both without keys. Google Books covers are requested with `fife=w800`: its own links are about 128 px, and `zoom=0` returns a "no image" placeholder for many books.

### 2026-11-03: AniList Relation Types Version 2

AniList relations are read with `relationType(version: 2)`.

Reason: version 1 (the default) calls a work's source material ADAPTATION, the same as its adaptations, so an anime's manga was suggested as an adaptation of the anime; version 2 has SOURCE.

### 2026-11-02: Suggestions Never Link by Themselves

Suggested links (TMDB cast and crew, a song's singers, AniList relations) are listed for the admin to add one by one; nothing is linked automatically. AniList relations only match anime in the collection to anime, because a manga usually shares the anime's title.

Reason: same-name people and title matches are common enough that automatic links would quietly add wrong ones; the plan asked for candidates only.

### 2026-11-02: Admin Dialogs Render Into the Page Body

Admin dialogs are rendered with a portal into `<body>`, and submit events stop at the dialog.

Reason: dialogs open from inside editors' `<form>`s; a form inside a dialog was nested in the editor's form, so pressing Enter reloaded the page (and React bubbled the submit to the editor). This affected the existing 找试听 dialog too.

### 2026-11-01: The Player Plays the Collection's Songs

Songs are collection entries; the player plays the public ones marked "in player" that have a preview. A Spotify playlist is imported once (background job) instead of being synced at runtime, and iTunes provides search, covers and previews for single songs and for songs without a Spotify preview.

Reason: the site no longer depends on Spotify's embed page while visitors browse; the collection is the single list the admin manages, as planned in `docs/plan-collection.md`. Stage 13 is split: 13a needs no credentials; 13b (Liked Songs) needs the user's Spotify developer app.

### 2026-10-31: Romaji Titles for Anime From AniList

Anime imports look up the Japanese original title on AniList (public GraphQL API, no key) and use the romaji name as the English and French title; the match must have the same title (ignoring width and punctuation) or a year within one. Lookup failures do not block an import. `npm run db:backfill:romaji` updates existing entries.

Reason: the user prefers romaji over a Chinese fallback for English and French visitors; Bangumi has no romaji, and AniList has it for nearly every series.

### 2026-10-31: Outgoing Proxy From apps/api/.env

Node ignores the Windows system proxy. `HTTPS_PROXY` in `apps/api/.env` is loaded before startup enables Node's proxy support, and connection errors to TMDB / Bangumi now say to set it.

### 2026-10-31: One MediaItem Table for the Collection

Films, series, anime and (later) music share one table with a `kind` column, localized fields as JSON (like photos and projects) and kind-specific data in `extra`. Imports are unique per source entry.

Reason: the kinds share almost every field and every screen (list, editor, public page); separate tables would duplicate them.

### 2026-10-31: Server-Side Imports With Local Posters

The admin only names a source entry; the server fetches its details and downloads the poster from the source's image host (allowlisted, no redirects) into the existing WebP pipeline.

Reason: visitors only load images from this site, posters keep working if the source changes URLs, and the client cannot make the server fetch arbitrary URLs.

### 2026-10-31: Bangumi for Anime, TMDB for Films and Series

TMDB has titles and synopses in all five site languages; Bangumi has the most complete Chinese and Japanese anime data and needs no key. Anime can use either.

### 2026-10-31: Bundle the API With esbuild

The production API is bundled with esbuild into `apps/api/dist` (`scripts/build.mjs`): the workspace packages, which export TypeScript source, and the generated Prisma client are included; npm dependencies stay external. `prisma` moved to `dependencies` because the image runs `prisma migrate deploy` on start.

Reason: the workspace packages are consumed as `.ts` source and the code uses extensionless imports, so plain `tsc` output would not run on Node without rewriting imports or building each package.

### 2026-10-31: One Image, Fastify Serves Everything, Caddy in Front

The Docker image contains the API, the site and the admin builds; Fastify serves all of them on one origin. Caddy terminates HTTP(S) and is the only published port; the app trusts proxy headers from the compose subnet only. The site is served from an exact-file allowlist (no `@fastify/static`, see the Stage 6 decision).

Reason: one origin keeps cookies, CSRF and CORS simple; Caddy gives automatic HTTPS in Stage 10 without changing the app.

### 2026-10-31: Verify Docker in GitHub Actions

This machine has no Docker or WSL, so the Docker stack is verified by `docker/smoke-test.sh` in GitHub Actions on every push to `dev` and pull request to `main`. The same production build was also run outside Docker against a local PostgreSQL.

### 2026-10-31: Read Playlists From Spotify's Embed Page

Since November 2024 Spotify's Web API does not return editorial playlists (such as City Pop Best) or preview URLs to new apps, and `spotify-url-info` no longer parses Spotify's pages. The API reads the playlist from the public embed page's `__NEXT_DATA__` and track covers from oEmbed, caches the result in the database, and keeps the last good playlist when a sync fails. The broken `GET /api/spotify?url=` route and the `spotify-url-info` dependency were removed.

Reason: it is the only way to get the configured playlist with previews without asking visitors to sign in. The format is not a public contract, so failures are visible in the admin and never break the site.

### 2026-10-31: Unreachable Database Answers 503

Connection errors (Prisma P1000-P1003, P1017, P2024, socket errors) map to `503 DATABASE_UNAVAILABLE` instead of `500 INTERNAL`, and the admin explains how to start the database.

### 2026-10-31: Serialize Project Image Changes per Project

Updates that rewrite a project's cover or screenshot list run one at a time per project in the API process.

Reason: the image lists are JSON on the project row, so concurrent read-modify-write updates would lose changes. A per-project in-process lock fits the existing single-instance design; image processing stays outside the lock.

### 2026-10-31: Projects Section After the Tech Stack

The home section is placed after `#skills` and before `#featured`.

Reason: the user asked for it between the introduction and the photos; the about and tech-stack sections together form the introduction, so it goes right before the photos.

### 2026-10-31: Project Images as JSON on the Project Row

Cover and screenshots are stored as JSON on `Project` rather than in a separate table.

Reason: images belong to exactly one project, are always loaded with it and are few (cover plus at most 30 screenshots); a table would add joins and ordering columns without a query that needs them.

### 2026-10-31: Stable UUID Ids, Editable Slugs

Projects have an immutable UUID `id` (used in admin URLs and storage paths) and an editable unique `slug` for public URLs.

Reason: renaming a project's URL must not move its files or break the admin.

### 2026-10-31: Markdown Without Raw HTML

Project bodies are Markdown rendered by `react-markdown` with GFM; raw HTML is not rendered.

Reason: rich enough for project write-ups while making it impossible for stored text to inject markup or scripts into the public site.

### 2026-10-31: Lazy-Load the Project Detail Page

`/projects/:slug` is a separate chunk.

Reason: `react-markdown` added ~170 kB; only visitors opening a project need it.

### 2026-10-31: Uploads Create Hidden Photos

Uploading an image immediately creates a private photo prefilled from EXIF instead of returning a loose file for a later "create" call.

Reason: no orphaned files when an upload is abandoned; deleting the photo is the single way to remove files.

### 2026-10-31: WebP Sizes 640/1280/2048/3072, Private Originals

Uploads are rendered to WebP at four longest-edge sizes (no upscaling) with metadata stripped; the original is stored but never served.

Reason: matches the roles of Flickr's n/z/b/k-3k sizes used by the existing image component, keeps GPS data private, and keeps the original for future re-processing or R2 migration.

### 2026-10-31: Derive Upload URLs at Read Time

The database stores `storageKey` and variant dimensions, not URLs.

Reason: moving files to R2 or a CDN later only changes URL construction, not stored data.

### 2026-10-31: No Seed Fallback for an Empty Database

With a reachable database, the public API returns exactly the database's public photos, even if none.

Reason: planned in the execution plan; otherwise deleting all photos in the admin would show the seed photos again.

### 2026-10-31: Featured Section Follows the `featured` Flag

The home page shows photos with `featured` set, in gallery order, instead of a hard-coded id list.

Reason: the admin's "首页精选" switch has to drive it. The seed content marks the same ten photos as before; their order now follows gallery order.

### 2026-10-31: Reorder Requires the Complete Current List

`PUT /api/admin/photos/order` rejects a list that does not contain every photo exactly once (409).

Reason: a stale tab cannot silently overwrite a newer order or drop photos from the ordering.

### 2026-10-31: Serve Hidden Photos' Images Only to the Admin

`/uploads` checks the photo in the database for every image request: public photos are cached publicly for a year, hidden ones go only to a signed-in admin without caching.

Reason: drafts must not leak by URL guessing. The cost is one primary-key lookup per image request, which the long public cache makes rare.

### 2026-10-31: Keep Prisma Migrations LF

`.gitattributes` forces LF line endings for `apps/api/prisma/migrations/**`.

Reason: Prisma checksums migration files byte for byte; with `core.autocrlf`, Windows and Linux checkouts would disagree.

### 2026-10-31: Commit Migrations, Add `db:deploy`

The first Prisma migrations are committed and `npm run db:deploy` applies them.

Reason: the VPS (Stage 10) must apply schema changes without `migrate dev` or `db push`.

### 2026-10-31: Serve the Admin Build With a Fixed File Allowlist

The API serves `apps/admin/dist` itself instead of using `@fastify/static`: `index.html` (with the mount path injected), `assets/<hashed-name>` and `favicon.svg` only.

Reason: `@fastify/static` 10 depends on a `glob` version with moderate advisories, and the admin build is a small fixed set of files. A strict file-name pattern (no `/`, no leading `.`) rules out path traversal without a general static server.

### 2026-10-31: Relative Admin Build Plus Injected `<base>`

The admin app is built with `base: "./"`, and the API injects `<base href="<ADMIN_PATH>/">` and `<meta name="lf-admin-path">`.

Reason: one build works under any `ADMIN_PATH`, so changing the path needs only a restart; `<base>` keeps `./assets/...` correct on nested routes.

### 2026-10-31: Use `@vitejs/plugin-react` for the Admin App

The admin app uses `@vitejs/plugin-react` 6 rather than the SWC plugin used by `apps/web`.

Reason: Vite 8 recommends it when no SWC plugins are needed. `apps/web` is left unchanged to keep this stage's scope to the admin app.

### 2026-10-31: Port Admin UI Components When First Used

Stage 6 ports only the components the scaffold uses (Field, Toast, button/card styles). Dialog, Select, Combobox, Switch and Tooltip from the portal come with the photo editor in Stage 7.

Reason: avoids unused code in the scaffold; the components are ported as-is when needed.

### 2026-10-31: Validate Configuration at Startup With Zod

The API parses all environment variables once in `config/env.ts` and refuses to start on invalid values, listing every problem.

Reason: misconfigured security settings (short secrets, half-configured auth, a bad admin path or IP list) should fail loudly rather than silently weaken the admin.

### 2026-10-31: Per-Server Auth State

Login rate limits and session revocations moved from module globals into `AdminAuthService`, created per `buildServer()`.

Reason: isolated state per server keeps tests independent and makes the single-instance limitation explicit in one place.

### 2026-10-31: CSRF Header Plus SameSite=Strict

Admin writes require `x-admin-request: 1`, and the session cookie moved from `SameSite=Lax` to `Strict`.

Reason: same approach as `internal-developer-tools-portal`; custom headers cannot be sent by cross-site forms, and the admin is same-origin so `Strict` costs nothing.

### 2026-10-31: Hide Admin API by IP With an Identical 404

When `ADMIN_ALLOWED_IPS` is set, `/api/admin/*` answers other IPs with exactly the same body as an unknown route, before CSRF or auth checks.

Reason: matches the user's request to make the admin address configurable like the portal; outsiders should not be able to discover that an admin exists.

### 2026-10-31: Add `packages/shared`

Admin path rules, the CSRF header name and API types live in a new `packages/shared` package instead of `packages/content`.

Reason: `packages/content` holds site content; the admin app (Stage 6), web and API all need the same protocol constants, which are not content.

### 2026-10-31: Validation Messages Without Field Prefixes

Validation errors return the first Zod issue's message as written in the schema.

Reason: the schema messages already name the field ("Username is required", "Invalid Spotify URL"), and the front end shows them directly.

### 2026-10-31: Use `react-router` 8 Instead of `react-router-dom`

React Router 8 no longer publishes `react-router-dom`; all router APIs are imported from `react-router`.

Reason: the user asked for the latest React stack, and v8 is the current release line.

### 2026-10-31: Upgrade Vite to 8 With the Front-End Stack

The model upgraded Vite from 6 to 8 together with React, keeping `@vitejs/plugin-react-swc`.

Reason: Vite 8 builds the existing app without config changes, and the plugin supports Vite 4-8, so there was no reason to defer it.

### 2026-10-31: Require Node 22.22+

The model set CI to Node 22 and the root `engines.node` to `>=22.22.0`.

Reason: React Router 8 requires Node 22.22 or newer; the VPS should use the same major version.

### 2026-10-31: Accept Fastify 5.12 From `npm audit fix`

The non-breaking `npm audit fix` upgraded the API's Fastify from 5.8.5 to 5.12.7 to pull in a patched `fast-uri`.

Reason: it is a minor version within Fastify 5, fixes high-severity `fast-uri` advisories, and the API typechecks and serves its routes unchanged.

### 2026-10-31: Filter Portfolio Categories by English Value

The portfolio category filter keys on the English category value instead of the current-language label.

Reason: the selection must survive a language switch; every photo category has an English value (falling back to Chinese), so it works as a stable key without changing the content schema.

### 2026-10-31: Upgrade Prisma to 7.10.1 in Stage 4

The user asked to do the Prisma major upgrade in the same PR instead of deferring it. The model chose Prisma 7.10.1 (exact pin), superseding "Pin Prisma to 6.19.3".

Reason: 7.10.1 is the newest stable release and clears the remaining high audit findings (`deepmerge-ts` via `@prisma/config`). Prisma 8 is still a release candidate (npm `latest` points at `8.0.0-rc.29`), so it is not used yet.

### 2026-10-31: Use the `prisma-client` Generator With `@prisma/adapter-pg`

The schema uses the new `prisma-client` generator with output in `apps/api/src/generated/prisma` (git-ignored), and the client connects via `@prisma/adapter-pg` with `connectionTimeoutMillis: 5000`.

Reason: `prisma-client-js` is deprecated in v7 and driver adapters are required. node-pg has no connect timeout by default; keeping Prisma 6's 5s keeps the seed fallback responsive when the database host is unreachable.

### 2026-10-31: Generate the Prisma Client Inside API Scripts

`dev`, `start`, `build`, and `typecheck` in `apps/api` run `prisma generate` first, and `prisma.config.ts` only sets a datasource when `DATABASE_URL` is present.

Reason: the generated client is no longer in `node_modules` and is not committed; generating in the scripts keeps CI (`npm run typecheck`) and fresh checkouts working without a database or an extra step. `start` does not regenerate, so production does not need the Prisma CLI at runtime.

### 2026-04-26: Incremental Migration Instead of Rewrite

The model chose not to rewrite the front-end or redesign pages. The first stage only reorganizes the repository and adds an API foundation so the existing UI remains stable.

Reason: the user explicitly prioritized identical appearance and behavior after migration.

### 2026-04-26: Use npm Workspaces

The model chose npm workspaces with `apps/web`, `apps/api`, and `packages/content`.

Reason: the repository already used npm and `package-lock.json`; npm workspaces keep front-end, back-end, and shared packages clear without introducing another package manager.

### 2026-04-26: Extract Photo Seed to `packages/content`

The model chose to move existing photo data into a shared package instead of duplicating it in front-end and API.

Reason: this keeps the migrated UI content identical and avoids maintaining two copies before the database exists.

### 2026-04-26: Seed-First Front-End Data Loading

The model chose to initialize photo pages from shared seed data and then fetch `/api/photos`.

Reason: this prevents blank or broken pages when the API is not running during early migration, while still establishing the future API data path.

### 2026-04-26: Fastify for the Initial API

The model chose Fastify for the first back-end scaffold.

Reason: it is small, fast, TypeScript-friendly, and sufficient for health checks, content APIs, metadata endpoints, and future admin CRUD.

### 2026-04-26: Defer Database and Admin CRUD

The model chose not to introduce PostgreSQL, Prisma, authentication, and admin CRUD in the first structural commit.

Reason: introducing all of them at once would make regressions harder to isolate; Stage 1 should first prove the repo structure and API boundary.

### 2026-04-26: Keep API Server Startup Import-Safe

The model changed the API entrypoint so `buildServer()` can be imported without automatically listening on a port.

Reason: this keeps future route tests and Claude/code-review checks safer as the API grows.

### 2026-04-26: Disable API Fetching for GitHub Pages Builds

The model added `VITE_DISABLE_API_FETCH=true` to the GitHub Pages build workflow while keeping API fetching enabled by default elsewhere.

Reason: the project is moving to a VPS where same-origin `/api` should work, but the legacy GitHub Pages deployment has no backend and should not issue a guaranteed 404 request on every page load.

### 2026-04-26: Restrict Default API CORS to Local Dev Origins

The model changed the default API CORS behavior from allow-all to localhost and 127.0.0.1 dev origins.

Reason: public deployment should not accidentally expose permissive CORS by default; production origins can be configured explicitly through `CORS_ORIGIN`.

### 2026-04-26: Database-First With Seed Fallback

The model chose to make photo routes read from PostgreSQL when `DATABASE_URL` is configured, but fall back to `packages/content` seed data when the database is missing, unavailable, or empty.

Reason: the user requires the migrated page to keep working and looking the same during migration; a hard database dependency would make local/static workflows fragile before the admin and deployment layers exist.

### 2026-04-26: Store Localized Photo Fields as JSON

The model chose JSON fields for localized photo content in Prisma instead of splitting translations into a separate table.

Reason: the existing content shape is already localized JSON-like objects, and a translation-table design would add complexity before the admin editing model is finalized.

### 2026-04-26: Pin Prisma to 6.19.3

The model chose Prisma 6.19.3 instead of the latest major version 7.x.

Reason: Prisma 7 is a major upgrade with migration implications; 6.19.3 avoids the known audit issue encountered in 6.19.0 while minimizing framework churn in this stage.

### 2026-04-26: Keep Photo Slug Mirrored to Seed ID Temporarily

The model kept `Photo.slug` as a unique database field but seeds it with the existing photo `id`.

Reason: future public detail/admin routes will likely need a stable slug, but the current seed content has stable URL-safe IDs and no separate slug copy yet. This keeps the schema ready without inventing new slugs prematurely.

### 2026-04-26: Load API Environment From `apps/api/.env`

The model added `dotenv` loading to the API server and database seed script.

Reason: Prisma CLI commands read local `.env` files, but the API runtime and direct seed script do not automatically load `DATABASE_URL`; loading `apps/api/.env` keeps local development consistent.

### 2026-04-26: Use Single-Admin Environment-Based Authentication First

The model chose a single admin account configured by environment variables instead of creating an admin user database table in Stage 3.

Reason: the current goal is to establish a protected admin boundary before CRUD exists. A database-backed user system would add complexity before roles, user management, and recovery requirements are clear.

### 2026-04-26: Use HttpOnly Cookie Sessions

The model chose HttpOnly cookie sessions signed with an HMAC token for admin authentication.

Reason: the front-end and API are intended to be same-origin behind a VPS reverse proxy, and HttpOnly cookies reduce exposure compared with storing bearer tokens in local storage.

### 2026-04-26: Remove Tracked `my-app` Scaffold

The model chose to remove the tracked `my-app` Vite starter scaffold.

Reason: it was a standalone unused starter app and conflicted with the user's requirement for a clear repository structure.
