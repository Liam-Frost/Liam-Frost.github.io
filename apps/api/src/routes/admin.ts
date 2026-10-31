import type { AdminSessionResponse } from "@liam-frost/shared";
import type { FastifyInstance } from "fastify";

import type { AdminAuthService } from "../auth/service";
import { loginSchema, parseInput } from "../lib/validation";

export function registerAdminRoutes(app: FastifyInstance, auth: AdminAuthService) {
  // Every /api/admin route: hidden from IPs outside ADMIN_ALLOWED_IPS, and writes need the CSRF header.
  // Runs in onRequest so the IP check happens before body parsing or any other validation.
  // Uses the matched route pattern rather than the raw URL so encoding tricks cannot skip it.
  app.addHook("onRequest", async (request) => {
    if (!request.routeOptions.url?.startsWith("/api/admin/")) return;
    auth.assertIpAllowed(request);
    auth.assertCsrfHeader(request);
  });

  app.get("/api/admin/session", async (request, reply): Promise<AdminSessionResponse> => {
    reply.header("cache-control", "no-store");
    const user = auth.identify(request);
    return {
      authenticated: Boolean(user),
      configured: auth.configured,
      user,
      // The admin path is only revealed to a signed-in admin.
      ...(user ? { adminPath: auth.config.path } : {})
    };
  });

  app.post("/api/admin/login", async (request, reply): Promise<AdminSessionResponse> => {
    auth.assertConfigured();
    const { username, password } = parseInput(loginSchema, request.body);
    const user = await auth.login(request, reply, username, password);
    return { authenticated: true, configured: true, user, adminPath: auth.config.path };
  });

  app.post("/api/admin/logout", async (request, reply) => {
    auth.logout(request, reply);
    return { authenticated: false };
  });

  app.get("/api/admin/me", { preHandler: auth.requireAdmin }, async (request) => ({
    user: request.adminUser
  }));
}
