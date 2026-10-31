# Database

## Current Scope

Stage 2 adds a PostgreSQL/Prisma foundation for photography data without making the site depend on a running database.

The API behavior is:

- If `DATABASE_URL` is not set, photo routes use `packages/content` seed data.
- If `DATABASE_URL` is set and the database returns public photos, photo routes use PostgreSQL.
- If the database is configured but unavailable, photo routes log a warning and fall back to seed data.
- If the database is configured but empty, `GET /api/photos` falls back to seed data to preserve the current page during migration.

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

## Prisma 7 Setup

- Prisma ORM 7.10.1 with the `prisma-client` generator. The client is generated into `apps/api/src/generated/prisma` (git-ignored) and imported from `../generated/prisma/client`.
- `apps/api/prisma.config.ts` holds the schema path, migrations path, seed command, and the datasource URL (read from `DATABASE_URL` via `dotenv`). The schema no longer contains `url`.
- The client connects through the `@prisma/adapter-pg` driver adapter (`node-pg`) with a 5s connect timeout, matching Prisma 6, so an unreachable database falls back to seed data quickly.
- `dev`, `start`, `build`, and `typecheck` run `prisma generate` first, so a fresh checkout or CI does not need a separate generate step and does not need `DATABASE_URL`.
- Prisma 7 no longer seeds or generates automatically after `migrate dev` / `db push`; the `db:*` scripts below run those steps explicitly.
- Nullable Json columns (`location`, `description`) must be written with `Prisma.DbNull`, not `null`.

Without Docker, `npx prisma dev` (run in `apps/api`) starts a local Prisma Postgres server and prints a `postgres://` URL that can be used as `DATABASE_URL`.

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

Seed photos from `packages/content`:

```bash
npm run db:seed
```

Open Prisma Studio:

```bash
npm run db:studio
```

## Photo Model

The `Photo` table keeps localized fields as JSON:

- `title`
- `category`
- `location`
- `description`
- `tags`
- `alt`

This preserves the existing multilingual data shape and avoids forcing a translation-table design before the admin UI requirements are clear.
