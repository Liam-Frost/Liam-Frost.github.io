# Admin

## Current Scope

Stage 3 added the authentication foundation; Stage 5 hardened it and added a configurable admin path and an IP allowlist.

Current admin features:

- API session check: `GET /api/admin/session` (returns `adminPath` only to a signed-in admin).
- API login: `POST /api/admin/login`.
- API logout: `POST /api/admin/logout`.
- Signed-in check: `GET /api/admin/me`.
- Reusable backend guard: `AdminAuthService.requireAdmin` (Fastify `preHandler`).
- Standalone admin app `apps/admin` (Stage 6), served by the API at `ADMIN_PATH`: login, layout with Overview / Photos / Projects navigation, logout.
- Photo management (Stage 7): upload, edit in five languages, publish/hide, home-page featured flag, drag-and-drop or button reordering, delete. The Projects page is a placeholder until Stage 8.

Photo CRUD, uploads, project management, and media collection management come in later stages.

## Configuration

All settings are validated at startup (`apps/api/src/config/env.ts`); an invalid value stops the API with a list of every problem.

Generate a password hash:

```bash
npm run auth:hash -- your-password
```

Set the API environment values in `apps/api/.env`:

```txt
ADMIN_USERNAME=liam
ADMIN_PASSWORD_HASH=scrypt:v1:...
# At least 32 characters
ADMIN_SESSION_SECRET=replace-with-a-long-random-secret
ADMIN_SESSION_TTL_SECONDS=28800
# DEVELOPMENT ONLY. Defaults to true when NODE_ENV=production.
ADMIN_COOKIE_SECURE=false
ADMIN_PATH=/admin
ADMIN_ALLOWED_IPS=
TRUST_PROXY=false
```

| Variable | Default | Notes |
|---|---|---|
| `ADMIN_USERNAME` | `admin` | |
| `ADMIN_PASSWORD_HASH` | empty | Must come from `npm run auth:hash`. Set together with the secret. |
| `ADMIN_SESSION_SECRET` | empty | At least 32 characters. Set together with the hash. |
| `ADMIN_SESSION_TTL_SECONDS` | `28800` | 300 s to 30 days. Blank means default. |
| `ADMIN_COOKIE_NAME` | `lf_admin_session` | |
| `ADMIN_COOKIE_SECURE` | `true` in production | Set `false` only for local HTTP development. |
| `ADMIN_PATH` | `/admin` | Where the admin app is served. Letters, digits, `-`, `_` and `/` only; cannot be `/` or start with `/api`, `/uploads`, `/assets`. Changing it needs only a restart. |
| `ADMIN_ALLOWED_IPS` | empty (no restriction) | Comma-separated IPs / CIDR ranges, IPv4 and IPv6. |
| `TRUST_PROXY` | `false` | Behind a reverse proxy, list the proxy's IPs / CIDR ranges (e.g. `127.0.0.1` or the Docker network); only then is `X-Forwarded-For` used for the client IP. `true` trusts any hop and is safe only when the API port is not reachable except through the proxy. |

Admin auth is enabled only when both `ADMIN_PASSWORD_HASH` and `ADMIN_SESSION_SECRET` are set; setting just one is a configuration error. With neither set, admin routes answer `503 ADMIN_NOT_CONFIGURED`.

On Windows Git Bash, a value like `ADMIN_PATH=/studio` on the command line is rewritten to a Windows path; put it in `.env` or write `ADMIN_PATH=studio`.

## Security Model

