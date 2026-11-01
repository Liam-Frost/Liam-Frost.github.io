# Liam Frost · Personal Site

A personal website for photography, software projects, and a collection of films, books, games, and music. Built as a TypeScript monorepo with a public site, a separate admin app, and a Fastify API.

[![CI](https://github.com/Liam-Frost/Liam-Frost.github.io/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Liam-Frost/Liam-Frost.github.io/actions/workflows/ci.yml)
[![Docker smoke test](https://github.com/Liam-Frost/Liam-Frost.github.io/actions/workflows/docker.yml/badge.svg?branch=dev)](https://github.com/Liam-Frost/Liam-Frost.github.io/actions/workflows/docker.yml)
[![CodeQL enabled](https://img.shields.io/badge/CodeQL-enabled-2088FF?logo=github)](https://github.com/Liam-Frost/Liam-Frost.github.io/security/code-scanning)
[![Node.js 26.13+](https://img.shields.io/badge/Node.js-%E2%89%A526.13-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Code license: MIT](https://img.shields.io/badge/code_license-MIT-blue)](LICENSE)

**[Visit the website](https://www.twilightfrosty.com)** · [Documentation](docs/README.md) · [Report a bug](https://github.com/Liam-Frost/Liam-Frost.github.io/issues) · [Report a vulnerability](SECURITY.md)

## Features

- **Photography portfolio** — responsive galleries, fullscreen viewing, image metadata, and adaptive image quality.
- **Project showcase** — technology filters, localized project details, Markdown descriptions, and image galleries.
- **Media collection** — films, series, anime, books, comics, games, music, and people, with ratings, reviews, progress, relationships, and a yearly review.
- **Music and game integrations** — Spotify account imports and playlist management, a music player, and Steam library synchronization.
- **Separate admin app** — manage photos, projects, collections, uploads, and bulk actions without adding admin code to the public bundle.
- **Multilingual interface** — English, Simplified Chinese, Traditional Chinese, Japanese, and French on the public site, with light and dark themes.

### Project status

The public website currently runs on **GitHub Pages as a static build**, with API fetching disabled. The full-stack application is implemented and exercised by Docker integration tests; **VPS production deployment is pending**. Database-backed features and the admin app require the API and are not available through the static Pages build.

This is a personal project under active development.

## Technology

| Area               | Stack                                            |
| ------------------ | ------------------------------------------------ |
| Public site        | React, React Router, Vite, TypeScript            |
| Admin              | React, Tailwind CSS, TanStack Query              |
| API                | Fastify, Zod, Node.js                            |
| Data               | PostgreSQL 16, Prisma                            |
| Images             | sharp, EXIF extraction, local upload storage     |
| Full-stack runtime | Docker Compose, Caddy, one application image     |
| Quality            | Vitest, ESLint, Prettier, GitHub Actions, CodeQL |

The full-stack runtime uses one origin: Caddy forwards requests to Fastify, which serves the public build, the admin build, API routes, and uploads. During development, Vite serves each frontend and proxies API requests.

## Quick start

### Requirements

- **Node.js 26.13+** and npm. CI and Docker run on Node 26; `.node-version` records the minimum LTS version.
- **PostgreSQL** for the full application. Docker Compose can provide a local PostgreSQL 16 instance.
- **Docker with Compose v2** only if using the container workflow or integration tests.

### 1. Install dependencies

```sh
git clone https://github.com/Liam-Frost/Liam-Frost.github.io.git
cd Liam-Frost.github.io
npm ci
```

To preview only the public frontend with bundled photo content:

```sh
npm run dev:web
```

Open <http://localhost:5173>. Continue below for the API, database-backed content, and admin app.

### 2. Configure the API and database

Copy the example environment file:

```sh
cp apps/api/.env.example apps/api/.env
```

Set `DATABASE_URL` in `apps/api/.env` to your local PostgreSQL connection. To use the development database from this repository:

```sh
docker compose up -d postgres
```

With the default Compose password and port, the example `DATABASE_URL` already matches that database. If you change the root Compose settings, update the API connection string to match.

Generate an admin password hash and a session secret:

```sh
npm run auth:hash -- "replace-with-your-own-password"
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Put the outputs in `ADMIN_PASSWORD_HASH` and `ADMIN_SESSION_SECRET` respectively. You can also change `ADMIN_USERNAME` and `ADMIN_PATH`. Both values must be configured to enable admin login.

Optional provider keys enable the corresponding collection sources and account integrations. See the comments in [apps/api/.env.example](apps/api/.env.example) and the [admin guide](docs/admin.md). Basic local development does not require provider credentials.

### 3. Initialize and run

```sh
npm run db:deploy
npm run db:seed
npm run dev
```

`db:deploy` applies the committed migrations. `db:seed` imports the repository's example photo content into your local database; replace that content with your own before publishing a derivative site.

| Service     | Default address                    |
| ----------- | ---------------------------------- |
| Public site | <http://localhost:5173>            |
| Admin       | <http://localhost:5174/admin>      |
| API health  | <http://localhost:8787/api/health> |

The admin address follows `ADMIN_PATH`. Development reads `apps/api/.env`; Docker Compose reads the root `.env`. See [local development](docs/local-development.md) for alternative database setups, proxy configuration, and port conflicts.

## Run the complete stack with Docker

Docker runs PostgreSQL, the application image, and Caddy. It serves the public site and admin on the same origin.

```sh
cp .env.example .env
docker compose build
docker compose run --rm --no-deps --entrypoint node app apps/api/dist/hash-password.js "replace-with-your-own-password"
```

Set the printed hash as `ADMIN_PASSWORD_HASH` in the root `.env`, and set a random `ADMIN_SESSION_SECRET` of at least 32 characters. Then start the stack:

```sh
docker compose up -d --wait
docker compose exec app node apps/api/dist/seed.js
```

Open <http://localhost:8080> and <http://localhost:8080/admin>, or the configured admin path. The application applies pending migrations at startup. Database records and uploads persist in Docker volumes.

This is a **local verification setup**. Production credentials, HTTPS, off-server backups, monitoring, and a tested rollback procedure must be configured before a public VPS deployment. See [full local run](docs/local-development.md#full-local-run-docker-compose).

## Development commands

| Command                                                     | Purpose                                                          |
| ----------------------------------------------------------- | ---------------------------------------------------------------- |
| `npm run dev`                                               | Start the API and both Vite apps                                 |
| `npm run dev:web` / `npm run dev:admin` / `npm run dev:api` | Start an individual app                                          |
| `npm run build`                                             | Build the public site, admin, and API                            |
| `npm run typecheck`                                         | Check workspace TypeScript types                                 |
| `npm test`                                                  | Run API and integration-style route tests with Vitest            |
| `npm run lint`                                              | Check JavaScript, TypeScript, and React Hooks rules              |
| `npm run format:check`                                      | Verify formatting                                                |
| `npm run format`                                            | Apply Prettier formatting                                        |
| `npm run db:migrate`                                        | Create development migrations and seed photos                    |
| `npm run db:deploy`                                         | Apply committed migrations                                       |
| `npm run db:studio`                                         | Open Prisma Studio                                               |
| `bash docker/smoke-test.sh`                                 | Build and exercise the full container stack with disposable data |

## Repository layout

```text
apps/
  web/             Public React site
  admin/           Separate admin application
  api/             Fastify service, Prisma schema, migrations, and tests
packages/
  content/         Photo seed data and content types
  shared/          API types, shared constants, and path rules
docker/            Caddy configuration, entrypoint, and smoke tests
docs/              Setup guides, architecture, decisions, and progress
scripts/           Maintenance helpers
.github/           CI workflows and Dependabot configuration
```

## Contributing and quality checks

Open an issue for a bug or proposed change, then submit a focused pull request. For personal reuse, update the site identity, content, and provider configuration rather than publishing the original personal content unchanged.

Before submitting a change, run:

```sh
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

PRs targeting `main` require the **Quality checks** and **smoke** checks to pass. CI covers formatting, lint, types, tests, and the full build; the Docker check exercises the production image, authentication, uploads, migrations, and persistence. The Docker badge above tracks `dev`, where that workflow runs on every push. The CodeQL badge links to the repository's scan results.

[Repository maintenance](docs/repository-maintenance.md) documents branch rules, dependency updates, security findings, and outstanding setup tasks.

## Documentation

- [Local development and Docker](docs/local-development.md)
- [Admin setup and integrations](docs/admin.md)
- [Database and migrations](docs/database.md)
- [Architecture](docs/architecture.md)
- [Repository maintenance](docs/repository-maintenance.md)
- [Project documentation index](docs/README.md)

## Security

Report vulnerabilities privately through [GitHub's vulnerability reporting form](https://github.com/Liam-Frost/Liam-Frost.github.io/security/advisories/new), following [SECURITY.md](SECURITY.md). Keep credentials, session cookies, and personal data out of public issues and logs.

## License and attribution

Original software source code and technical documentation are available under the **[MIT License](LICENSE)**. Preserve the copyright and license notice when copying or redistributing the software or substantial portions of it. Visible website attribution is optional; a link to this repository is appreciated.

**Photographs, personal writing, portraits, branding, and third-party materials are excluded from the software license.** See [content and third-party rights](CONTENT-LICENSE.md), including the rules for content embedded in seed data or referenced by URL.
