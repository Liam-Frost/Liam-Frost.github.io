import {
  ADMIN_REQUEST_HEADER,
  isAdminPagePath,
  normalizeAdminPath,
  type AdminAccountStatus,
  type AdminLoginSecondFactor,
  type AdminUser
} from "@liam-frost/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import { createHmac, timingSafeEqual } from "node:crypto";

import type { AdminConfig } from "../config/env";
import { HttpError, notFound } from "../lib/errors";
import { KeyedLock } from "../lib/keyed-lock";
import { SecretBox } from "../lib/secret-box";
import type { AdminAccountRepository, AdminAccountRow } from "./account-repository";
import { LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MINUTES, LoginRateLimiter } from "./login-rate-limit";
import { hashPassword, verifyPassword } from "./password";
import { SessionRevocations } from "./revocation";
import { createSessionToken, verifySessionToken, type AdminSession } from "./session";
import { matchTotp, newRecoveryCodes, newTotpSecret, normalizeRecoveryCode, totpUri } from "./totp";

declare module "fastify" {
  interface FastifyRequest {
    adminUser?: AdminUser;
  }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const RELOAD_INTERVAL_MS = 30 * 1000;
const TOTP_SETUP_MS = 10 * 60 * 1000;
const PATH_RETIRE_MS = 24 * 60 * 60 * 1000;
const ISSUER = "Liam Frost Admin";
/** First segments the public site uses for its own pages; the admin cannot take them over. */
const SITE_PAGES = ["/projects", "/portfolio", "/collection", "/privacy", "/people"];

const wrongPassword = () => new HttpError(403, "WRONG_PASSWORD", "Current password is incorrect");

/** Admin authentication and account state for one server instance. */
export class AdminAuthService {
  readonly limiter = new LoginRateLimiter();
  private readonly revocations = new SessionRevocations();
  private readonly lock = new KeyedLock();
  private readonly box: SecretBox;
  private readonly touched = new Map<string, number>();
  private account: AdminAccountRow | null = null;
  private loaded: boolean;
  private reloadTimer: NodeJS.Timeout | null = null;

  constructor(
    readonly config: AdminConfig,
    private readonly repo: AdminAccountRepository | null = null,
    private readonly now: () => number = Date.now
  ) {
    this.box = new SecretBox(config.sessionSecret, "admin-account-v1");
    this.loaded = repo === null;
  }

  get configured() {
    return this.config.configured;
  }

  get username() {
    return this.account?.username ?? this.config.username;
  }

  /** Where the admin is served; a confirmed switch overrides the server's ADMIN_PATH. */
  get path() {
    return this.account?.adminPath ?? this.config.path;
  }

  get pendingPath() {
    return this.account?.adminPathPending ?? null;
  }

  /** The address retired by the last switch, while its redirect still applies. */
  get retiringPath() {
    const account = this.account;
    return account?.adminPathRetiring &&
      account.adminPathRetireUntil &&
      account.adminPathRetireUntil.getTime() > this.now()
      ? account.adminPathRetiring
      : null;
  }

  /**
   * Reads the saved account and revoked sessions. Until this has worked, nobody can sign in or stay
   * signed in: falling back to the configured password could reopen one that was changed.
   */
  async load() {
    if (!this.repo) return;
    try {
      const now = new Date(this.now());
      await this.repo.purgeSessions(now);
      const [account, sessions] = await Promise.all([
        this.repo.loadAccount(),
        this.repo.listSessions(now)
      ]);
      this.account = account;
      for (const session of sessions)
        if (session.revokedAt)
          this.revocations.revokeId(session.id, Math.ceil(session.expiresAt.getTime() / 1000));
      this.loaded = true;
    } catch (error) {
      this.loaded = false;
      console.warn("Admin account could not be read; sign-in is unavailable", error);
      if (!this.reloadTimer) {
        this.reloadTimer = setTimeout(() => {
          this.reloadTimer = null;
          void this.load();
        }, RELOAD_INTERVAL_MS);
        this.reloadTimer.unref?.();
      }
    }
  }

  stop() {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
    this.reloadTimer = null;
  }

  /** ADMIN_ALLOWED_IPS; an empty list allows every address. Uses request.ip, which honors TRUST_PROXY. */
  ipAllowed(request: FastifyRequest) {
    return this.config.allowedIps.size === 0 || this.config.allowedIps.has(request.ip);
  }

