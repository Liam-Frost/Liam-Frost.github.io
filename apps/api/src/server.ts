import "dotenv/config";

import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { pathToFileURL } from "node:url";

import { AdminAuthService } from "./auth/service";
import { ConfigError, loadConfig, type AppConfig } from "./config/env";
import { hasDatabaseUrl } from "./db/client";
import { HttpError, notFound } from "./lib/errors";
import { registerAdminRoutes } from "./routes/admin";
import { registerPhotoRoutes } from "./routes/photos";
import { registerSpotifyRoutes } from "./routes/spotify";
import { readStorageConfig } from "./storage/config";

export type BuildServerOptions = {
  config?: AppConfig;
  logger?: boolean;
};

export function buildServer({ config = loadConfig(), logger = true }: BuildServerOptions = {}) {
  const app = Fastify({
    logger: logger && {
      // Never log credentials or session cookies.
      redact: ["req.headers.authorization", "req.headers.cookie", 'res.headers["set-cookie"]']
    },
    trustProxy: config.trustProxy,
    bodyLimit: 1024 * 1024
  });

  const auth = new AdminAuthService(config.admin);

  app.register(cors, { credentials: true, origin: config.corsOrigins });
  app.register(cookie);

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "strict-origin-when-cross-origin");
    reply.header("x-frame-options", "DENY");
    return payload;
  });

  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send(error.toBody());
    }

    const err: Error & { statusCode?: number } = error instanceof Error ? error : new Error(String(error));
    const status = typeof err.statusCode === "number" ? err.statusCode : 500;
    if (status < 500) {
      // Fastify's own client errors (bad JSON, body too large, unsupported media type).
      return reply.code(status).send(new HttpError(status, "REQUEST_ERROR", err.message).toBody());
    }

    request.log.error({ err }, "Request failed");
    return reply.code(500).send(new HttpError(500, "INTERNAL", "Internal server error").toBody());
  });

  app.setNotFoundHandler(async (_request, reply) => reply.code(404).send(notFound().toBody()));

  app.get("/api/health", async () => ({
    ok: true,
    service: "liam-frost-api",
    database: hasDatabaseUrl() ? "configured" : "seed",
    storage: readStorageConfig().driver
  }));

  registerAdminRoutes(app, auth);
  registerPhotoRoutes(app);
  registerSpotifyRoutes(app);

  return app;
}

export async function startServer() {
  let config: AppConfig;
  try {
    config = loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  const app = buildServer({ config });
  if (!config.admin.configured) {
    app.log.warn("Admin authentication is not configured; set ADMIN_PASSWORD_HASH and ADMIN_SESSION_SECRET");
  }

  try {
    await app.listen({ host: config.host, port: config.port });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

const entryPoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";

if (import.meta.url === entryPoint) {
  await startServer();
}
