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
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | empty | A Spotify developer app, for importing Liked Songs and your playlists. Set both or neither. |
| `SPOTIFY_REDIRECT_URI` | `http://127.0.0.1:<PORT>/api/admin/spotify/callback` | Must match the redirect URI registered in the Spotify app. In production use `https://<domain>/api/admin/spotify/callback`. |
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

## Collection (Films, Series, Anime, Books, Comics)

Requires `DATABASE_URL`. Searching films and series needs `TMDB_API_KEY` (a TMDB v3 API key or v4 read access token) in `apps/api/.env`; without it they can only be added by hand. Anime is searched on Bangumi (no key) or TMDB; books on Open Library or Bangumi (novels and light novels with Chinese names); comics on AniList (romaji and English titles, authors, serialization) or Bangumi (Chinese names). None of these need a key.

- **Books and comics** use 想读 / 在读 / 读过 / 弃了, a finished date, reread count and progress in pages (books) or volumes (comics). The editor also has publisher, pages (books) and volumes and serialization (comics). Comics imported from Bangumi get their romaji name from AniList as the English and French title, like anime. AniList has no Chinese titles: comics imported from it show the English title in Chinese until you add one. Open Library has one title per work (usually the original language) and English descriptions; its subjects are kept only when they are common genres, translated into every site language.

- **Add**: "添加电影 / 剧集 / 动漫" searches the source; choosing a result makes the server fetch its details (titles in every site language TMDB has, original title, year, genres, directors / studios, synopsis, episode count) and download the poster into the image pipeline. Entries already in the collection are marked and open instead. Entries can also be created by hand with just a title.
- **Editor** (`<ADMIN_PATH>/collection/<id>`): status (想看 / 在看 / 看过 / 弃了), five-star rating (click the current star to clear), date finished, rewatch count, episode progress for series and anime; title, short review and synopsis per language; original title, year, genres, credits; poster replacement; public and featured switches.
- **Display settings**: which kinds the site shows (and whether it shows people), and a global switch for "want to watch" entries. An entry appears on the site only if it is public, its kind is shown, and it is not a "want" entry while that switch is off. Posters follow the same rule (the admin always sees them).
- New entries are public with status 看过; posters are stored under `UPLOAD_DIR/media/<id>/`.
- Anime gets its romaji name from AniList as the English and French title (editable like any title).
- The site shows the collection at `/collection` and the latest finished or ongoing entries in the home section 最近在看 (public API: `GET /api/collection`, `GET /api/collection/:id`).

API: `GET /api/admin/media`, `GET /api/admin/media/search?kind&source&q`, `POST /api/admin/media/import`, `POST /api/admin/media`, `GET/PATCH/DELETE /api/admin/media/:id`, `POST /api/admin/media/:id/poster`, `GET/PUT /api/admin/collection/settings`. Posters: `/uploads/media/<id>/<imageId>/<n>.webp`.

## People and Links

People (人物, `<ADMIN_PATH>/people`) are actors, directors, singers, writers, studios: anyone linked to collection entries. Links (关联) connect entries to each other and people to entries.

- **Add a person**: search TMDB (films and series people; name in every site language TMDB has, biography, IMDb / homepage links and photo are imported), or add by hand with a name (singers, writers, manga artists). Edit names and biographies per language, original name, links (https), photo, public and featured switches.
- **Links panel** (关联 on an entry, 作品 on a person): add, edit (role, note per language) and remove links. Kinds of links from an entry: 参与者 (a person and their role), 原声歌曲 / 出自作品 (a song is a work's opening, ending, insert song, theme or score), 改编自 / 被改编为, 前作 / 续作, 相关作品. The person picker can create a person by name on the spot. A link is stored once and listed on both ends.
- **Suggestions** (查找建议 on an entry): TMDB directors / creators, writers and main cast (voice roles for anime and animated films), with the character as the note; a song's singers and a book's or comic's authors matched to people by name; AniList sources, adaptations, sequels and side stories of an anime, comic or light novel that are already in the collection. A related work only matches entries of its own kind (an anime's manga matches comics, a light novel matches books), since a manga often has its anime's title. Nothing is linked until you click 添加; a TMDB person is imported with their photo when they are not in 人物 yet.
- **On the site**: a person is shown when they are public, 显示设置 → 人物 is on, and they are credited in at least one entry the site shows. Links appear when both ends are shown. The collection page gets a 人物 tab; an entry's panel lists its people, soundtrack, source, adaptations, sequels and related works, and each opens in the same panel. Photos follow the same rule as posters (public person, people switch on); the admin always sees them.

