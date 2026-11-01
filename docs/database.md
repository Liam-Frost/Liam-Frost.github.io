# Database

## Current Scope

PostgreSQL (via Prisma) stores photos once `DATABASE_URL` is set; the admin app manages them (Stage 7).

The public photo routes behave as follows:

- `DATABASE_URL` not set: serve `packages/content` seed data (static/GitHub Pages builds and local work without a database).
- Database configured and reachable: serve the database's **public** photos only. An empty database means an empty gallery; seed data is no longer mixed in once photos are managed in the admin.
- Database configured but unreachable: log a warning and fall back to seed data so the site keeps working.
- `GET /api/photos/:id` answers 404 for hidden photos, exactly like a missing one.

Admin photo routes need the database and answer `503 DATABASE_NOT_CONFIGURED` without it.

## Local PostgreSQL

Start local PostgreSQL:

```bash
docker compose up -d postgres
```

Use the default development connection string from `apps/api/.env.example`:

```txt
DATABASE_URL=postgresql://liam_frost:liam_frost_dev@localhost:5432/liam_frost_site?schema=public
```

Copy it into `apps/api/.env` for local API and seed commands. The API and seed script load this file with `dotenv`.

In the full Docker stack the app container applies pending migrations on every start (`docker/entrypoint.sh`, `MIGRATE_ON_START=false` skips it). See `docs/local-development.md`.

## Prisma 7 Setup

- Prisma ORM 7.10.1 with the `prisma-client` generator. The client is generated into `apps/api/src/generated/prisma` (git-ignored) and imported from `../generated/prisma/client`.
- `apps/api/prisma.config.ts` holds the schema path, migrations path, seed command, and the datasource URL (read from `DATABASE_URL` via `dotenv`). The schema no longer contains `url`.
- The client connects through the `@prisma/adapter-pg` driver adapter (`node-pg`) with a 5s connect timeout, matching Prisma 6, so an unreachable database falls back to seed data quickly.
- `dev`, `build`, and `typecheck` run `prisma generate` first, so a fresh checkout or CI does not need a separate generate step and does not need `DATABASE_URL`. `start` does not regenerate; run `build` (or `db:generate`) before it.
- The `?schema=` parameter in `DATABASE_URL` is read by the API and passed to the adapter (node-pg itself ignores it).
- SSL: node-pg verifies server certificates (Prisma 6 ignored invalid ones). A database with `sslmode=require` and a self-signed certificate fails with `P1010`; install the CA via `NODE_EXTRA_CA_CERTS` rather than disabling verification. The planned VPS setup runs Postgres in the same Compose network without SSL.
- Idle connection errors from the pool are logged as warnings.
- Prisma 7 no longer seeds or generates automatically after `migrate dev` / `db push`; the `db:*` scripts below run those steps explicitly.
- Nullable Json columns (`location`, `description`) must be written with `Prisma.DbNull`, not `null`.

Without Docker, `npx prisma dev` (run in `apps/api`) starts a local Prisma Postgres server and prints a `postgres://` URL that can be used as `DATABASE_URL`.

## Migrations

Migrations are committed under `apps/api/prisma/migrations`:

- `20261031064710_init`: the original `Photo` table and `Visibility` enum.
- `20261031064800_photo_uploads`: `ImageStorage` enum and the `storage`, `storageKey`, `variants` columns for uploaded photos.
- `20261031090000_projects`: `ProjectStatus` enum and the `Project` table (localized JSON texts, cover/gallery image JSON, tech stack, links, status, months, featured, visibility, order).

The `photo_uploads` and `projects` SQL was written by hand (`prisma migrate diff` printed nothing in the development environment) and verified by applying all migrations to a fresh PostgreSQL and exercising the tables end to end.

Development: `npm run db:migrate` (creates/applies migrations, regenerates the client, seeds). Production: `npm run db:deploy` (applies committed migrations only).

A database created earlier with `npm run db:push` has no migration history; recreate it (or baseline it with `prisma migrate resolve --applied 20261031064710_init`) before using `db:migrate`/`db:deploy`.

## Commands

Generate Prisma client:

```bash
npm run db:generate
```

Run development migrations, regenerate the client, then seed photos:

```bash
npm run db:migrate
```

Push schema to a development database and regenerate the client:

```bash
npm run db:push
```

Apply committed migrations (production):

```bash
npm run db:deploy
```

Seed photos from `packages/content` (also marks the original home-page selection as featured):

