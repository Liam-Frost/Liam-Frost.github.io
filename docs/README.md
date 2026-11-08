# Project Docs

Documentation for the personal site: a public site, an admin app and an API, deployed on a VPS. Start with the [project README](../README.md) to run it.

## Using and running it

- `local-development.md`: running the site locally and with Docker.
- `admin.md`: admin setup and what each admin section does.
- `database.md`: PostgreSQL/Prisma setup, migrations and seed workflow.
- `repository-maintenance.md`: CI, formatting, branch rules, dependency updates and security follow-up.

## How it works

- `architecture.md`: how the apps and the API fit together.
- `website-settings-ui.zh-CN.md`: website settings: layout, components, drafts and saving (Chinese).
- `admin-security-review.md`: verified authentication controls, their limits and suggested follow-up.
- `collection-admin-ux.md`: collection sorting, genre translations, featured management and the proposed artist/group model (Chinese).
- `tech-stack.md`: the database-driven tech stack, its logos, admin page and site layout.
- `featured-quilt-wall.md`: how the home page's featured wall lays out, orders and plays entries.
- `waveform-navigator.md`: the waveform scroll navigator.
- `motion.md`: the public site's motion tokens, `<Reveal>` and their checks.
- `performance.md`: performance and adaptive image quality.
- `not-found.md`: document and hash-route 404 behavior.

## History

- `decisions.md`: user decisions and model-made implementation decisions.
- `progress.md`: progress by stage.
- `development-log.md`: chronological development log.
- `archive/`: finished plans, review records and the admin settings audit. See [its index](archive/README.md).

Deployment runbooks and production records are kept privately.

## Documentation Rule

Docs should be updated in the same development stage as the code change they describe. If the model makes a technical choice that the user did not explicitly specify, record it in `decisions.md`.
