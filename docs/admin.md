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
- Photo management (Stage 7): upload, edit in five languages, publish/hide, home-page featured flag, drag-and-drop or button reordering, delete.
- Project management (Stage 8): create, edit (texts and Markdown body in five languages, slug, status, months, tech stack, links), cover and screenshots, publish/hide, home-page featured flag, reorder, delete.

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

## Project Management

Requires `DATABASE_URL`.

- **Create**: "新建项目" asks for a title and a slug (suggested from an ASCII title). New projects are hidden.
- **Editor** (`<ADMIN_PATH>/projects/<id>`): title, one-line summary and Markdown body per language; slug (`/projects/<slug>`, unique), status (进行中 / 已完成 / 已归档), start and end month, tech stack, links (code, demo, docs; http(s) only); public and featured switches. Text changes are saved with "保存"; unsaved edits are marked, and leaving via the back arrow or closing the tab asks first.
- **Images** save immediately: uploading a cover replaces (and deletes) the previous one; screenshots (up to 30) can be reordered and deleted. They go through the same pipeline as photos (WebP sizes, metadata stripped, private originals) under `UPLOAD_DIR/projects/<id>/<imageId>/`.
- **Visibility**: hidden projects and their images are only visible to the admin, exactly like photos.
- **Home page**: up to four public projects with "首页精选" appear between the introduction (about and tech stack) and the featured photos, in list order. Without public featured projects (or without the API, e.g. GitHub Pages builds) the section is hidden.
- **Markdown**: rendered with `react-markdown` + GFM (tables, task lists). Raw HTML is not rendered, so the body cannot inject markup or scripts; links open in a new tab with `noopener`.

API: `GET/POST /api/admin/projects`, `GET/PATCH/DELETE /api/admin/projects/:id`, `POST /api/admin/projects/:id/images?slot=cover|gallery`, `DELETE /api/admin/projects/:id/images/:imageId`, `PUT /api/admin/projects/order`. Public: `GET /api/projects` (summaries), `GET /api/projects/:slug`.

## Collection (Films, Series, Anime)

Requires `DATABASE_URL`. Searching films and series needs `TMDB_API_KEY` (a TMDB v3 API key or v4 read access token) in `apps/api/.env`; without it they can only be added by hand. Anime is searched on Bangumi (no key) or TMDB.

- **Add**: "添加电影 / 剧集 / 动漫" searches the source; choosing a result makes the server fetch its details (titles in every site language TMDB has, original title, year, genres, directors / studios, synopsis, episode count) and download the poster into the image pipeline. Entries already in the collection are marked and open instead. Entries can also be created by hand with just a title.
- **Editor** (`<ADMIN_PATH>/collection/<id>`): status (想看 / 在看 / 看过 / 弃了), five-star rating (click the current star to clear), date finished, rewatch count, episode progress for series and anime; title, short review and synopsis per language; original title, year, genres, credits; poster replacement; public and featured switches.
- **Display settings**: which kinds the site shows, and a global switch for "want to watch" entries. An entry appears on the site only if it is public, its kind is shown, and it is not a "want" entry while that switch is off. Posters follow the same rule (the admin always sees them).
- New entries are public with status 看过; posters are stored under `UPLOAD_DIR/media/<id>/`.
- The public collection page comes in Stage 12 (`docs/plan-collection.md`).

API: `GET /api/admin/media`, `GET /api/admin/media/search?kind&source&q`, `POST /api/admin/media/import`, `POST /api/admin/media`, `GET/PATCH/DELETE /api/admin/media/:id`, `POST /api/admin/media/:id/poster`, `GET/PUT /api/admin/collection/settings`. Posters: `/uploads/media/<id>/<imageId>/<n>.webp`.

## Music (Spotify Player)

The "音乐" page configures the player in the site's bottom-right corner. Changing settings needs `DATABASE_URL`; without a database the site still plays the default playlist (cached in memory).

- **Settings**: show/hide the player, the playlist link (`https://open.spotify.com/playlist/<id>`; `?si=` is dropped), shuffle or playlist order, default volume, and how many seconds after page load the player collapses (0 = stays open).
- **Sync**: the API reads the playlist from Spotify's public embed page (the official Web API no longer serves editorial playlists or preview URLs to new apps). Track covers come from oEmbed and are cached between syncs. Only tracks with a 30-second preview are kept. The playlist refreshes every 6 hours when visited; "立即同步" refreshes it now, and saving a new link syncs it right away. A failed sync keeps the last good playlist and shows the error on the page; visitors do not retry a failed playlist for 10 minutes.
- **Player**: plays previews one after another (shuffled, reshuffled each round, or in playlist order) and loops; previous/next buttons and media keys work; hiding the player keeps the music playing. Static builds (GitHub Pages) and an API without a playlist fall back to the tracks in `apps/web/src/data/site.ts`.
- **Proxy**: when `HTTPS_PROXY` is set (e.g. a local proxy needed to reach Spotify), the API sends its requests through it (Node 24.14+/25.4+; on older Node set `NODE_USE_ENV_PROXY=1`). `NO_PROXY` is respected.
- The embed page is not a public contract. If Spotify changes it, syncs fail with "无法解析 Spotify 歌单页面" and the site keeps the last synced playlist.

API: `GET/PUT /api/admin/spotify`, `POST /api/admin/spotify/sync`. Public: `GET /api/spotify/player`. Settings and the cached playlist are stored in the `Setting` table (`spotify`, `spotify.playlist`).

## Running the Admin App

Development (API, web and admin dev servers):

```bash
npm run dev
```

Then open `http://localhost:5174/admin` (or your `ADMIN_PATH`). The admin dev server reads `ADMIN_PATH` from `apps/api/.env`. To point the dev servers at an API on another port, set `ADMIN_API_PROXY` (admin) or `WEB_API_PROXY` (web) there or in the environment.

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

`npm test` runs the API tests (Vitest + Fastify `inject`) covering configuration validation, admin path rules, IP lists, login, CSRF, rate limiting, session revocation, cookie tampering, the IP allowlist, `TRUST_PROXY`, admin app hosting (path injection, asset allowlist, traversal attempts, IP hiding), photos (public visibility, seed fallback, upload processing with EXIF orientation, size limits, invalid files, edit/publish/delete, ordering, `/uploads` file allowlist), and projects (public listing, slugs, validation, cover replacement, screenshots, image visibility, delete with files, ordering).
