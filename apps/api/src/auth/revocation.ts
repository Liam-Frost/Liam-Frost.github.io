import type { AdminSession } from "./session";

const revokedSessionIds = new Map<string, number>();

function pruneExpired(now: number) {
  for (const [jti, exp] of revokedSessionIds) {
    if (exp <= now) {
      revokedSessionIds.delete(jti);
    }
  }
}

export function revokeSession(session: AdminSession) {
  const now = Math.floor(Date.now() / 1000);
  pruneExpired(now);
  revokedSessionIds.set(session.jti, session.exp);
}

export function isSessionRevoked(session: AdminSession) {
  const now = Math.floor(Date.now() / 1000);
  pruneExpired(now);
  return revokedSessionIds.has(session.jti);
}