  /** Hidden admin routes answer exactly like unknown routes, so their existence is not revealed. */
  assertIpAllowed(request: FastifyRequest) {
    if (!this.ipAllowed(request)) {
      request.log.warn(
        { ip: request.ip, url: request.url.split("?")[0] },
        "Admin request from IP outside ADMIN_ALLOWED_IPS"
      );
      throw notFound();
    }
  }

  /** Writes must carry a custom header that cross-site forms cannot set; combined with SameSite=Strict cookies. */
  assertCsrfHeader(request: FastifyRequest) {
    if (SAFE_METHODS.has(request.method)) return;
    if (request.headers[ADMIN_REQUEST_HEADER] !== "1") {
      throw new HttpError(403, "CSRF", "Missing required request header");
    }
  }

  assertConfigured() {
    if (!this.configured) {
      throw new HttpError(503, "ADMIN_NOT_CONFIGURED", "Admin authentication is not configured");
    }
  }

  private sessionOf(request: FastifyRequest): AdminSession | null {
    if (!this.configured || !this.loaded) return null;
    const session = verifySessionToken(
      request.cookies[this.config.cookieName],
      this.config.sessionSecret
    );
    if (
      !session ||
      session.sub !== this.username ||
      this.revocations.isRevoked(session) ||
      session.iat < (this.account?.sessionsNotBefore ?? 0)
    )
      return null;
    return session;
  }

  /** The signed-in admin for this request, or null. */
  identify(request: FastifyRequest): AdminUser | null {
    const session = this.sessionOf(request);
    return session ? { username: session.sub } : null;
  }

  private async issueSession(request: FastifyRequest, reply: FastifyReply) {
    const token = createSessionToken(
      this.username,
      this.config.sessionSecret,
      this.config.sessionTtlSeconds
    );
    reply.setCookie(this.config.cookieName, token, {
      httpOnly: true,
      maxAge: this.config.sessionTtlSeconds,
      path: "/",
      sameSite: "strict",
      secure: this.config.cookieSecure
    });
    const session = verifySessionToken(token, this.config.sessionSecret)!;
    const at = new Date(this.now());
    await this.repo
      ?.createSession({
        id: session.jti,
        createdAt: at,
        lastSeenAt: at,
        expiresAt: new Date(session.exp * 1000),
        ip: request.ip,
        userAgent: String(request.headers["user-agent"] ?? "").slice(0, 300),
        revokedAt: null
      })
      .catch((error) => request.log.warn({ error }, "Admin session could not be recorded"));
    return session;
  }

  private consumeAttempt(reply: FastifyReply | null, key: string, message: string) {
    const rateLimit = this.limiter.consume(key);
    if (!rateLimit.allowed) {
      reply?.header("Retry-After", String(rateLimit.retryAfterSeconds));
      throw new HttpError(429, "TOO_MANY_ATTEMPTS", message);
    }
  }

  private async ensureLoaded() {
    if (!this.loaded) await this.load();
    if (!this.loaded)
      throw new HttpError(503, "ACCOUNT_UNAVAILABLE", "Sign-in is temporarily unavailable");
  }

  private recoveryHash(code: string) {
    return createHmac("sha256", this.config.sessionSecret)
      .update(`recovery:${normalizeRecoveryCode(code)}`)
      .digest("base64url");
  }

  private matchRecovery(account: AdminAccountRow, code: string) {
    const given = Buffer.from(this.recoveryHash(code));
    return account.recoveryCodes.find((stored) => {
      const candidate = Buffer.from(stored);
      return candidate.length === given.length && timingSafeEqual(candidate, given);
    });
  }

  /** Checks an authenticator or recovery code, using it up. False when wrong. */
  private async useSecondFactor(second: AdminLoginSecondFactor) {
    return this.lock.run("account", async () => {
      const account = this.account!;
      if (second.totp) {
        const secret = this.box.open(account.totpSecret ?? "");
        const step = secret
          ? matchTotp(secret, second.totp, this.now(), account.totpLastStep)
          : null;
        if (step === null) return false;
        await this.persist({ ...account, totpLastStep: step });
        return true;
      }
      if (second.recoveryCode) {
        const stored = this.matchRecovery(account, second.recoveryCode);
        if (!stored) return false;
        await this.persist({
          ...account,
          recoveryCodes: account.recoveryCodes.filter((code) => code !== stored)
        });
        return true;
      }
      return false;
    });
  }

