# Claude Code Review: Stage 9

Date: 2026-10-31

Scope: production build and Docker stack (`4702763..`): esbuild bundle, site hosting from the API, Dockerfile, entrypoint, `compose.yaml`, Caddy, smoke test and its workflow.

## Findings Fixed

- Medium: `compose.yaml` defaulted `ADMIN_COOKIE_SECURE` to `false`, which overrode the API's production default. The default is now `true`; `.env.example` sets `false` for local plain-HTTP runs.
- Medium: the smoke test did not wait for Caddy (it has no health check), so the first request through it could fail at random. The test now waits until `/api/health` answers through Caddy after each start.
- Low: the site and admin hosting each had their own content-type map. Both now use `routes/content-types.ts`.
- Low: site files whose names need percent-encoding were never found. Paths are decoded before the lookup; Fastify rejects malformed encoding with 400.
- Low: the public site had no Content-Security-Policy. `index.html` now gets one: scripts from the origin plus the inline theme bootstrap by hash (computed from the build), Google Fonts, HTTPS images and media, `connect-src 'self'`, no framing.

## Not Changed

- PostgreSQL stays published on `127.0.0.1:${POSTGRES_PORT}` because `npm run dev` uses it. The port can be changed in `.env`, and the runbook says so.

## Follow-Up Verification

- `npm test`: 79 passed. `npm run typecheck`, `npm run build`: passed.
- The bundled server, run outside Docker with the new CSP: theme bootstrap, Google Fonts, Flickr photos and the Spotify player work. The browser pane reported one blocked inline script that is not in the site's HTML or bundle (probably the pane's own instrumentation).
- Docker smoke test on GitHub Actions: see the pull request.
