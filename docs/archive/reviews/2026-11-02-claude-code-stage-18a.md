# Claude Code Review: Stage 18a

Date: 2026-11-02

Scope: visitor analytics pipeline and overview (`d0e4f8d..HEAD`): `AnalyticsEvent` / `AnalyticsSession` / `AnalyticsDaily` / `AnalyticsRollupDay` / `AnalyticsSalt` tables, event ingestion, rollups and retention, country lookup, admin overview route and page; site tracking, player-bus play counting and the privacy page.

## Checked

- No IP is written anywhere: it is used only for the visitor hash, country lookup, exclusion list and rate limit (test asserts the stored rows do not contain it). Past salts are deleted when a new day's salt is created.
- Every event type keeps only its own fields; unknown routes, content without an id, unknown players or sources, zero visible time and malformed JSON are dropped without failing the batch, and the endpoint always answers 204.
- The signed-in admin, crawler User-Agents and excluded IPs are skipped before parsing.
- Rollups run before retention cleanup in the same pass; an error in the rollup stops the cleanup, so raw data is never deleted unsummarized.
- Overview comparisons cut the previous period at the same time of day when the range ends today (test with yesterday's evening visit excluded).
- Admin routes require the admin; ranges are validated (future end day, more than 366 days).

## Found During Browser Verification

- None in the code. The sample player could not load audio offline, so play counting was checked through the player bus (started by the dock, by a button, and a resume not counted twice).

## Findings Fixed

- Low: the analytics clock had an unused "start of local day" helper with its own daylight-saving logic; removed (it can come back with the 18b views if they need it).
- Low: a KPI card read "上期为 0（上期 0）" when the previous period had no data; it reads 新增 or 持平.
- Low: the new settings were not discoverable; `.env.example` and `.env` list them, commented, with their defaults.

## Not Changed

- Content ids are checked by format only; an id that does not exist would be stored. Stage 18b adds existence checks and name snapshots for the content views.
- The site player's fallback tracks (`apps/web/src/data/site.ts`) are counted as plays with their own ids; 18b can label or drop ids that are not collection songs.
- A play in Spotify's embedded player is counted when the song is loaded, not when it plays.
- The privacy page states 90 days; it does not read `ANALYTICS_EVENT_RETENTION_DAYS`.
- `ANALYTICS_COUNTRY_HEADER` trusts the header as sent; it must only be set behind a proxy that always sets it (documented).
- The admin's custom range uses the browser's date for "today"; the server checks the end day in the analytics time zone.

## Follow-Up Verification

- `npm test`: 170 passed. `npm run typecheck`, `npm run lint`, `npm run format:check`: passed. `npm run build`: passed.
- `prisma migrate diff` from the migrated temporary database to the schema: no difference.