  /** Callers check assertConfigured() first. */
  async login(
    request: FastifyRequest,
    reply: FastifyReply,
    username: string,
    password: string,
    second: AdminLoginSecondFactor = {}
  ): Promise<AdminUser> {
    this.consumeAttempt(reply, request.ip, "Too many login attempts. Try again later.");
    await this.ensureLoaded();

    // Always run scrypt so a wrong username takes as long as a wrong password.
    const passwordMatches = await verifyPassword(
      password,
      this.account?.passwordHash ?? this.config.passwordHash
    );
    if (username !== this.username || !passwordMatches) {
      request.log.warn({ ip: request.ip }, "Admin login failed");
      throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid username or password");
    }

    if (this.account?.totpEnabledAt) {
      if (!second.totp && !second.recoveryCode)
        throw new HttpError(401, "TOTP_REQUIRED", "Enter the code from your authenticator");
      if (!(await this.useSecondFactor(second))) {
        request.log.warn({ ip: request.ip }, "Admin login failed at the second factor");
        throw new HttpError(401, "INVALID_TOTP", "That code is not valid");
      }
    }

    this.limiter.reset(request.ip);
    await this.issueSession(request, reply);
    request.log.info({ ip: request.ip }, "Admin logged in");
    return { username: this.username };
  }

  logout(request: FastifyRequest, reply: FastifyReply) {
    if (this.configured) {
      const session = verifySessionToken(
        request.cookies[this.config.cookieName],
        this.config.sessionSecret
      );
      if (session) {
        this.revocations.revoke(session);
        void this.repo
          ?.revokeSession(session.jti, new Date(this.now()))
          .catch((error) => request.log.warn({ error }, "Session revocation was not saved"));
      }
    }
    reply.clearCookie(this.config.cookieName, { path: "/" });
  }

  /** preHandler for routes that require a signed-in admin. */
  requireAdmin = async (request: FastifyRequest) => {
    this.assertConfigured();
    const session = this.sessionOf(request);
    if (!session) {
      throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
    }
    request.adminUser = { username: session.sub };
    this.touch(request, session);
  };

  private touch(request: FastifyRequest, session: AdminSession) {
    if (!this.repo) return;
    const now = this.now();
    if (now - (this.touched.get(session.jti) ?? 0) < TOUCH_INTERVAL_MS) return;
    this.touched.set(session.jti, now);
    void this.repo
      .touchSession(session.jti, new Date(now))
      .catch((error) => request.log.warn({ error }, "Session activity was not saved"));
  }

  // ---- Account management. Every method below requires a signed-in admin.

  private requireRepo() {
    if (!this.repo)
      throw new HttpError(
        503,
        "DATABASE_NOT_CONFIGURED",
        "Changing the account needs a database (set DATABASE_URL)"
      );
    return this.repo;
  }

  private base(): AdminAccountRow {
    return (
      this.account ?? {
        username: this.config.username,
        passwordHash: this.config.passwordHash,
        passwordChangedAt: null,
        sessionsNotBefore: null,
        totpSecret: null,
        totpPendingSecret: null,
        totpPendingAt: null,
        totpEnabledAt: null,
        totpLastStep: null,
        recoveryCodes: [],
        adminPath: null,
        adminPathPending: null,
        adminPathRetiring: null,
        adminPathRetireUntil: null
      }
    );
  }

  private async persist(next: AdminAccountRow) {
    await this.requireRepo().saveAccount(next);
    this.account = next;
  }

  private update<T>(work: (account: AdminAccountRow) => Promise<T> | T) {
    return this.lock.run("account", async () => {
      this.requireRepo();
      return work(this.base());
    });
  }

  /** Current password again before anything sensitive; limited separately from sign-in. */
  private async reauthenticate(
    request: FastifyRequest,
    password: string,
    account: AdminAccountRow
  ) {
    const key = `reauth:${request.ip}`;
    this.consumeAttempt(null, key, "Too many attempts. Try again later.");
    if (!(await verifyPassword(password, account.passwordHash))) throw wrongPassword();
    this.limiter.reset(key);
  }

  /** Ends every other session and replaces this one, after a credential change. */
  private async rotateSessions(request: FastifyRequest, reply: FastifyReply) {
    const repo = this.requireRepo();
    const old = verifySessionToken(
      request.cookies[this.config.cookieName],
      this.config.sessionSecret
    );
    if (old) this.revocations.revoke(old);
    const at = new Date(this.now());
    const expires = Math.floor(at.getTime() / 1000) + this.config.sessionTtlSeconds;
    for (const session of await repo.listSessions(at))
      this.revocations.revokeId(session.id, expires);
    await repo.revokeSessionsExcept(null, at);
    await this.issueSession(request, reply);
  }

