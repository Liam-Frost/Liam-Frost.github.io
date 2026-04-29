import type { FastifyReply, FastifyRequest } from "fastify";

import { getAdminAuthConfig } from "./config";
import { verifySessionToken } from "./session";

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const config = getAdminAuthConfig();

  if (!config.configured) {
    reply.code(503).send({ message: "Admin authentication is not configured" });
    return null;
  }

  const session = verifySessionToken(request.cookies[config.cookieName], config.sessionSecret);
  if (!session || session.sub !== config.username) {
    reply.code(401).send({ message: "Authentication required" });
    return null;
  }

  return { username: session.sub };
}
