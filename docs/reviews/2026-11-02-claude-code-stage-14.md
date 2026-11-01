# Claude Code Review: Stage 14

Date: 2026-11-02

Scope: links between collection entries and people (`2bcbc72..HEAD`): `Person` and `MediaRelation` tables and migration, people and relation routes, suggestions (TMDB credits, singers, AniList), public links / people / person routes and photo serving, admin people pages and links panel, site people tab and panels.

## Found During Browser Verification (Fixed)

- High: importing a TMDB person always failed (500): the details' `photoUrl` was spread into `person.create`, which Prisma rejects. The in-memory repository accepted it, so tests passed. Fixed, and the in-memory repository now rejects unknown fields; two tests failed without the fix.
- High: pressing Enter in the add-link dialog reloaded the admin page. The dialog's `<form>` was nested inside the entry editor's `<form>`. Dialogs now render into `<body>` and stop submit events; this also fixes the existing 找试听 dialog.
- Medium: animated films on TMDB list voice actors as cast with "Chihiro (voice)"; they were suggested as actors. They are now voice roles with the suffix removed.

## Findings Fixed

- Medium: AniList relations matched entries by title only, so a manga named like its anime ("ぼっち・ざ・ろっく！") would suggest the anime as its own source. Only anime relations match anime entries now; manga will match comics in Stage 15.
- Low: a person credited twice in one work (director and screenwriter) appeared twice in their works list; works are merged with all roles.
- Low: a song's panel listed its singers twice (source credits and linked people); linked people replace the source credits.
- Test coverage: malformed link bodies (missing or null `from`, bad ids, unknown types) are checked to answer 400, not 500.

## Not Changed

- A public person's photo is served even when they have no shown entry (the person itself is not listed then). Photo URLs contain a random image id, and the person is public; checking every credit per image request was not worth it.
- The person editor repeats the entry editor's language tabs and image panel; extracting shared components is left for Stage 15, when books and comics add more editors.

## Follow-Up Verification

- `npm test`: 131 passed. `npm run typecheck`, `npm run build`: passed.
- `prisma migrate diff` from the migrated temporary database to the schema: empty.
