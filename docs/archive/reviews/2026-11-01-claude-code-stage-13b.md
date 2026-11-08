# Claude Code Review: Stage 13b

Date: 2026-11-01

Scope: Spotify account connection and import (`27272ee..ce2917e` plus the working tree): OAuth flow and encrypted refresh token, Liked Songs / own playlist import, player type setting, admin Spotify dialog and player page, the web embedded player and CSP.

## Findings Fixed

- Medium: `apps/api/.env.example` set `SPOTIFY_CLIENT_ID=…` and `SPOTIFY_CLIENT_SECRET=…`. Copying it would make the API think Spotify is configured and send `…` to Spotify. The values are now empty, with the redirect URI documented.
- Low: the web dock built the iframe URL with `new URL()` on the stored link, so a malformed value would throw during render and take the page down. Only `open.spotify.com/{playlist|album|track|artist}/{id}` links are embedded; anything else hides the player.
- Low: the CSP test did not cover the new `frame-src`; it now does.
- Cleanup: the embedded dock copied the close and Spotify icons from the site player; both docks now share `CloseIcon` and `SpotifyLogo`.

## Follow-Up Verification

- `npm test`: 120 passed. `npm run typecheck`, `npm run build`: passed.
- Embedded player checked in the browser against a mock API.
