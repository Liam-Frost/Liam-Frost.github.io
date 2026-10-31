# Liam Frost Personal Site

Personal site migration from a static React portfolio to a full-stack application for photography, projects, and future media collections.

## Structure

- `apps/web`: React + Vite front-end. The visual UI is preserved from the original static site.
- `apps/admin`: standalone admin app (React + Tailwind), served by the API at `ADMIN_PATH` (default `/admin`).
- `apps/api`: Fastify API service: health, photos, projects, the Spotify player playlist, admin auth, and hosting of the site and admin builds in production.
- `packages/content`: Shared content seed data and content types used by both web and API.
- `packages/shared`: Constants and API types shared by API, web and admin.
- `docs`: Project documentation, progress, logs, and decision records.
- `docker`, `Dockerfile`, `compose.yaml`: production image and the full local stack (PostgreSQL + app + Caddy).
- `scripts`: One-off maintenance helpers.

## Commands

- `npm run dev`: run API, web and admin together.
- `npm run dev:web`: run the front-end dev server (`localhost:5173`).
- `npm run dev:api`: run the API dev server on `localhost:8787` by default.
- `npm run dev:admin`: run the admin dev server; open `http://localhost:5174<ADMIN_PATH>` (default `/admin`).
- `npm run build`: build web and admin, type-check the API and bundle it into `apps/api/dist`.
- `docker compose up -d --wait`: run the full production stack locally at `http://localhost:8080` (see `docs/local-development.md`).
- `bash docker/smoke-test.sh`: build the image and check the whole stack end to end.
- `npm test`: run the API tests.
- `npm run typecheck`: run workspace type checks.
- `npm run auth:hash -- your-password`: generate an admin password hash for `ADMIN_PASSWORD_HASH`.
- `npm run db:generate`: generate the Prisma client for the API.
- `npm run db:migrate`: run Prisma development migrations, regenerate the client, then seed photo data.
- `npm run db:deploy`: apply committed migrations (production).
- `npm run db:push`: push the Prisma schema to a local/development PostgreSQL database.
- `npm run db:seed`: seed the database from the shared photo content package.

## Migration Notes

The front-end initializes from the shared static photo seed and then fetches `/api/photos`. This keeps the page stable if the API is not running during early migration, while allowing the VPS deployment to use the backend API.

See `docs/README.md` for the full project record.
