import { ADMIN_REQUEST_HEADER, type AdminUser } from "@liam-frost/shared";
import type { FastifyReply, FastifyRequest } from "fastify";

import type { AdminConfig } from "../config/env";
import { HttpError, notFound } from "../lib/errors";
import { LoginRateLimiter } from "./login-rate-limit";
import { verifyPassword } from "./password";
import { SessionRevocations } from "./revocation";
import { createSessionToken, verifySessionToken } from "./session";

declare module "fastify" {
  interface FastifyRequest {
    adminUser?: AdminUser;
  }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Admin authentication state for one server instance. */
export class AdminAuthService {
  readonly limiter = new LoginRateLimiter();
  private readonly revocations = new SessionRevocations();

  constructor(readonly config: AdminConfig) {}

  get configured() {
    return this.config.configured;
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

  /** The signed-in admin for this request, or null. */
  identify(request: FastifyRequest): AdminUser | null {
    if (!this.configured) return null;

    const session = verifySessionToken(
      request.cookies[this.config.cookieName],
      this.config.sessionSecret
    );
    if (!session || session.sub !== this.config.username || this.revocations.isRevoked(session)) {
      return null;
    }
    return { username: session.sub };
  }

  /** Callers check assertConfigured() first. */
  async login(
    request: FastifyRequest,
    reply: FastifyReply,
    username: string,
    password: string
  ): Promise<AdminUser> {
    const rateLimit = this.limiter.consume(request.ip);
    if (!rateLimit.allowed) {
      reply.header("Retry-After", String(rateLimit.retryAfterSeconds));
      throw new HttpError(429, "TOO_MANY_ATTEMPTS", "Too many login attempts. Try again later.");
    }

    // Always run scrypt so a wrong username takes as long as a wrong password.
    const passwordMatches = await verifyPassword(password, this.config.passwordHash);
    if (username !== this.config.username || !passwordMatches) {
      request.log.warn({ ip: request.ip }, "Admin login failed");
      throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid username or password");
    }

    this.limiter.reset(request.ip);
    const token = createSessionToken(
      this.config.username,
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
    request.log.info({ ip: request.ip }, "Admin logged in");
    return { username: this.config.username };
  }

  logout(request: FastifyRequest, reply: FastifyReply) {
    if (this.configured) {
      const session = verifySessionToken(
        request.cookies[this.config.cookieName],
        this.config.sessionSecret
      );
      if (session) this.revocations.revoke(session);
    }
    reply.clearCookie(this.config.cookieName, { path: "/" });
  }

  /** preHandler for routes that require a signed-in admin. */
  requireAdmin = async (request: FastifyRequest) => {
    this.assertConfigured();
    const user = this.identify(request);
    if (!user) {
      throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
    }
    request.adminUser = user;
  };
}
