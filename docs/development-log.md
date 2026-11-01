# Development Log

## 2026-11-01: Node 26 candidate and deferred TypeScript upgrade

- Synced merged dependency PRs #19, #20 and #23 before testing; kept TypeScript unchanged.
- Prepared a coordinated Node 26 candidate: CI, Pages builds, Docker image, `@types/node`, engine minimum, `.node-version` and setup documentation.
- Local Windows Node 26.12.1 passed lint, formatting, typecheck, 162 tests and the full build with the candidate dependencies. Node 26.13.0 is the first LTS release and differs from 26.12.1 only in LTS metadata; Linux/container compatibility is verified separately by the candidate PR checks.
- Kept TypeScript PR #22 open and documented its typescript-eslint prerequisite. Created a Monday 10:00 Asia/Shanghai monitor in this chat to report actionable support changes without automatically upgrading or merging.

## 2026-11-01: README and repository presentation

- Rewrote the README around project features, actual deployment status, stack, reproducible local setup, Docker, commands, contribution checks, documentation, security and licensing.
- Added CI/main, Docker/dev, CodeQL-enabled, Node and code-license badges without inventing release or coverage metrics.
- Updated GitHub description, homepage and topics to reflect the multilingual portfolio, media collection and full-stack implementation.
- Checked README formatting, relative links and badge endpoints. Documentation-only change; application tests are handled by the PR checks.

## 2026-11-01: Repository maintenance

- Added PR/push CI for lint, formatting, typecheck, tests and full build; retained Docker integration checks.
- Added weekly grouped npm/Actions Dependabot configuration, MIT licensing with content exclusions, and a private security-reporting policy.
- Added ESLint, Prettier, EditorConfig and LF attributes; established a formatting baseline and fixed lint findings.
- Fixed the administrator-path regex backtracking issue and added long-input regression coverage.
- Verified 157 tests, typecheck, lint, formatting and a full build. The sandboxed SWC cache denied access; the build passed with cache access outside the sandbox.
- Verified GitHub security settings and updated repository description, homepage and topics. Pages HTTPS enforcement could not be enabled because GitHub has not issued the certificate.
- Recorded the initial CodeQL findings and development-only minimatch advisory in `repository-maintenance.md`; no production dependency advisories were reported.
- VPS deployment, backups and monitoring remain outside this stage.
- Opened PR #18; initial GitHub CI and Docker smoke checks passed. CodeQL's summary flagged logout rate limiting and incomplete Steam HTML cleanup. Added a global Fastify request limiter, hardened both provider description cleanup paths and verified 158 tests locally. GitHub's Pages health check confirms Cloudflare proxying and no current HTTPS eligibility.
- Replaced both regex-based tag cleanup paths with one shared single-pass plain-text extractor. Added normal/nested/unclosed markup cases; regression coverage now totals 162 tests.

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
- The model created Stage 3 PR #3: https://github.com/Liam-Frost/Liam-Frost.github.io/pull/3

- 2026-10-31: The user decided on a standalone `apps/admin` app, a configurable admin path, and upgrading React to the latest version. The plan is in `docs/plan-admin-projects-deploy.md`.
- The model found PR #3 still open; with the user's approval it merged PR #3 and recreated local `dev` from the updated `main`.
- The model started Stage 4 (front-end dependency upgrade): React 19.3, React Router 8, Vite 8, Node 22 in CI.
- The first install left a hoisted React 18 copy used by `lucide-react` and simple-icons, plus a nested Vite 6 under the SWC plugin; `npm dedupe` resolved both.
- The model verified typecheck, build, and the main UI flows in the browser.
- The model ran Claude Code review for Stage 4, fixed the photo modal key handling and the language-dependent category filter, and documented the Fastify upgrade.
- The model created Stage 4 PR #4: https://github.com/Liam-Frost/Liam-Frost.github.io/pull/4
- The user asked to do the Prisma major upgrade in PR #4 instead of deferring it. The model upgraded to Prisma 7.10.1 (Prisma 8 is still an RC), followed the official v7 upgrade guide (fetched from the prisma/docs GitHub repo because prisma.io was unreachable), and verified against a local `prisma dev` database because Docker is still unavailable.

- PR #4 was merged; the model started Stage 5 (back-end foundation and admin auth hardening) on top of the Stage 3 auth code rather than rewriting it.
- While testing, Git Bash rewrote `ADMIN_PATH=/studio` into a Windows path; the new config validation rejected it at startup. Documented in `admin.md`.
- The PR #4 deploy run succeeded on Node 22 with Prisma 7 client generation in CI.
- The model ran Claude Code review for Stage 5, fixed the `TRUST_PROXY` spoofing risk and three smaller findings, and created Stage 5 PR #5: https://github.com/Liam-Frost/Liam-Frost.github.io/pull/5

