import type { FastifyInstance } from "fastify";
import type { AdminAuthService } from "../auth/service";
import { parseInput } from "../lib/validation";
import {
  IntegrationSettings,
  integrationProviderSchema,
  integrationUpdateSchema
} from "../settings/integrations";

export function registerIntegrationRoutes(
  app: FastifyInstance,
  auth: AdminAuthService,
  settings: IntegrationSettings
) {
  const admin = { preHandler: auth.requireAdmin };
  app.get("/api/admin/integrations", admin, async (_request, reply) => {
    reply.header("cache-control", "no-store");
    return settings.status();
  });
  app.put<{ Params: { provider: string } }>(
    "/api/admin/integrations/:provider",
    admin,
    async (request, reply) => {
      reply.header("cache-control", "no-store");
      const provider = parseInput(integrationProviderSchema, request.params.provider);
      return settings.update(provider, parseInput(integrationUpdateSchema, request.body));
    }
  );
}