  async status(request: FastifyRequest): Promise<AdminAccountStatus> {
    const account = this.account;
    const now = new Date(this.now());
    const current = this.sessionOf(request);
    const sessions = this.repo ? await this.repo.listSessions(now) : [];
    const retiring = this.retiringPath;
    return {
      username: this.username,
      managedBy: account ? "database" : "environment",
      editable: this.repo !== null,
      passwordChangedAt: account?.passwordChangedAt?.toISOString() ?? null,
      totp: {
        enabled: Boolean(account?.totpEnabledAt),
        enabledAt: account?.totpEnabledAt?.toISOString() ?? null,
        recoveryCodesLeft: account?.recoveryCodes.length ?? 0
      },
      protections: {
        maxLoginAttempts: LOGIN_MAX_ATTEMPTS,
        loginWindowMinutes: LOGIN_WINDOW_MINUTES,
        sessionTtlHours: Math.round(this.config.sessionTtlSeconds / 3600),
        trustProxy: Boolean((request.server.initialConfig as { trustProxy?: unknown }).trustProxy),
        allowedIps: this.config.allowedIps.size
      },
      sessions: sessions
        .filter(
          (s) =>
            !s.revokedAt && s.createdAt.getTime() / 1000 >= (account?.sessionsNotBefore ?? 0) - 1
        )
        .map((s) => ({
          id: s.id,
          current: s.id === current?.jti,
          createdAt: s.createdAt.toISOString(),
          lastSeenAt: s.lastSeenAt.toISOString(),
          expiresAt: s.expiresAt.toISOString(),
          ip: s.ip,
          userAgent: s.userAgent
        })),
      path: {
        current: this.path,
        pending: this.pendingPath,
        retiring: retiring
          ? { path: retiring, until: account!.adminPathRetireUntil!.toISOString() }
          : null
      }
    };
  }

  changePassword(
    request: FastifyRequest,
    reply: FastifyReply,
    currentPassword: string,
    newPassword: string
  ) {
    return this.update(async (account) => {
      await this.reauthenticate(request, currentPassword, account);
      if (await verifyPassword(newPassword, account.passwordHash))
        throw new HttpError(
          400,
          "SAME_PASSWORD",
          "Choose a password different from the current one"
        );
      const at = new Date(this.now());
      await this.persist({
        ...account,
        passwordHash: await hashPassword(newPassword),
        passwordChangedAt: at,
        sessionsNotBefore: Math.floor(at.getTime() / 1000)
      });
      await this.rotateSessions(request, reply);
    });
  }

  changeUsername(
    request: FastifyRequest,
    reply: FastifyReply,
    currentPassword: string,
    username: string
  ) {
    return this.update(async (account) => {
      await this.reauthenticate(request, currentPassword, account);
      await this.persist({ ...account, username });
      // Sessions are signed for the old name; this one is replaced so it carries on.
      await this.rotateSessions(request, reply);
    });
  }

  async revokeSession(request: FastifyRequest, id: string) {
    const repo = this.requireRepo();
    if (id === this.sessionOf(request)?.jti)
      throw new HttpError(400, "CURRENT_SESSION", "Use sign out to end this session");
    const expires = Math.floor(this.now() / 1000) + this.config.sessionTtlSeconds;
    if (!(await repo.revokeSession(id, new Date(this.now())))) throw notFound("Session not found");
    this.revocations.revokeId(id, expires);
  }

  async revokeOtherSessions(request: FastifyRequest) {
    const repo = this.requireRepo();
    const current = this.sessionOf(request);
    const at = new Date(this.now());
    const expires = Math.floor(at.getTime() / 1000) + this.config.sessionTtlSeconds;
    for (const session of await repo.listSessions(at))
      if (session.id !== current?.jti) this.revocations.revokeId(session.id, expires);
    await repo.revokeSessionsExcept(current?.jti ?? null, at);
  }

  beginTotp(request: FastifyRequest, currentPassword: string) {
    return this.update(async (account) => {
      await this.reauthenticate(request, currentPassword, account);
      if (account.totpEnabledAt)
        throw new HttpError(409, "TOTP_ENABLED", "Two-step sign-in is already on");
      const secret = newTotpSecret();
      await this.persist({
        ...account,
        totpPendingSecret: this.box.seal(secret),
        totpPendingAt: new Date(this.now())
      });
      return { secret, otpauthUri: totpUri(secret, account.username, ISSUER) };
    });
  }