- PR #5 was merged; the model started Stage 6 (standalone `apps/admin`).
- `@fastify/static` pulled in a `glob` version with moderate advisories, so the API serves the small, fixed set of admin build files itself.
- Two bugs were found in the browser and fixed before commit: the admin dev proxy looping to itself (Vite `loadEnv` includes `process.env.PORT`) and logout not returning to the login screen (`queryClient.clear()` detaching the session observer).
- The model ran Claude Code review for Stage 6, fixed three low findings, and created Stage 6 PR #6: https://github.com/Liam-Frost/Liam-Frost.github.io/pull/6

- PR #6 was merged; the model started Stage 7 (photo management and uploads).
- `prisma migrate dev` against `prisma dev`'s `template1` database broke the shadow database (it is copied from `template1`); the migrations were recreated against the `postgres` database. `prisma migrate diff` printed nothing in this environment, so the `photo_uploads` SQL was written by hand and verified by applying it and exercising the new columns end to end.
- The test multipart helper first produced LF line endings, which multipart rejects; fixed in the helper.
- During browser verification the web dev server lacked a `/uploads` proxy, and the editor's two switches shared one line; both fixed.
- The model ran Claude Code review for Stage 7, fixed five findings, and created Stage 7 PR #7: https://github.com/Liam-Frost/Liam-Frost.github.io/pull/7

- PR #7 was merged; the model started Stage 8 (projects). The user placed the home-page projects section between the introduction and the photos and accepted the other defaults.
- The usage limit interrupted the stage after the back end and the admin list page; that part was committed as a WIP commit, then the editor page, web pages, verification and docs followed.
- `react-markdown` grew the web bundle from 428 kB to 600 kB, so the project detail page is lazy-loaded (main bundle back to 437 kB).
- The model ran Claude Code review for Stage 8, fixed five findings (including lost updates from concurrent project image changes), and created Stage 8 PR #8: https://github.com/Liam-Frost/Liam-Frost.github.io/pull/8

- PR #8 was merged. The user tested locally; the admin showed a bare 500 because the database (`prisma dev`) was not running. Connection errors now answer 503 with a clear message.
- The user asked to manage the Spotify player in the admin and chose option B. `spotify-url-info` turned out to be broken (Spotify changed its pages), so the playlist is read from the embed page directly.
- Node's fetch ignored the user's `HTTPS_PROXY` (curl used it), so syncs timed out locally; the API now enables Node's environment proxy support at startup.
- The browser pane's screenshots only showed the top-left quarter of the page at device pixel ratio 2; the player was moved into view with an inline style for inspection only.
- The model ran Claude Code review for the music player and fixed ten findings.

- PR #9 was merged; the model started Stage 9 (full local run with Docker Compose).
- This machine has neither Docker nor WSL, so the Docker stack is verified on GitHub Actions with `docker/smoke-test.sh` (it passed on the first run); the production build was also run here outside Docker.
- Git Bash rewrote `ADMIN_PATH=/studio` into a Windows path when starting the server by hand (`MSYS2_ENV_CONV_EXCL='*'` avoids it); not an issue in Docker or on Linux.
- A Python one-liner meant to generate a test PNG was quadratic and hung a check; the smoke test's Node generator is used instead.
- The model ran Claude Code review for Stage 9 and fixed five findings.

- PR #10 was merged. The user asked for a collection module plan (`docs/plan-collection.md`), then confirmed it and started Stage 11.
- Browser testing found that the add dialog's search field never got focus (native `<dialog>` focuses the close button), so typing and Enter closed it; fixed in `Dialog` with `data-autofocus`. Live Bangumi data showed studio tags among genres and episode totals that include specials; both fixed.
- Windows reported port 51514 as unavailable for `prisma dev` although nothing listened on it (likely a reserved range); other ports were used.
- The model ran Claude Code review for Stage 11 and fixed six findings.

- The user configured a TMDB read access token; real searches and imports were verified, TMDB's Simplified genre names for zh-TW were dropped, and PR #11 was merged.
- Stage 12 started. The browser pane's screenshots crop to the top-left quarter at device pixel ratio 2; pages were scaled with an inline `transform: scale(0.5)` for inspection only.
- The model ran Claude Code review for Stage 12 and fixed four findings.
- The user reported a blank home page after adding an anime. It was unrelated: reloading with 繁體中文 selected crashed the app (`zh-Hant` normalized to `zh-hant`, missing from the translation tables). The bug dates back to when Traditional Chinese was added and also affects the live GitHub Pages site until this is deployed.

- PR #12 was merged; Stage 13 was split so the parts that need no Spotify credentials (13a) could start right away.
- Importing City Pop Best in the browser test took 37 s for 100 songs; covers load lazily, so a first screenshot showed none.
- The model ran Claude Code review for Stage 13a and fixed five findings.

