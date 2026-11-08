import type { AdminSession } from "./session";

/** Session IDs revoked by logout, kept until the session would have expired anyway. Single-instance only. */
export class SessionRevocations {
  private readonly revoked = new Map<string, number>();

  revoke(session: AdminSession) {
    this.prune();
    this.revoked.set(session.jti, session.exp);
  }

  /** For a session known only by id (`expiresAt` in seconds). */
  revokeId(id: string, expiresAt: number) {
    this.prune();
    this.revoked.set(id, expiresAt);
  }

  isRevoked(session: AdminSession) {
    this.prune();
    return this.revoked.has(session.jti);
  }

  private prune() {
    const now = Math.floor(Date.now() / 1000);
    for (const [jti, exp] of this.revoked) {
      if (exp <= now) {
        this.revoked.delete(jti);
      }
    }
  }
}
