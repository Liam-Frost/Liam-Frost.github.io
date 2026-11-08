# Admin authentication review

The current API limits a client IP to eight login attempts in a fifteen-minute window. The ninth request returns HTTP 429 with Retry-After. Successful login clears that IP's counter. This limits attempts rather than permanently banning an account; it is in memory and resets when the application restarts. It is suitable for the current single write authority, but does not coordinate multiple application instances or stop a distributed attack.

Existing protections in the source include salted scrypt password hashes, constant-time hash/signature comparison, the same password derivation path for a wrong username, HMAC-signed expiring sessions, random session IDs, HttpOnly/SameSite=Strict cookies, Secure cookies by default in production, session revocation on logout, authenticated admin routes, an optional IP/CIDR allowlist, CSRF custom-header checks before body parsing, input schemas and size limits. The configured admin path avoids casual discovery but is not a replacement for authentication. Public responses hide the admin path until sign-in.

Admin audit records login outcomes, logout, matched writes and rejected reads, without bodies, passwords, queries or session credentials. The new log is read-only through the API; it is not an independently tamper-proof archive. Sessions and their revocations are stored in the database; attempt counters are process-local. IP-based controls depend on a correct trusted-proxy boundary; never trust arbitrary forwarded IP headers.

Two-step sign-in (TOTP with recovery codes), password and username changes and per-device session revocation are available on the 账号与安全 page. Recommended next steps are persistent/shared attempt counters, a bounded global login-rate budget alongside the per-IP limit, and optional passkeys. Prefer a cooldown with clear retry guidance to a permanent account lock that attackers could use to deny the owner access. Edge rate limiting should reinforce the application control after verifying the actual proxy IP chain. Alert on bursts using audit outcomes, and test notification delivery.

No permanent IP ban, persistent limiter or edge-rule deployment is claimed by this review. Authentication tests use isolated local servers; do not brute-force the production login while validating the limit.

## Dependency audit

The development toolchain inherited GHSA-g3hv-75wg-m249 through minimatch. This change pins its transitive resolution to 11.0.5 rather than downgrading ESLint and TypeScript tooling. The advisory identifies 11.0.1 as the first patched version; the repository uses Node 26. Compatibility is validated by the full lint/build/CI checks. A clean package audit is a dependency snapshot, not a security certification. [Upstream advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249).
