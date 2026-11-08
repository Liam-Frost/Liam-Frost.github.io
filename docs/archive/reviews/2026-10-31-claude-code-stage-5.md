# Claude Code Review: Stage 5

Date: 2026-10-31

Scope: back-end foundation and admin auth hardening (config validation, error handling, CSRF, `ADMIN_PATH`, `ADMIN_ALLOWED_IPS`, `packages/shared`, tests).

## Findings Fixed

- Medium: `TRUST_PROXY=true` trusts `X-Forwarded-For` from any peer. If the API port is reachable directly, a client could spoof an allowed IP to pass `ADMIN_ALLOWED_IPS` and rotate IPs to evade the login rate limit. Fixed: `TRUST_PROXY` also accepts a list of proxy IPs / CIDR ranges (validated), passed to Fastify so only those hops are trusted; docs recommend the list form.
- Low: blank numeric settings (`PORT=`, `ADMIN_SESSION_TTL_SECONDS=`) were coerced to 0 and rejected. Fixed: blank means default, like blank strings.
- Low: `config.databaseUrl` was parsed but unused (the DB layer reads `DATABASE_URL`). Removed.
- Low: the login route and `AdminAuthService.login` both checked that auth is configured. Kept the route-level check.

## Follow-Up Verification

- `npm test`: 30 passed (new: blank numbers, `TRUST_PROXY` parsing, spoofed `X-Forwarded-For` ignored from non-proxy peers).
- `npm run typecheck`, `npm run build`: passed.
