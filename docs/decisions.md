# Decisions

## User Decisions

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
