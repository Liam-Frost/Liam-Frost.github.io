# Local Development and Full Local Run

There are two ways to run the site locally:

| | `npm run dev` | Docker Compose |
| --- | --- | --- |
| For | Day-to-day development | Checking the production setup before deploying |
| Runs | Vite dev servers (hot reload) + API via `tsx watch` | One production image behind Caddy, plus PostgreSQL |
| Addresses | Site `http://localhost:5173`, admin `http://localhost:5174/admin`, API `http://localhost:8787` | Everything at `http://localhost:8080` |
| Settings | `apps/api/.env` | `.env` next to `compose.yaml` |

## Development (`npm run dev`)

Requirements: Node.js 22.22 or newer, and a PostgreSQL database for photos, projects and music settings (the site works without one, using seed photos and no projects).

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `apps/api/.env` from `apps/api/.env.example` and set:
   - `DATABASE_URL`. Without Docker, `npx prisma dev` (run in `apps/api`, keep the window open) starts a local PostgreSQL and prints a URL; replace the database name `template1` in it with `postgres`. With Docker, `docker compose up -d postgres` gives you `postgresql://liam_frost:liam_frost_dev@localhost:5432/liam_frost_site?schema=public`.
   - `ADMIN_PASSWORD_HASH` (`npm run auth:hash -- your-password`) and `ADMIN_SESSION_SECRET` (32+ characters).

3. Create the tables (and, the first time, import the seed photos):

   ```bash
   npm run db:deploy
   npm run db:seed
   ```

4. Start everything:

   ```bash
   npm run dev
   ```

Notes:

- `prisma dev` may take port 8787 for its own service. If the API reports the port is in use, set another `PORT` in `apps/api/.env` together with `ADMIN_API_PROXY` / `WEB_API_PROXY` (e.g. `http://127.0.0.1:8788`) so the dev servers follow.
- If you need a proxy to reach Spotify, set `HTTPS_PROXY`; the API uses it for outgoing requests.

## Full Local Run (Docker Compose)

Requirements: Docker Desktop (Windows: with the WSL 2 backend) or Docker Engine with Compose v2.

1. Create `.env` next to `compose.yaml` from `.env.example`.

2. Build the image and create the admin password hash:

   ```bash
   docker compose build
   docker compose run --rm --no-deps --entrypoint node app apps/api/dist/hash-password.js "your-password"
   ```

   Put the printed hash into `ADMIN_PASSWORD_HASH`, and a random string of 32+ characters into `ADMIN_SESSION_SECRET`.

3. Start the stack:

   ```bash
   docker compose up -d --wait
   ```

   The app applies pending database migrations every time it starts.

4. The first time, import the seed photos:

   ```bash
   docker compose exec app node apps/api/dist/seed.js
   ```

5. Open `http://localhost:8080` (site) and `http://localhost:8080/admin` (admin, or your `ADMIN_PATH`).

What runs:

- **postgres**: PostgreSQL 16; data in the `postgres_data` volume; also published on `127.0.0.1:5432` for database tools and `npm run dev`.
- **app**: the production image (`Dockerfile`). Fastify serves the API, the site (`apps/web/dist`), the admin (`apps/admin/dist`) and `/uploads`. Uploaded images live in the `uploads` volume. It runs as a non-root user and has a health check on `/api/health`.
- **caddy**: the only published entry point (`HTTP_PORT`, default 8080). With `SITE_ADDRESS` set to a domain it serves HTTPS with automatic certificates (Stage 10).

Common commands:

```bash
docker compose logs -f app        # follow the app log
docker compose up -d --build      # rebuild and restart after code changes
docker compose down               # stop (data is kept in the volumes)
docker compose down -v            # stop and DELETE all data (database, uploads, certificates)
```

If `docker compose up` reports that port 5432 or 8080 is already allocated, change `POSTGRES_PORT` or `HTTP_PORT` in `.env`.

`ADMIN_COOKIE_SECURE` defaults to `true` in Docker; `.env.example` sets `false` so the admin works over plain HTTP locally. Set it back to `true` once the site is served over HTTPS.

Data survives `docker compose down` / `up` and restarts. Back up the `postgres_data` and `uploads` volumes together (Stage 10 adds scripts for this).

## Checking the Docker Setup

`docker/smoke-test.sh` builds the image and runs the whole stack under a separate compose project (ports 18080/15432, its own volumes): site, admin page, seed, admin login, project creation with an uploaded cover, the music endpoint, then a restart to check that data and migrations survive. It removes its containers and volumes afterwards.

```bash
bash docker/smoke-test.sh
```

GitHub Actions runs it on every push to `dev` and every pull request to `main` (`.github/workflows/docker.yml`), so the Docker setup is checked even on machines without Docker.

## Production Build Without Docker

```bash
npm run build                       # site, admin, and the API bundle (apps/api/dist)
cd apps/api
npx prisma migrate deploy
NODE_ENV=production node dist/server.js
```

The bundle includes the workspace packages and the generated Prisma client; the npm dependencies of `apps/api` must be installed.
