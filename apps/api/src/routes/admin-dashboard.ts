import type { AdminDashboard } from "@liam-frost/shared";
import type { FastifyInstance } from "fastify";

import type { AdminAuthService } from "../auth/service";
import type { DashboardService } from "../dashboard/service";

/** The admin's 概览, in one request; each part reports its own error. */
export function registerAdminDashboardRoutes(
  app: FastifyInstance,
  auth: AdminAuthService,
  dashboard: DashboardService
) {
  app.get(
    "/api/admin/dashboard",
    { preHandler: auth.requireAdmin },
    async (_request, reply): Promise<AdminDashboard> => {
      reply.header("cache-control", "no-store");
      return dashboard.load();
    }
  );
}
