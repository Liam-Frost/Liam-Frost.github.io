# Claude Code Review: Stage 17c and 17d

Date: 2026-11-06

Scope: Steam sync (`3e8885e..HEAD`): `SteamAccount` (OpenID sign-in, owned games), `SteamSync` job, Steam routes, purchase date and last played fields, admin Steam dialog; year in review on the site's collection page.

## Checked

- Sign-in: the callback needs a known, unexpired one-time state; Steam's answer must name Steam's endpoint and the exact return address, and Steam must confirm it (`check_authentication`), so a forged or replayed callback cannot connect another account (tests).
- The Web API key is only sent to `api.steampowered.com` and never appears in messages; a 401 / 403 says to check the key.
- Syncing again matches games by Steam id first, then by IGDB id, so it adds no duplicates and never touches status, rating or review.
- Store fallback strips HTML from the description and downloads covers only from allowed hosts.

## Findings Fixed

- Medium: a large library imports one game after another from IGDB, which allows four requests a second. A 429 made the game fall back to the Steam store's thinner details; IGDB requests now wait about a second and try once more (test).

## Not Changed

- Two Steam apps that IGDB maps to one game (e.g. an old and a remastered store page) import once; the second is reported as already in the collection.
- Steam syncs set no finished date, so synced games appear in the year in review only after the date is filled in.
- No daily automatic sync and no achievements yet.

## Follow-Up Verification

- `npm test`: 156 passed. `npm run typecheck`, `npm run build`: passed.
- Browser (temporary database): Steam dialog before connecting, the Steam sign-in address and callback; 回顾 tab on desktop and at 375 px.
