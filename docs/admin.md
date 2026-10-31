# Admin

## Current Scope

Stage 3 added the authentication foundation; Stage 5 hardened it and added a configurable admin path and an IP allowlist.

Current admin features:

- API session check: `GET /api/admin/session` (returns `adminPath` only to a signed-in admin).
- API login: `POST /api/admin/login`.
- API logout: `POST /api/admin/logout`.
- Signed-in check: `GET /api/admin/me`.
- Reusable backend guard: `AdminAuthService.requireAdmin` (Fastify `preHandler`).
- Temporary front-end login page at `#/admin` in `apps/web`. It is replaced by the standalone `apps/admin` app in Stage 6.

Photo CRUD, uploads, project management, and media collection management come in later stages.

## Configuration

All settings are validated at startup (`apps/api/src/config/env.ts`); an invalid value stops the API with a list of every problem.

Generate a password hash:

```bash
npm run auth:hash -- your-password
```

Set the API environment values in `apps/api/.env`:

```txt
ADMIN_USERNAME=liam
ADMIN_PASSWORD_HASH=scrypt:v1:...
# At least 32 characters
ADMIN_SESSION_SECRET=replace-with-a-long-random-secret
ADMIN_SESSION_TTL_SECONDS=28800
# DEVELOPMENT ONLY. Defaults to true when NODE_ENV=production.
ADMIN_COOKIE_SECURE=false
ADMIN_PATH=/admin
ADMIN_ALLOWED_IPS=
TRUST_PROXY=false
```

| Variable | Default | Notes |
|---|---|---|
| `ADMIN_USERNAME` | `admin` | |
| `ADMIN_PASSWORD_HASH` | empty | Must come from `npm run auth:hash`. Set together with the secret. |
| `ADMIN_SESSION_SECRET` | empty | At least 32 characters. Set together with the hash. |
| `ADMIN_SESSION_TTL_SECONDS` | `28800` | 300 s to 30 days. |
| `ADMIN_COOKIE_NAME` | `lf_admin_session` | |
| `ADMIN_COOKIE_SECURE` | `true` in production | Set `false` only for local HTTP development. |
| `ADMIN_PATH` | `/admin` | Where the admin app is served. Letters, digits, `-`, `_` and `/` only; cannot be `/` or start with `/api`, `/uploads`, `/assets`. Changing it needs only a restart. |
| `ADMIN_ALLOWED_IPS` | empty (no restriction) | Comma-separated IPs / CIDR ranges, IPv4 and IPv6. |
| `TRUST_PROXY` | `false` | Set `true` only behind a reverse proxy you control; then the client IP comes from `X-Forwarded-For`. |

Admin auth is enabled only when both `ADMIN_PASSWORD_HASH` and `ADMIN_SESSION_SECRET` are set; setting just one is a configuration error. With neither set, admin routes answer `503 ADMIN_NOT_CONFIGURED`.

On Windows Git Bash, a value like `ADMIN_PATH=/studio` on the command line is rewritten to a Windows path; put it in `.env` or write `ADMIN_PATH=studio`.

## Security Model

- **Password**: stored only as a scrypt hash (`N=16384, r=8, p=1`). Scrypt runs even for a wrong username so timing does not reveal valid usernames.
- **Session**: HttpOnly, `SameSite=Strict` cookie containing an HMAC-SHA256-signed token with an expiry. Logout revokes the token in memory until it expires.
- **CSRF**: every non-GET `/api/admin/*` request must send `x-admin-request: 1` (`ADMIN_REQUEST_HEADER` in `@liam-frost/shared`). Cross-site forms cannot set custom headers, and cross-origin scripts need a CORS preflight that only configured origins pass.
- **Rate limit**: 8 login attempts per IP per 15 minutes, then `429` with `Retry-After`.
- **IP allowlist**: when `ADMIN_ALLOWED_IPS` is set, every `/api/admin/*` route answers other IPs with the exact same `404` as an unknown route, before any other check, so the admin API's existence is not revealed.
- **Admin path**: `ADMIN_PATH` is never returned by public endpoints; only a signed-in admin gets it from `/api/admin/session`. The admin app itself is served at that path from Stage 6.
- **Logs**: `authorization`, `cookie` and `set-cookie` headers are redacted.

Rate-limit counters and revoked sessions live in process memory, so the API must run as a single instance.

## Error Format

All API errors use one shape:

```json
{ "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid username or password" } }
```

Codes used by admin routes: `VALIDATION`, `REQUEST_ERROR`, `CSRF`, `UNAUTHORIZED`, `INVALID_CREDENTIALS`, `TOO_MANY_ATTEMPTS`, `ADMIN_NOT_CONFIGURED`, `NOT_FOUND`.

## Tests

`npm test` runs the API tests (Vitest + Fastify `inject`) covering configuration validation, admin path rules, IP lists, login, CSRF, rate limiting, session revocation, cookie tampering, the IP allowlist and `TRUST_PROXY`.
