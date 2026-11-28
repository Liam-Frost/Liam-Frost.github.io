# Architecture

This npm workspace contains three applications. See [local development](local-development.md) for setup, migrations and repository checks.

| Workspace        | Responsibility                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------- |
| apps/web         | React and Vite site with photography, projects, collections and a player                    |
| apps/admin       | Separate React and Vite admin bundle, with Tailwind and TanStack Query                      |
| apps/api         | Fastify API, authentication, uploads, background work and production serving of both builds |
| packages/shared  | Shared DTOs, validation constants and configuration helpers                                 |
| packages/content | Starter content for seeding and supported static fallbacks                                  |

## Serving requests

Fastify can serve both bundles, the API and uploads on one origin. The local Docker setup uses Caddy at the front. The admin build uses relative assets and is served at the configured ADMIN_PATH. Fastify injects that base path at runtime. See [public routing](performance.md#routing-and-not-found-pages) and [admin authentication](admin.md#authentication-limits).

## Data and media

PostgreSQL and Prisma store photos, projects, collections, technology links, settings and analytics. The [database schema](../apps/api/prisma/schema.prisma) defines the models. Configured database galleries show public records only, including an empty gallery when there are no public records. The photo API can fall back to seed content when a usable database is unavailable. Project content and admin writes require the database.

Uploaded images use local storage keys and generated variants. Remote photos retain a source URL. Projects use stable UUIDs, editable slugs and localized Markdown. ProjectTechnology links projects and stack entries, with unmatched technology names stored as text.

The API validates environment settings at startup. Tests create isolated Fastify instances with explicit configuration. The API's [error format](admin.md#error-format) is shared between the web and admin applications. Production-specific infrastructure and release records are maintained privately.
