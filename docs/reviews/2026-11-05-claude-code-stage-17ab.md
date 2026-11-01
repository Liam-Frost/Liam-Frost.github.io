# Claude Code Review: Stage 17a and 17b

Date: 2026-11-05

Scope: bulk actions (`15e2477..HEAD`): batch routes for entries and people, the shared single-edit rules, admin selection mode; playlists: `Playlist` / `PlaylistTrack` tables, admin playlist routes, import hook, player playlist source, admin and site music views.

## Found During Browser Verification (Fixed)

- Medium: Shift-click selected only the clicked item. `useSelection` read the range anchor inside the state updater, which React runs after the anchor had moved to the clicked item; the anchor is read first now.
- Low: album and artist cards showed four copies of the same cover (each song stores its own copy); they show one cover, playlists keep the mosaic.

## Findings Fixed

- Medium: the editor's update rules (no status for songs, preview needed for the player, details per kind) would have been duplicated for bulk actions; PATCH and the batch route now share one `update` function, and refused entries come back with the same messages.
- Low: player settings saved before playlists existed would fail the new strict schema; `playlistId` defaults to none, and an older admin's save keeps playing every song marked "in player" (test).
- Low: the admin's player song count ignored the chosen playlist; it counts the playlist's playable songs.

## Not Changed

- Bulk actions run one entry at a time (deletes touch files, and the database pool is small); 500 entries take a few seconds.
- Playlists are reordered with up / down buttons, not drag and drop.

## Follow-Up Verification

- `npm test`: 151 passed. `npm run typecheck`, `npm run build`: passed.
- `prisma migrate diff` from the migrated temporary database to the schema: empty.
