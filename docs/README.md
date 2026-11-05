# Project Docs

This folder is the source of truth for the migration from a static portfolio to a VPS-hosted full-stack personal site.

## Documents

- `motion.md`: the public site's motion tokens, `<Reveal>` and their checks (Stage 26).
- `repository-maintenance.md`: CI, formatting, branch rules, dependency updates and security follow-up.
- `architecture.md`: current architecture and intended direction.
- `admin.md`: admin authentication setup and current admin scope.
- `database.md`: PostgreSQL/Prisma setup and seed workflow.
- `plan-admin-projects-deploy.md`: execution plan for the admin app, projects module, local run, and VPS CI/CD (Chinese).
- `plan-collection.md`: execution plan for the collection module, Stages 11-17 (Chinese).
- `plan-analytics.md`: execution plan for visitor analytics, Stage 18 (Chinese).
- `plan-photos.md`: execution plan for photo sources, Stage 19 (Chinese).
- `plan-dashboard.md`: execution plan for the admin overview, Stage 20 (Chinese).
- `plan-home-collection.md`: execution plan for the home page collection section, Stage 21 (Chinese).
- `plan-admin-ux.md`: execution plan for the admin overview and API settings layout, Stage 22 (Chinese).
- `featured-quilt-wall.md`: how the home page's featured wall lays out, orders and plays entries, Stage 23.
- `tech-stack.md`: the database-driven tech stack, its logos, admin page and site layout, Stage 24.
- `progress.md`: migration progress by stage.
- `development-log.md`: chronological development log.
- `decisions.md`: user decisions and model-made implementation decisions.
- `performance.md`: performance and adaptive image quality notes from the original front-end.
- `reviews/`: external review records and follow-up notes.

## Documentation Rule

Docs should be updated in the same development stage as the code change they describe. If the model makes a technical choice that the user did not explicitly specify, record it in `decisions.md`.
