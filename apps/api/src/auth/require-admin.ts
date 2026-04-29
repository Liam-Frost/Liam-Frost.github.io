import type { FastifyReply, FastifyRequest } from "fastify";

import { getAdminAuthConfig } from "./config";
import { isSessionRevoked } from "./revocation";
import { verifySessionToken } from "./session";

declare module "fastify" {
  interface FastifyRequest {
    adminUser?: { username: string };
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const config = getAdminAuthConfig();

  if (!config.configured) {
    return reply.code(503).send({ message: "Admin authentication is not configured" });
  }

  const session = verifySessionToken(request.cookies[config.cookieName], config.sessionSecret);
  if (!session || session.sub !== config.username || isSessionRevoked(session)) {
    return reply.code(401).send({ message: "Authentication required" });
  }

  request.adminUser = { username: session.sub };
}
