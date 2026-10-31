# Claude Code Review: Music Player

Date: 2026-10-31

Scope: `f749201..059d085`, covering the database-unavailable error mapping, the `Setting` model, the Spotify playlist sync and routes, the admin Music page, the web player rewrite and the proxy support.

## Findings Fixed

- Medium: saving a new playlist could join a sync of the old playlist that was already running, so the new playlist was not synced. `saveSettings` now waits for any running sync and then syncs again. A new test reproduces the problem and fails without the fix.
- Medium: with a single track, the player stopped after one preview but still showed itself as playing. The audio element now loops when there is only one track.
- Medium: the first visitor for a playlist waited for the whole sync (up to 100 cover lookups with 10 s timeouts each). Visitors now wait at most 8 s; the sync finishes in the background. Cover lookups have a 5 s timeout and a 20 s budget per sync. Tracks that fell back to the playlist cover are looked up again on the next sync.
- Low: a failure for one playlist blocked retries for any playlist for 10 minutes. The backoff now applies only to the playlist that failed (`attemptedId`).
- Low: unread response bodies on failed Spotify requests kept connections busy. They are now cancelled.
- Low: admin responses read the settings row twice. `status()` now takes the settings already read.
- Low: the auto-collapse field turned into 0 as soon as it was cleared. It now keeps its own text and accepts only valid values.
- Low: Media Session metadata and next/previous handlers outlived the player. They are cleared on unmount.
- Low: the docs still listed the removed `GET /api/spotify?url=` route. Updated `architecture.md`, `admin.md`, `database.md`, `decisions.md` and the README.
- Low: the web dev proxy read `WEB_API_PROXY` only from the environment, unlike the admin's `ADMIN_API_PROXY`. Both now also read `apps/api/.env`.

## Follow-Up Verification

- `npm test`: 74 passed.
- `npm run typecheck`, `npm run build`: passed.
- Browser, against a temporary database: the admin auto-collapse field can be cleared and retyped; in sequential mode the site starts with the playlist's first track.
