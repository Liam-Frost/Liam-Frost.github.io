# Architecture

## Current Target

The project is migrating to a full-stack personal site deployed on a VPS.

```txt
apps/web        React + Vite front-end
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
- `GET /api/spotify?url=...`
- `GET /api/admin/session`
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/me`

The API has a PostgreSQL/Prisma foundation for photos. During migration, photo routes use the database when `DATABASE_URL` is configured and reachable, then fall back to shared seed data when the database is not configured or unavailable. This keeps the existing front-end stable while the admin/database workflow is built out.

Admin authentication is in place with an HttpOnly cookie session and a reusable backend guard for future protected routes. CRUD, media metadata import, and upload processing are planned for later stages. See `admin.md` for the security model.

API structure:

```txt
apps/api/src
  config/env.ts     Zod-validated environment (fails fast on bad config)
  auth/             password hashing, signed sessions, AdminAuthService (CSRF, IP allowlist, rate limit, revocation)
  lib/              HttpError, Zod input validation, IP/CIDR lists
  routes/           admin, photos, spotify
  db/               Prisma client and photo repository
  generated/prisma  generated Prisma client (git-ignored)
apps/api/test       Vitest + Fastify inject tests
packages/shared     constants and API types shared by API, web and admin (admin path rules, CSRF header, error shape)
```

`buildServer({ config })` takes an explicit configuration, so tests build isolated servers without touching `process.env`. Every error response has the shape `{ "error": { "code", "message" } }`, and every response carries `nosniff`, `DENY` framing and a strict referrer policy.

## Content

Photography seed data is stored in `packages/content` so that the front-end and API read the same content source during migration. This prevents data drift while the database layer is not yet introduced.

The database seed script also reads from `packages/content`, so the same source currently powers the static fallback and the initial PostgreSQL data migration.

## Image Storage Direction

Image handling is designed around switchable storage drivers:

- `remote-url`: keep using existing Flickr or image-host URLs.
- `local`: serve uploaded images from the VPS filesystem.
- `r2`: serve images from Cloudflare R2 public/custom-domain URLs.

Cloudflare R2 is the preferred future target, but the API keeps the storage choice configurable so development can continue locally or with existing URLs.
