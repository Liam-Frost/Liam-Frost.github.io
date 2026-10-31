# Claude Code Review: Stage 6

Date: 2026-10-31

Scope: standalone `apps/admin` app, API hosting of the admin build at `ADMIN_PATH`, removal of the temporary `apps/web` admin page.

## Findings Fixed

- Low: on narrow screens the logout button's text was hidden, leaving the button without an accessible name. Added `aria-label`.
- Low: the query retry rule treated network failures (status 0) like 4xx errors, so they were never retried. Now only 4xx responses skip the retry.
- Low: placeholder pages showed internal stage names ("Stage 7") to the admin user. Replaced with a neutral "coming soon" message.

## Findings Accepted

- `index.html` is read from disk on each admin page request. Kept: it is a sub-kilobyte file, and reading it per request lets an admin rebuild take effect without restarting the API.

## Follow-Up Verification

- `npm run typecheck`, `npm run build:admin`: passed.
