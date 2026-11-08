import type { PrismaClient } from "../generated/prisma/client";

/** The admin account once it has been changed from the server's configured one. */
export type AdminAccountRow = {
  username: string;
  passwordHash: string;
  passwordChangedAt: Date | null;
  /** Sessions signed before this time (seconds) no longer count. */
  sessionsNotBefore: number | null;
  /** Sealed with a server key; a database dump alone does not reveal them. */
  totpSecret: string | null;
  totpPendingSecret: string | null;
  totpPendingAt: Date | null;
  totpEnabledAt: Date | null;
  totpLastStep: number | null;
  /** Keyed hashes of the unused recovery codes. */
  recoveryCodes: string[];
  adminPath: string | null;
  adminPathPending: string | null;
  adminPathRetiring: string | null;
  adminPathRetireUntil: Date | null;
};

export type AdminSessionRow = {
  id: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  ip: string;
  userAgent: string;
  revokedAt: Date | null;
};

export interface AdminAccountRepository {
  loadAccount(): Promise<AdminAccountRow | null>;
  saveAccount(account: AdminAccountRow): Promise<void>;
  /** Sessions not expired yet, revoked ones included, newest first. */
  listSessions(now: Date): Promise<AdminSessionRow[]>;
  createSession(session: AdminSessionRow): Promise<void>;
  touchSession(id: string, at: Date): Promise<void>;
  /** True when a session with that id was found. */
  revokeSession(id: string, at: Date): Promise<boolean>;
  revokeSessionsExcept(id: string | null, at: Date): Promise<void>;
  purgeSessions(now: Date): Promise<void>;
}

/** For tests. */
export class MemoryAdminAccountRepository implements AdminAccountRepository {
  account: AdminAccountRow | null = null;
  readonly sessions = new Map<string, AdminSessionRow>();

  async loadAccount() {
    return this.account ? structuredClone(this.account) : null;
  }
  async saveAccount(account: AdminAccountRow) {
    this.account = structuredClone(account);
  }
  async listSessions(now: Date) {
    return [...this.sessions.values()]
      .filter((s) => s.expiresAt > now)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((s) => structuredClone(s));
  }
  async createSession(session: AdminSessionRow) {
    this.sessions.set(session.id, structuredClone(session));
  }
  async touchSession(id: string, at: Date) {
    const session = this.sessions.get(id);
    if (session) session.lastSeenAt = at;
  }
  async revokeSession(id: string, at: Date) {
    const session = this.sessions.get(id);
    if (!session) return false;
    session.revokedAt = at;
    return true;
  }
  async revokeSessionsExcept(id: string | null, at: Date) {
    for (const session of this.sessions.values())
      if (session.id !== id && !session.revokedAt) session.revokedAt = at;
  }
  async purgeSessions(now: Date) {
    for (const [id, session] of this.sessions)
      if (session.expiresAt <= now) this.sessions.delete(id);
  }
}

const ID = "admin";

export class PrismaAdminAccountRepository implements AdminAccountRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async loadAccount(): Promise<AdminAccountRow | null> {
    const row = await this.prisma.adminCredential.findUnique({ where: { id: ID } });
    if (!row) return null;
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...account } = row;
    return { ...account, recoveryCodes: row.recoveryCodes as string[] };
  }

  async saveAccount(account: AdminAccountRow) {
    await this.prisma.adminCredential.upsert({
      where: { id: ID },
      create: { id: ID, ...account },
      update: account
    });
  }

  listSessions(now: Date) {
    return this.prisma.adminSession.findMany({
      where: { expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" }
    });
  }

  async createSession(session: AdminSessionRow) {
    await this.prisma.adminSession.create({ data: session });
  }

  async touchSession(id: string, at: Date) {
    await this.prisma.adminSession.updateMany({ where: { id }, data: { lastSeenAt: at } });
  }

  async revokeSession(id: string, at: Date) {
    const { count } = await this.prisma.adminSession.updateMany({
      where: { id },
      data: { revokedAt: at }
    });
    return count > 0;
  }

  async revokeSessionsExcept(id: string | null, at: Date) {
    await this.prisma.adminSession.updateMany({
      where: { revokedAt: null, ...(id ? { id: { not: id } } : {}) },
      data: { revokedAt: at }
    });
  }

  async purgeSessions(now: Date) {
    await this.prisma.adminSession.deleteMany({ where: { expiresAt: { lte: now } } });
  }
}