- The user created a Spotify developer app (credentials in `apps/api/.env`) and asked for Stage 13b plus a Spotify embedded player switchable in the admin.
- The Web API gives new apps no previews, so imports read each song's preview from Spotify's embed page and fall back to iTunes.
- The callback is authorized by a one-time state rather than the admin cookie: the cookie is `SameSite=Strict`, and in development the callback is on another origin.
- The browser pane reported a 0×0 viewport while hidden; the embedded player was checked after setting an explicit size.
- `.env.example` had `…` as the Spotify values, which would have counted as configured; they are now empty.
- The model ran Claude Code review for Stage 13b and fixed four findings.
- PR #13 was merged. The user confirmed the proposal for books, comics, games, people and links between entries; it was written into the collection plan as Stages 14-16.
- Stage 14 started. Browser testing with a temporary database found: importing a TMDB person failed with a Prisma validation error (the photo URL was passed to the database; the in-memory test repository now rejects unknown fields like Prisma), Enter in the add-link dialog reloaded the page (nested forms; dialogs now render into `<body>`), and animated films list voice actors as cast with "(voice)" (now read as voice roles).
- The sample collection was first seeded without `UPLOAD_DIR`, so its posters landed in the user's `apps/api/uploads`; the 13 folders (ids only in the temporary database) were moved out right away and the folder count matched the original 115.
- Text with Chinese characters sent with curl from Git Bash arrived garbled (console encoding); only test data was affected.
- The model ran Claude Code review for Stage 14 and fixed the findings listed in its review record.

- PR #14 was merged; Stage 15 (books and comics) started. The user asked how to fill in the Twitch app's OAuth redirect URL for IGDB (Stage 16): IGDB uses app tokens, so `http://localhost` is enough.
- Probing the sources: Google Books without a key had a daily quota of 0; Open Library covers redirect twice (covers.openlibrary.org → archive.org → ia*.us.archive.org).
- Testing with live data found AniList's default relation types reversed source and adaptation, Open Library publishers starting with an invisible U+200E, foreign-language Open Library subjects, and Bangumi's 漫画 tag repeating the platform; all fixed.
- Git Bash heredocs turned `\\u200e` escapes into the characters themselves; edits with escapes go through script files.
- The model ran Claude Code review for Stage 15 and fixed the findings listed in its review record.
- The user filled in the Twitch app credentials (checked: token and an IGDB search work), asked whether Google Books' API is free, and asked to play collection songs in the player and for a cover wall for music; both were added to the Stage 15 PR.
- Spotify's embedded player cannot be started from the page without loading Spotify's iFrame API script; the site only switches what it shows, and the visitor presses play.
- The user asked to wire in Google Books, merge PR #15 once tests passed, and start Stage 16. PR #15 was merged after CI passed.
- Stage 16: the first live seed imported a fan mod instead of Hollow Knight (IGDB ranked the mod first); searches now skip mods and updates. A Python edit with a raw string doubled a regex escape (`\\d`), which a source test caught.
- PR #16 was merged. The user asked for bulk actions, music views by album / artist / playlist, and a Steam library sync before the yearly review; the plan became Stage 17a-d.
- Stage 17a: browser testing found that Shift-click selected only the clicked item: the selection updater read the range anchor after it had already moved to the clicked item.
- Stage 17b: songs imported from a playlist link have no album (Spotify's embed page has none), so the album view only groups account imports and iTunes songs. Each song keeps its own copy of its album cover, so album and artist cards use one cover (a four-cover mosaic would repeat it).
- The browser pane was off screen during part of the testing; the admin was driven through page scripts instead of clicks.
- The user created a Google Books key; it was added to `.env` / `.env.example` with comments and wired in as a book source. Google's cover links are 128 px; `zoom=0` turned out to return the same 575 × 750 "no image" placeholder for different books, so covers use `fife=w800`.
- The user filled in `STEAM_WEB_API_KEY` (game details public) and asked for 17c and 17d. Steam sign-in can only be completed by the user in their own browser; the sync was tested with faked Steam answers and the sign-in address checked in the browser.
- The first password used for the temporary admin was from an older test environment; the login silently failed and the Steam button was not found.
- The user had already set this repository's git identity to Liam-Frost <frostnova986@gmail.com>; the Stage 18 plan commit already used it. Commits here use that identity, not the company one.
- Stage 18a: the temporary API's launcher could not import `dotenv` from the scratch folder; it now resolves it from `apps/api`. The browser pane's sample player could not load audio offline, so play counting was checked through the player bus; visits after signing in to the admin (same host, shared cookie) were correctly not counted. `prisma dev` reported its stream server on 127.0.0.1:8787, the API's default port.

## Notes

- A direct Windows directory rename of `src` failed with `Permission denied`; the migration continued by moving source subdirectories individually.
- The tracked `my-app` Vite scaffold was removed as unused project noise during the repository structure cleanup.