API: `GET/POST /api/admin/people`, `GET /api/admin/people/search?q`, `POST /api/admin/people/import`, `GET/PATCH/DELETE /api/admin/people/:id`, `POST /api/admin/people/:id/photo`, `GET /api/admin/people/:id/relations`, `GET /api/admin/media/:id/relations`, `GET /api/admin/media/:id/suggestions`, `POST /api/admin/relations`, `PATCH/DELETE /api/admin/relations/:id`. Public: `GET /api/collection` (now with `people`), `GET /api/collection/:id` (now with `links`), `GET /api/people/:id`. Photos: `/uploads/people/<id>/<imageId>/<n>.webp`.

## Music (Songs and the Player)

Songs are collection entries (收藏 → 音乐; kind `track`). The player in the site's bottom-right corner has two types, chosen on the 播放器 page:

- **网站自己的播放器** plays the songs that are public, marked 加入播放器 and have a 30-second preview, in the order they were added (or shuffled). Without such songs it plays the fallback tracks in `apps/web/src/data/site.ts`.
- **Spotify 嵌入播放器** shows Spotify's own player for a playlist, album, song or artist link. Visitors signed in to Spotify in the same browser hear full songs; others hear previews. The site's CSP allows frames from `open.spotify.com` only.

- **添加歌曲**: searches the iTunes store chosen in the dialog (Japanese songs are easiest to find in the Japan store); adding fetches the song's 600 px cover, album, length, preview and Apple Music link. Songs with a preview go into the player.
- **Spotify 账号**: connect your Spotify account once (read-only access to your library and playlists; you approve on Spotify's page and come back to the music tab). Then import 已点赞的歌曲 or one of your playlists. Previews come from Spotify's song page, or iTunes when Spotify has none. The refresh token is stored encrypted (AES-256-GCM, keyed by `ADMIN_SESSION_SECRET`) in the `Setting` table; 断开 deletes it. A Spotify app in development mode only works for accounts added under its User Management.
- **导入歌单链接**: imports a public playlist from its share link as a background job with progress (100 songs take under a minute). Songs come with their Spotify preview, cover and link; songs without a preview are added but stay out of the player. Songs already in the collection are skipped, so a playlist can be imported again to add new songs. One playlist imports at a time.
- **Song list**: preview button, 播放器 switch, and 找试听 for songs without a preview (iTunes search; choosing a result sets the preview and puts the song in the player). Filters: all, in the player, not in the player, without a preview.
- **Song editor**: rating, short review (per language), title, singers, album, year, genres, cover, preview (换一个试听), Spotify / Apple Music links, player / public / featured switches.
- **播放器 page** (`<ADMIN_PATH>/music`): show/hide the player, player type (and the Spotify link for the embedded player), shuffle and default volume (site player only), seconds before it collapses (0 = stays open), and how many songs the site player has.
- Previews may only come from `audio-ssl.itunes.apple.com` or `p.scdn.co`; a song cannot be in the player without one.
- Spotify playlists are read from Spotify's public embed page (the official Web API does not serve editorial playlists or previews to new apps). If Spotify changes that page, imports fail with a message; songs already imported are unaffected. Liked Songs and your own playlists come through the Spotify Web API with your account (above).

API: `GET /api/admin/music/search?q&country`, `POST /api/admin/music/import`, `POST /api/admin/music/playlist-import`, `POST /api/admin/music/spotify-import` (`{source: "liked"}` or `{source: "playlist", playlistId}`), `GET /api/admin/music/jobs/:id`, `GET/PUT /api/admin/spotify` (player settings), `GET/DELETE /api/admin/spotify/account`, `POST /api/admin/spotify/connect`, `GET /api/admin/spotify/callback` (authorized by a one-time state, since Spotify's redirect carries no admin cookie), `GET /api/admin/spotify/playlists`. Public: `GET /api/spotify/player`. Player settings are stored in the `Setting` table (`spotify`).

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
