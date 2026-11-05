# Tech Stack (Stage 24)

The home page's 技术栈 section is data from the database, managed in the admin (技术栈). Nothing about it is hard-coded in the site any more: `apps/web/src/data/skills.ts` and `SkillStack.tsx` are gone.

## Data

Two tables (migration `20261110090000_stack`):

- `StackCategory`: localized `name` and one-line `description` (JSON per language), `visible`, `sortOrder`.
- `StackTechnology`: `categoryId` (foreign key, `ON DELETE RESTRICT`), `name` (unique within its category; the API also refuses names that differ only in case), `iconProvider` (`none`, `devicon`, `simpleicons`, `custom`), `iconKey` (the icon's key in its library), `customIcon` (an uploaded logo, same JSON shape as project images), `websiteUrl` (http(s), no credentials), `prominence` (`primary` or `standard`), `visible`, `sortOrder` (within the category).

The migration also inserts the stack the site showed before, with fixed ids and `ON CONFLICT DO NOTHING`: it runs once, like every migration, so later admin changes are never overwritten, and running its inserts again adds nothing. Order is the order the site used to show (core, strong, working, then by name); the old "core" skills (React, Java, Lightroom) are `primary`. "SpringBoot" became "Spring Boot". Lightroom has no logo in either library (Simple Icons removed Adobe's logos), so it shows its initials until a logo is uploaded.

A category with technologies cannot be deleted by the database. The admin route asks for an explicit choice: move them to the end of another category, or delete them as well (with a confirmation).

## Logos

- **Libraries**: `devicon` and `simple-icons` are dependencies of the API only. `apps/api/src/stack/catalog.ts` reads their metadata (`devicon.json`, `data/simple-icons.json`) once, keeping only icons whose SVG file exists, and searches it by name, key and alternative names (Simple Icons slug rules, so "C++" finds `cplusplus`). Devicon names are lowercase only; titles come from Simple Icons where the same slug exists, plus a short list of usual spellings.
- **Serving**: library icons are served by the API at `/uploads/icons/<provider>/<key>.svg`, only for keys in the catalog, as `image/svg+xml` with a sandboxing CSP and `nosniff`. Simple Icons are single-colour paths and are filled with their brand colour (near-white colours get the site's ink). Under `/uploads` so the static emergency snapshot copies them like uploaded images.
- **Uploads**: `POST /api/admin/stack/technologies/:id/icon` takes SVG, PNG or WebP up to 2 MB. The declared type and the content must agree; SVGs with scripts, event handlers, entities, embedded HTML or external references are refused before parsing. Every upload, SVG included, is rendered by sharp to one transparent WebP (longest edge 256 px, ratio kept), stored under `UPLOAD_DIR/stack/<technologyId>/<imageId>/`. No SVG from an upload is ever stored or served. Choosing a library icon or "移除图标" deletes the uploaded file.
- **Site**: every logo is an `<img>` in a fixed tile (`object-fit: contain`); no icon JavaScript is bundled. A missing or failing logo shows the name's initials in the same tile. The tile is light in both themes, so dark logos stay visible on the dark theme.

## API

Public: `GET /api/stack` returns visible categories with their visible technologies (id, name, iconUrl, websiteUrl, prominence), in order; categories with no visible technology are left out. Without a database it answers 503, and the site shows "技术栈暂时无法加载" with a retry button rather than an old list.

Admin (signed in, CSRF header): `GET /api/admin/stack`, `GET /api/admin/stack/icons?q=`, `POST /api/admin/stack/categories`, `PATCH|DELETE /api/admin/stack/categories/:id` (`?technologies=move&to=<id>` or `?technologies=delete` for a category that is not empty), `POST /api/admin/stack/technologies`, `PATCH|DELETE /api/admin/stack/technologies/:id`, `POST /api/admin/stack/technologies/:id/icon`, `PUT /api/admin/stack/order` (the complete layout: every category and technology exactly once; anything else is `409 ORDER_OUT_OF_DATE`). Every write runs under one lock and answers with the whole stack.

## Admin

技术栈 lists categories (collapsible) with their technologies. Sorting: drag a category or a technology (also onto another category, or into an empty one), or use the arrows, which also work on touch screens; the new order shows at once and rolls back if saving fails. Less frequent actions (edit, show/hide, Primary/Standard, delete) are in each row's "更多操作" menu.

添加技术 searches the icon libraries as you type (ARIA combobox: ↑ ↓, Enter, Esc); picking a result fills the name and icon, and the last option keeps the typed name as a custom technology, whose logo can be uploaded in the same dialog. Dialogs ask before discarding unsaved changes; deletions are confirmed in the admin's own dialogs.

## Site layout

An editorial list instead of three cards of tags: each category is a row with its number, name and line on the left (about 30 %) and its technologies on the right in a grid that fills the width (three columns on desktop, two on phones). Rows are separated by thin rules, without cards. Technologies with a website are links (an arrow appears on hover or focus, and always on touch screens); the others are plain text. Primary technologies have a slightly bolder name, nothing more. Below 760 px the category name goes above its technologies.

## Verification

- Tests (`apps/api/test/stack.test.ts`): the migrated list and its order, every migrated logo exists in its library, catalog search, icon serving (unknown icons, wrong extensions and path tricks are 404), public fields and visibility, auth and database requirements, validation (names, icons, websites), duplicate names, editing, moving, deleting, complete-layout ordering, category deletion choices, uploading and replacing a logo (and the old file going), unsafe or mislabelled files, hidden logos not served to visitors.
- On a temporary PostgreSQL: the migration's data, running its inserts again (still 3 categories and 14 technologies), cross-category reordering, the database refusing to delete a category with technologies (P2003).
- In the browser (temporary database and API, throwaway admin account): the site at 320, 375, 390, 430, 768, 1024, 1280 and 1440 px (no sideways scroll, no clipped names, logos centred on their names, one column of categories below 760 px), light and dark themes, a failing logo turning into initials without moving anything, the error state with the API stopped. The admin: icon search with the keyboard, adding with a library icon and a website, uploading an SVG logo, arrows, dragging a technology into another category and a category above another (kept after reload), the menu, hide and Primary (reflected in `GET /api/stack`), the delete-category dialog, adding a category, the unsaved-changes prompt, the duplicate-name error, and the page and dialogs at 320 px.
