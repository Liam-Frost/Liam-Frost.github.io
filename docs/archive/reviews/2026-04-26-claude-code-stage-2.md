# Claude Code Review: Stage 2

Date: 2026-04-26

Scope: latest Stage 2 commit adding the PostgreSQL/Prisma photo database foundation.

## Findings Fixed

- Medium: `compose.yaml` exposed PostgreSQL on all interfaces with development credentials. Fixed by binding `127.0.0.1:5432:5432`.
- Medium: `visibility` was an unconstrained string. Fixed by adding a Prisma `Visibility` enum with mapped database values.
- Medium: seed script error handling could shadow seed failures if disconnect also failed. Fixed with an explicit `try/catch/finally` runner.
- Medium: `db:migrate` did not seed after migration. Fixed by chaining `npm run db:seed` after `prisma migrate dev`.
- Low: docs omitted `db:migrate`. Fixed in `README.md` and `docs/database.md`.
- Low: decision log said Prisma was pinned while package versions used `^`. Fixed by using exact `6.19.3` versions.

## Findings Deferred

- `slug` is currently seeded from `photo.id`. Documented as a temporary decision until independent slug requirements are clear.
- Database JSON fields are cast without runtime validation. This remains acceptable while seed data is the only write path, but should be revisited before admin/user-supplied writes.
- Full PostgreSQL container verification is deferred because Docker is not available in the current shell.

## Follow-Up Verification

- `npm run db:generate`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm audit --audit-level=high`: passed with 0 vulnerabilities.
- Fastify seed-fallback route check: health returned `database: seed`; photos returned 40 items; existing photo returned 200; missing photo returned 404.