```bash
npm run db:seed
```

Open Prisma Studio:

```bash
npm run db:studio
```

## MediaItem Model

Collection entries (migration `20261031150000_media`; `book` and `comic` added by `20261103090000_books_comics`, `game` by `20261104090000_games`): `kind` (movie, tv, anime, book, comic, game, track, album), `source` and `sourceId` (unique together; TMDB ids are prefixed `movie:` / `tv:`), localized `title`, `overview`, `review` and `genres` as JSON, `credits`, local `poster` (same shape as project covers), `status`, `rating` (1-5), `watchedOn`, `rewatchCount`, `progress` (`{ watched, total }`: episodes, a comic's volumes or a book's pages), `extra` (kind-specific JSON: `music` for songs, `publication` `{ publisher, pages, volumes, ongoing }` for books and comics, `game` `{ platforms, publishers, playtimeHours, steamAppId, lastPlayedOn, purchasedOn }` for games; games added from the Steam store have source `steam`), `featured`, `visibility`. The `collection` key in `Setting` holds the display switches.

## Person and MediaRelation Models

People linked to collection entries (migration `20261102090000_people_relations`):

- `Person`: `source` (`tmdb` or `manual`) and `sourceId` (unique together), localized `name` and `bio` as JSON, `originalName`, local `photo` (same shape as posters, stored under `UPLOAD_DIR/people/<id>/`), `links` (https URLs), `featured`, `visibility`.
- `MediaRelation`: starts at an entry (`fromMediaId`) or a person (`fromPersonId`), never both (a database `CHECK`), and ends at an entry (`toMediaId`). `type` is `soundtrack`, `adaptation`, `sequel`, `related` or `credit`; `role` is a person's role for credits and the song's use (opening, ending, ...) for soundtracks; `note` is localized. `key` is unique: one relation per start, end, type and role, with the two ends of `related` sorted so A–B and B–A are the same. Deleting an entry or a person deletes its relations (`ON DELETE CASCADE`).

Reading direction: `soundtrack` song → work, `adaptation` adaptation → source, `sequel` sequel → prequel, `credit` person → work. A relation is stored once and listed from both ends.

## Playlist Models

Playlists of songs (migration `20261105090000_playlists`):

- `Playlist`: localized `name` and `description`, `source` (`manual` or `spotify`) and `sourceId` (the Spotify playlist id, or `liked`; unique together, so an import finds its playlist again), `sourceUrl`, `visibility`.
- `PlaylistTrack`: a song (`mediaId`) at a `position` in a playlist; one row per playlist and song. Deleting a playlist or a song deletes its rows.

## Analytics Models

Visitor analytics (migration `20261106090000_analytics`); no IP addresses are stored:

- `AnalyticsEvent`: raw events (`type`, local `day` and `hour`, `sessionId`, the day's `visitor` hash, route `path`, `contentType` / `contentId`, `target`, `detail`, `value`), deleted after `ANALYTICS_EVENT_RETENTION_DAYS`.
- `AnalyticsSession`: one row per visit (start, last activity, entry page, referrer domain, UTM parameters, country, language, device, browser); deleted with the raw events.
- `AnalyticsDaily`: daily totals (`day`, `metric`, `key`, `value`), kept for good; `AnalyticsRollupDay` marks days written.
- `AnalyticsSalt`: today's salt for visitor hashes; other days' salts are deleted.

Reports (migration `20261107090000_analytics_reports`):

- `AnalyticsContentName`: the name (and collection kind) each piece of content had when last seen, so statistics can name it after it is hidden or deleted.
- `AnalyticsRequestDaily`: public API requests per day and route (counts, 5xx, 4xx, total time, a response-time histogram), kept for good.
- `AnalyticsSystemEvent`: import and sync job results and external source successes and failures; deleted after the retention period.
- `AnalyticsFlag`: small flags, e.g. `demo` when the database holds generated demo data.

## Setting Model

`Setting` stores site-wide settings as one validated JSON document per key (migration `20261031120000_settings`):

- `spotify`: player settings edited in the admin (validated with Zod on save; unreadable values fall back to defaults).
- `spotify.playlist`: the last synced playlist (tracks with preview URLs and covers) and the last sync attempt and error.

## Photo Model

The `Photo` table keeps localized fields as JSON:

- `title`
- `category`
- `location`
- `description`
- `tags`
- `alt`

This preserves the existing multilingual data shape and avoids forcing a translation-table design before the admin UI requirements are clear.