  /** Two-step sign-in only starts once a code proves the authenticator was set up correctly. */
  confirmTotp(code: string) {
    return this.update(async (account) => {
      const secret =
        account.totpPendingAt &&
        this.now() - account.totpPendingAt.getTime() < TOTP_SETUP_MS &&
        this.box.open(account.totpPendingSecret ?? "");
      if (!secret) throw new HttpError(409, "TOTP_SETUP_EXPIRED", "Setup expired; start again");
      const step = matchTotp(secret, code, this.now(), null);
      if (step === null) throw new HttpError(400, "INVALID_TOTP", "That code is not valid");
      const recoveryCodes = newRecoveryCodes();
      await this.persist({
        ...account,
        totpSecret: this.box.seal(secret),
        totpPendingSecret: null,
        totpPendingAt: null,
        totpEnabledAt: new Date(this.now()),
        totpLastStep: step,
        recoveryCodes: recoveryCodes.map((c) => this.recoveryHash(c))
      });
      return recoveryCodes;
    });
  }

  private async assertSecondFactor(account: AdminAccountRow, second: AdminLoginSecondFactor) {
    const secret = this.box.open(account.totpSecret ?? "");
    const step =
      second.totp && secret
        ? matchTotp(secret, second.totp, this.now(), account.totpLastStep)
        : null;
    const recovery = second.recoveryCode
      ? this.matchRecovery(account, second.recoveryCode)
      : undefined;
    if (step === null && !recovery)
      throw new HttpError(400, "INVALID_TOTP", "That code is not valid");
    return { step };
  }

  disableTotp(request: FastifyRequest, currentPassword: string, second: AdminLoginSecondFactor) {
    return this.update(async (account) => {
      await this.reauthenticate(request, currentPassword, account);
      if (!account.totpEnabledAt) return;
      await this.assertSecondFactor(account, second);
      await this.persist({
        ...account,
        totpSecret: null,
        totpEnabledAt: null,
        totpLastStep: null,
        recoveryCodes: []
      });
    });
  }

  regenerateRecoveryCodes(request: FastifyRequest, currentPassword: string, totp: string) {
    return this.update(async (account) => {
      await this.reauthenticate(request, currentPassword, account);
      if (!account.totpEnabledAt)
        throw new HttpError(409, "TOTP_DISABLED", "Two-step sign-in is off");
      const { step } = await this.assertSecondFactor(account, { totp });
      const recoveryCodes = newRecoveryCodes();
      await this.persist({
        ...account,
        totpLastStep: step,
        recoveryCodes: recoveryCodes.map((c) => this.recoveryHash(c))
      });
      return recoveryCodes;
    });
  }

  /** Tries a new address: it is served alongside the current one until confirmed or cancelled. */
  beginPathSwitch(request: FastifyRequest, currentPassword: string, input: string) {
    return this.update(async (account) => {
      await this.reauthenticate(request, currentPassword, account);
      let path: string;
      try {
        path = normalizeAdminPath(input);
      } catch (error) {
        throw new HttpError(400, "INVALID_PATH", (error as Error).message);
      }
      const lower = path.toLowerCase();
      if (SITE_PAGES.some((page) => lower === page || lower.startsWith(`${page}/`)))
        throw new HttpError(400, "PATH_RESERVED", "That address is used by the public site");
      if (isAdminPagePath(path, this.path) || isAdminPagePath(this.path, path))
        throw new HttpError(400, "PATH_OVERLAP", "Choose an address separate from the current one");
      await this.persist({ ...account, adminPathPending: path });
      return path;
    });
  }

  /**
   * Makes the new address the only one. The page says where it was served from (`from`, written into
   * it by the server): it must be the new address, so a working page there comes before retiring the
   * old one.
   */
  confirmPathSwitch(from: string) {
    return this.update(async (account) => {
      const pending = account.adminPathPending;
      if (!pending) throw new HttpError(409, "NO_PENDING_PATH", "No address switch is in progress");
      if (!isAdminPagePath(from, pending))
        throw new HttpError(409, "OPEN_NEW_ADDRESS", "Confirm from the new address");
      await this.persist({
        ...account,
        adminPath: pending,
        adminPathPending: null,
        adminPathRetiring: this.path,
        adminPathRetireUntil: new Date(this.now() + PATH_RETIRE_MS)
      });
      return pending;
    });
  }

  cancelPathSwitch() {
    return this.update(async (account) => {
      await this.persist({ ...account, adminPathPending: null });
    });
  }
}
