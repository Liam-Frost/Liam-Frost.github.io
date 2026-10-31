# Architecture

## Current Target

The project is migrating to a full-stack personal site deployed on a VPS.

```txt
apps/web        React + Vite front-end (public site)
apps/admin      React + Vite + Tailwind admin app
apps/api        Fastify API service
packages/content Shared content seed and content types
packages/shared  Shared constants and API types
docs            Project documentation
scripts         Maintenance helpers
```

## Front-End

The front-end remains React + Vite to preserve the existing visual design and behavior. In this first stage, pages still render immediately from shared seed content and then refresh from `/api/photos` when the API is available.

This avoids layout breakage during the migration and keeps the current homepage and portfolio usable while backend work continues.

## Back-End

The first-stage API uses Fastify and TypeScript. It currently provides:

- `GET /api/health`
- `GET /api/photos`
- `GET /api/photos/:id`
- `GET /api/spotify/player` (player settings and the synced playlist; see `admin.md`)
- Admin collection routes under `/api/admin/media` and `/api/admin/collection/settings` (see `admin.md`)
- `GET /api/admin/session`
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/me`

The API has a PostgreSQL/Prisma foundation for photos. During migration, photo routes use the database when `DATABASE_URL` is configured and reachable, then fall back to shared seed data when the database is not configured or unavailable. This keeps the existing front-end stable while the admin/database workflow is built out.

Admin authentication is in place with an HttpOnly cookie session and a reusable backend guard for future protected routes. CRUD, media metadata import, and upload processing are planned for later stages. See `admin.md` for the security model.

Production hosting: one Node process serves everything on one origin. `routes/web-app.ts` serves the site build (`apps/web/dist`) at `/`: only files that exist in the build at startup, looked up by exact path; other paths are the usual JSON 404 (the site uses hash routes, so `/` is its only page). `index.html` gets a CSP that allows the inline theme bootstrap script by its hash, computed from the build at startup. The admin build is served at `ADMIN_PATH`, uploads at `/uploads`. In Docker, Caddy sits in front (`compose.yaml`, `docs/local-development.md`).

API structure:

```txt
apps/api/src
  config/env.ts     Zod-validated environment (fails fast on bad config)
  auth/             password hashing, signed sessions, AdminAuthService (CSRF, IP allowlist, rate limit, revocation)
  lib/              HttpError, Zod input validation, IP/CIDR lists
  routes/           admin, admin-app, admin-photos, admin-projects, photos, projects, uploads, spotify
  photos/           PhotoRepository interface + Prisma implementation, image processing (sharp), EXIF, DTO mapping
  projects/         ProjectRepository interface + Prisma implementation, DTO mapping
  storage/local.ts  uploaded files under UPLOAD_DIR
  db/               Prisma client and seed script
  generated/prisma  generated Prisma client (git-ignored)
apps/api/test       Vitest + Fastify inject tests
packages/shared     constants and API types shared by API, web and admin (admin path rules, CSRF header, error shape)
```

`buildServer({ config })` takes an explicit configuration, so tests build isolated servers without touching `process.env`. Every error response has the shape `{ "error": { "code", "message" } }`, and every response carries `nosniff`, `DENY` framing and a strict referrer policy.

## Admin App

`apps/admin` is a separate Vite app so the admin UI (Tailwind, TanStack Query, components adapted from `internal-developer-tools-portal`) never touches the public site's CSS or bundle.

- **Mount path**: built with relative asset URLs (`base: "./"`). The API serves `apps/admin/dist` at `ADMIN_PATH` and injects `<base href="<ADMIN_PATH>/">` plus `<meta name="lf-admin-path">` into `index.html`, so changing `ADMIN_PATH` needs only a restart, and nested routes such as `/admin/photos` still resolve `./assets/...`.
- **Not found by default**: the app reads the mount path from that `<meta>`; without it (any other URL) it renders a bare 404 and never calls the API.
- **Hosting** (`apps/api/src/routes/admin-app.ts`): only `index.html`, Vite's hashed `assets/*` files and `favicon.svg` are served; any other file-like path is 404. The page gets a strict CSP and `no-store`; hashed assets are cached for a year. IPs outside `ADMIN_ALLOWED_IPS` get the unknown-route 404. Without a build, nothing is registered.
- **Development**: `npm run dev:admin` (port 5174) proxies `/api` and `/uploads` to `127.0.0.1:8787` (override with `ADMIN_API_PROXY`) and injects the same `<meta>` from `ADMIN_PATH` in `apps/api/.env`.
- **Session**: TanStack Query holds `/api/admin/session`; any 401 returns the app to the login screen; logout drops all other cached admin data.

## Photos

- **Storage**: `Photo.storage` is `remote-url` (existing Flickr photos: `src` is the URL) or `local` (uploads: `storageKey` + `variants`; URLs are derived at read time, so moving files to R2 later only changes how URLs are built).
- **Repository**: routes depend on the `PhotoRepository` interface; the API uses the Prisma implementation when `DATABASE_URL` is set, tests use an in-memory one.
- **Public shape**: `packages/content`'s `Photo` gained `featured` and optional `variants` (`{ width, height, url }`, smallest first). `src` stays the largest image, so the fullscreen viewer works unchanged.
- **Front end**: `ResponsiveFlickrImage` keeps its Flickr suffix logic and, for photos with `variants`, builds `srcset` from them (capped by the adaptive quality tier), uses the 1280 px size as the lightbox medium and swaps in the size that covers the viewport.

## Projects

- **Data**: `Project` rows hold localized JSON texts (Markdown body), `cover` and `gallery` as image JSON (`{ id, key, width, height, variants }`; URLs derived at read time like photos), tech stack, links, status and `YYYY-MM` months. `id` is a UUID and never changes; `slug` is the editable URL segment.
- **Images**: `routes/read-upload.ts` and `saveImage` are shared with photos; project files live under `projects/<projectId>/<imageId>/`, so deleting a project removes one folder.
- **No seed data**: projects exist only in the database. Without the API the web app shows no project sections.
- **Web**: `/projects` (filter by technologies used in more than one project) and `/projects/:slug`. The detail page is lazy-loaded so `react-markdown` stays out of the main bundle (main bundle 437 kB; the detail chunk 164 kB).

## Content

Photography seed data is stored in `packages/content` so that the front-end and API read the same content source during migration. This prevents data drift while the database layer is not yet introduced.

The database seed script also reads from `packages/content`, so the same source currently powers the static fallback and the initial PostgreSQL data migration.

## Image Storage Direction

Image handling is designed around switchable storage drivers:

- `remote-url`: keep using existing Flickr or image-host URLs.
- `local`: serve uploaded images from the VPS filesystem.
- `r2`: serve images from Cloudflare R2 public/custom-domain URLs.

Cloudflare R2 is the preferred future target, but the API keeps the storage choice configurable so development can continue locally or with existing URLs.
