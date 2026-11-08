# Claude Code Review: Stage 16

Date: 2026-11-04

Scope: games (`69a559a..HEAD`): `game` kind migration, IGDB source and Twitch app token, game details in `extra.game`, validation, developer suggestions, admin tab and editor, site tab and panel, seed samples.

## Found During Live Verification (Fixed)

- Medium: IGDB ranked a fan mod named "Hollow Knight" above the game, so the import got a Vita-only entry without a developer. Searches skip mods, updates, bundles, packs and forks (test checks the query).

## Findings Fixed

- Medium: a raw-string edit turned AniList's id check into `/^\\d{1,9}$/`, rejecting every AniList import; the existing source test caught it before commit.
- Low: quotes or backslashes in a game search would end IGDB's quoted search string; they are replaced with spaces (test).
- Low: the seed script's patch replaced `extra` wholesale, which would drop a game's platforms; the sample no longer patches `extra`, and samples skip any source without credentials (not only TMDB).
- Low: `TWITCH_CLIENT_ID` without `TWITCH_CLIENT_SECRET` (or the reverse) was silently ignored; it is now a configuration error, like Spotify's pair.

## Not Changed

- IGDB summaries are English only; Chinese and Japanese titles come only when IGDB has them (Hollow Knight has a Japanese name but no Chinese one).
- The app token lives in memory; a restart gets a new one (tokens last about two months, and Twitch allows many).

## Follow-Up Verification

- `npm test`: 144 passed. `npm run typecheck`, `npm run build`: passed.
- `prisma migrate diff` from the migrated temporary database to the schema: empty.
