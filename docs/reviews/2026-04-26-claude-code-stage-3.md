# Claude Code Review: Stage 3

Date: 2026-04-26

Scope: admin authentication foundation, including API auth helpers/routes, `/admin` front-end route, and admin documentation.

## Findings Fixed

- Medium: `POST /api/admin/login` had no rate limiting. Fixed with an in-memory IP-based login limiter that returns `429` after 8 attempts in 15 minutes.
- Low: `requireAdmin()` returned `null` and could be misused by future route handlers. Fixed by making it a Fastify preHandler-style guard that sets `request.adminUser`.
- Low: logout only cleared the browser cookie. Fixed by adding in-memory session revocation keyed by session `jti` until token expiration.
- Informational: scrypt parameters were implicit. Fixed by passing explicit `N=16384`, `r=8`, and `p=1` options.
- Informational: admin docs showed `ADMIN_COOKIE_SECURE=false` without a prominent warning. Fixed by adding a development-only comment in examples.

## Findings Accepted

- `/api/admin/session` exposes `configured: false` when auth is not configured. This is retained for now so the hidden admin UI can explain setup state during local development.
- HMAC comparison still rejects mismatched signature lengths before `timingSafeEqual`; this is acceptable for fixed-length HMAC-SHA256 signatures and avoids throwing.

## Follow-Up Verification

- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm audit --audit-level=high`: passed with 0 vulnerabilities.
- Admin auth flow: unauthenticated session, bad login, good login, authenticated session, `/api/admin/me`, logout, and revoked-token access all behaved as expected.
- Login rate limit: the 9th bad login attempt returned `429`.
