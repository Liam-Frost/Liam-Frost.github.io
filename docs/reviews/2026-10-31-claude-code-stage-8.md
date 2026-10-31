# Claude Code Review: Stage 8

Date: 2026-10-31

Scope: projects module (`ab415b1..cc0af10`): schema and migration, repository, admin and public project API, project images under `/uploads`, admin Projects list and editor, web home section, `/projects`, `/projects/:slug`.

## Findings Fixed

- Medium: image upload, image delete and gallery reorder each read the project and wrote back image lists computed from that snapshot, so concurrent requests overwrote each other (a screenshot could vanish from the project while its files stayed on disk). These read-modify-write updates now run one at a time per project (`lib/keyed-lock.ts`); image processing stays outside the lock. A new test uploads three screenshots concurrently and fails without the fix.
- Low: every project image request loaded the whole project row, including Markdown bodies in five languages. `/uploads` now uses `ProjectRepository.imageAccess`, which selects only visibility, cover and gallery.
- Low: `GET /api/projects/:slug` returned 500 when the database was unreachable. It now answers 503 `UNAVAILABLE`.
- Low: `IconButton` was duplicated in the Photos and Projects pages and imported by the editor from a page module. Moved to `components/ui/IconButton.tsx`.
- Low: the project editor silently discarded unsaved text edits. It now shows "有未保存的修改", asks before leaving via its back arrow and before closing/reloading the tab, and adopts the server's normalized values after saving. Navigating away through the sidebar is not intercepted (the app uses `BrowserRouter`, which has no navigation blocker).

## Follow-Up Verification

- `npm test`: 56 passed.
- `npm run typecheck`, `npm run build`: passed.
