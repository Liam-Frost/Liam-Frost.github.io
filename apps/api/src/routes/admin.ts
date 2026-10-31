import type { FastifyInstance } from "fastify";

import { getAdminAuthConfig } from "../auth/config";
import { consumeLoginAttempt, resetLoginAttempts } from "../auth/login-rate-limit";
import { verifyPassword } from "../auth/password";
import { requireAdmin } from "../auth/require-admin";
import { isSessionRevoked, revokeSession } from "../auth/revocation";
import { createSessionToken, verifySessionToken } from "../auth/session";

type LoginBody = {
  username?: unknown;
  password?: unknown;
};

function adminUser(username: string) {
  return { username };
}

export function registerAdminRoutes(app: FastifyInstance) {
  app.get("/api/admin/session", async (request) => {
    const config = getAdminAuthConfig();
    if (!config.configured) {
      return { authenticated: false, configured: false };
    }

    const session = verifySessionToken(request.cookies[config.cookieName], config.sessionSecret);
    const authenticated = Boolean(session && session.sub === config.username && !isSessionRevoked(session));

    return {
      authenticated,
      configured: true,
      user: authenticated ? adminUser(config.username) : null
    };
  });

  app.post<{ Body: LoginBody }>(
    "/api/admin/login",
    async (request, reply) => {
      const config = getAdminAuthConfig();
      if (!config.configured) {
        return reply.code(503).send({ message: "Admin authentication is not configured" });
      }

      const { username, password } = request.body ?? {};
      if (typeof username !== "string" || typeof password !== "string") {
        return reply.code(400).send({ message: "Username and password are required" });
      }

      const rateLimit = consumeLoginAttempt(request.ip);
      if (!rateLimit.allowed) {
        reply.header("Retry-After", String(rateLimit.retryAfterSeconds));
        return reply.code(429).send({ message: "Too many login attempts. Try again later." });
      }

      const usernameMatches = username === config.username;
      const passwordMatches = await verifyPassword(password, config.passwordHash);

      if (!usernameMatches || !passwordMatches) {
        return reply.code(401).send({ message: "Invalid username or password" });
      }

      resetLoginAttempts(request.ip);

      const token = createSessionToken(config.username, config.sessionSecret, config.sessionTtlSeconds);
      reply.setCookie(config.cookieName, token, {
        httpOnly: true,
        maxAge: config.sessionTtlSeconds,
        path: "/",
        sameSite: "lax",
        secure: config.cookieSecure
      });

      return {
        authenticated: true,
        configured: true,
        user: adminUser(config.username)
      };
    }
  );

  app.get("/api/admin/me", { preHandler: requireAdmin }, async (request) => ({
    user: request.adminUser
  }));

  app.post("/api/admin/logout", async (request, reply) => {
    const config = getAdminAuthConfig();
    const session = verifySessionToken(request.cookies[config.cookieName], config.sessionSecret);

    if (session) {
      revokeSession(session);
    }

    reply.clearCookie(config.cookieName, { path: "/" });
    return { authenticated: false };
  });
}
