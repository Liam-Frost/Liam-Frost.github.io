# Liam Frost Personal Site

Personal site migration from a static React portfolio to a full-stack application for photography, projects, and future media collections.

## Structure

- `apps/web`: React + Vite front-end. The visual UI is preserved from the original static site.
- `apps/api`: Fastify API service. Current first-stage API exposes health, photos, and Spotify metadata endpoints.
- `packages/content`: Shared content seed data and content types used by both web and API.
- `docs`: Project documentation, progress, logs, and decision records.
- `scripts`: One-off maintenance helpers.

## Commands

- `npm run dev:web`: run the front-end dev server.
- `npm run dev:api`: run the API dev server on `localhost:8787` by default.
- `npm run build`: build/type-check all workspaces that participate in this stage.
- `npm run typecheck`: run workspace type checks.

## Migration Notes

The front-end initializes from the shared static photo seed and then fetches `/api/photos`. This keeps the page stable if the API is not running during early migration, while allowing the VPS deployment to use the backend API.

See `docs/README.md` for the full project record.