- **Password**: stored only as a scrypt hash (`N=16384, r=8, p=1`). Scrypt runs even for a wrong username so timing does not reveal valid usernames.
- **Session**: HttpOnly, `SameSite=Strict` cookie containing an HMAC-SHA256-signed token with an expiry. Logout revokes the token in memory until it expires.
- **CSRF**: every non-GET `/api/admin/*` request must send `x-admin-request: 1` (`ADMIN_REQUEST_HEADER` in `@liam-frost/shared`). Cross-site forms cannot set custom headers, and cross-origin scripts need a CORS preflight that only configured origins pass.
- **Rate limit**: 8 login attempts per IP per 15 minutes, then `429` with `Retry-After`.
- **IP allowlist**: when `ADMIN_ALLOWED_IPS` is set, every `/api/admin/*` route answers other IPs with the exact same `404` as an unknown route, before any other check, so the admin API's existence is not revealed.
- **Admin path**: `ADMIN_PATH` is never returned by public endpoints; only a signed-in admin gets it from `/api/admin/session`. The admin app is served only at that path; other URLs never receive the admin page or its path.
- **Logs**: `authorization`, `cookie` and `set-cookie` headers are redacted.

Rate-limit counters and revoked sessions live in process memory, so the API must run as a single instance.

## Photo Management

Requires `DATABASE_URL` (see `database.md`).

- **Upload**: the button or drag-and-drop anywhere on the Photos page; files upload one at a time with progress. Accepted: JPEG, PNG, WebP, AVIF, TIFF up to `UPLOAD_MAX_MB` (default 40 MB) and 120 megapixels.
- **Processing**: the image is auto-rotated from EXIF and rendered as WebP at 640, 1280, 2048 and 3072 px on the longest edge (never upscaled; smaller images get their own size instead). Generated files carry no metadata, so GPS and camera serial data are not published. The original file is kept next to them but is never served.
- **New photos are hidden**: an upload becomes a private photo prefilled from EXIF (camera, lens, "1/200 · f/2.8 · ISO 400", capture date) with the file name as its title. Edit it, then switch on "公开显示". Nothing is left behind on failure, and deleting a photo removes its files.
- **Editing**: title, category, location, description, alt text and tags per language (missing languages fall back on the site); date, camera, lens, settings; public and featured switches. A title in at least one language is required.
- **Featured**: the home page "featured" section shows photos with "首页精选" on, in gallery order.
- **Order**: drag cards (or use the arrow buttons) in the "全部" view. The server only accepts the complete current list, so two tabs cannot silently overwrite each other's order.
- **Existing Flickr photos** stay as remote URLs; their texts and flags are editable, their image is not replaced.

Files live in `UPLOAD_DIR` (default `apps/api/uploads`) under `photos/<id>/` and are served from `/uploads/photos/<id>/<size>.webp`. Only generated sizes of existing photos are reachable: public photos with a one-year immutable cache, hidden photos only to a signed-in admin (`private, no-store`). Because public URLs are cached for a year, a photo that is later hidden or deleted can remain in browsers that already loaded it.

API: `GET/POST /api/admin/photos`, `GET/PATCH/DELETE /api/admin/photos/:id`, `PUT /api/admin/photos/order`.

## Running the Admin App

Development (API, web and admin dev servers):

```bash
npm run dev
```

Then open `http://localhost:5174/admin` (or your `ADMIN_PATH`). The admin dev server reads `ADMIN_PATH` from `apps/api/.env`.

Served by the API (production-like):

```bash
npm run build:admin
npm run dev:api
```

Then open `http://localhost:8787/admin`. The API registers the admin routes at startup only if `apps/admin/dist` exists; later rebuilds are picked up without a restart.

## Error Format

All API errors use one shape:

```json
{ "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid username or password" } }
```

Codes used by admin routes: `VALIDATION`, `REQUEST_ERROR`, `CSRF`, `UNAUTHORIZED`, `INVALID_CREDENTIALS`, `TOO_MANY_ATTEMPTS`, `ADMIN_NOT_CONFIGURED`, `NOT_FOUND`.

## Tests

`npm test` runs the API tests (Vitest + Fastify `inject`) covering configuration validation, admin path rules, IP lists, login, CSRF, rate limiting, session revocation, cookie tampering, the IP allowlist, `TRUST_PROXY`, admin app hosting (path injection, asset allowlist, traversal attempts, IP hiding), and photos (public visibility, seed fallback, upload processing with EXIF orientation, size limits, invalid files, edit/publish/delete, ordering, `/uploads` file allowlist).
