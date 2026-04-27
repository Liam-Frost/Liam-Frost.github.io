# Decisions

## User Decisions

### 2026-04-26: Full-Stack VPS Migration

The project should move away from a pure static GitHub Pages site and become a full personal site deployed to a VPS with front-end and back-end separation.

### 2026-04-26: Preserve Existing UI

The migrated site must look and behave the same as before migration. Architecture changes should not cause visual disorder or functional regressions.

### 2026-04-26: Documentation Under `docs`

The project should keep detailed documentation, progress records, development logs, and user/model decision records under `docs`.

### 2026-04-26: Commit and Review Workflow

Development should commit frequently to `dev`. After a major stage, run Claude Code CLI review, fix findings, then prepare a PR and notify the user.

### 2026-04-26: Flexible Image Storage

The future image storage direction is Cloudflare R2, but the system should also allow local paths and existing image-host URLs.

## Model Decisions

### 2026-04-26: Incremental Migration Instead of Rewrite

The model chose not to rewrite the front-end or redesign pages. The first stage only reorganizes the repository and adds an API foundation so the existing UI remains stable.

Reason: the user explicitly prioritized identical appearance and behavior after migration.

### 2026-04-26: Use npm Workspaces

The model chose npm workspaces with `apps/web`, `apps/api`, and `packages/content`.

Reason: the repository already used npm and `package-lock.json`; npm workspaces keep front-end, back-end, and shared packages clear without introducing another package manager.

### 2026-04-26: Extract Photo Seed to `packages/content`

The model chose to move existing photo data into a shared package instead of duplicating it in front-end and API.

Reason: this keeps the migrated UI content identical and avoids maintaining two copies before the database exists.

### 2026-04-26: Seed-First Front-End Data Loading

The model chose to initialize photo pages from shared seed data and then fetch `/api/photos`.

Reason: this prevents blank or broken pages when the API is not running during early migration, while still establishing the future API data path.

### 2026-04-26: Fastify for the Initial API

The model chose Fastify for the first back-end scaffold.

Reason: it is small, fast, TypeScript-friendly, and sufficient for health checks, content APIs, metadata endpoints, and future admin CRUD.

### 2026-04-26: Defer Database and Admin CRUD

The model chose not to introduce PostgreSQL, Prisma, authentication, and admin CRUD in the first structural commit.

Reason: introducing all of them at once would make regressions harder to isolate; Stage 1 should first prove the repo structure and API boundary.

### 2026-04-26: Remove Tracked `my-app` Scaffold

The model chose to remove the tracked `my-app` Vite starter scaffold.

Reason: it was a standalone unused starter app and conflicted with the user's requirement for a clear repository structure.
