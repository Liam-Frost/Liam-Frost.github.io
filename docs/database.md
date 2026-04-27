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

## Commands

Generate Prisma client:

```bash
npm run db:generate
```

Push schema to a development database:

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
