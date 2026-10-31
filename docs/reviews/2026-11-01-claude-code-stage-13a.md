# Claude Code Review: Stage 13a

Date: 2026-11-01

Scope: music collection (`95511a4..4509725`): song fields and `inPlayer`, iTunes search and import, Spotify playlist imports as background jobs, the player built from the collection, admin music tab / dialogs / song editor / player settings, and the public music tab.

## Findings Fixed

- Medium: the playlist reader kept only songs with a preview (it was written for the old runtime player), so imports silently dropped songs without one and never counted them. Songs without a preview are now imported (out of the player) and counted.
- Medium: the player listed songs newest first, so with shuffle off an imported playlist played backwards. The player now plays songs in the order they were added.
- Low: starting a second playlist while one was importing silently returned the first job. Starting the same playlist again still returns its job; another playlist gets `409 IMPORT_BUSY`.
- Low: the API accepted "in player" for songs without a preview (only the admin UI checked). PATCH now refuses it, including removing the preview of a song that is in the player.
- Low: the removed runtime sync's cached playlist stayed in the `Setting` table. Migration `20261101090000_drop_playlist_cache` deletes it.

## Found During Browser Verification (Fixed Before Review)

- The public collection showed tabs for kinds without entries ("电影 0"). Tabs now appear only for kinds with entries (and the one open from a link).

## Follow-Up Verification

- `npm test`: 110 passed. `npm run typecheck`, `npm run build`: passed.
