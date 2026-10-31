import "dotenv/config";

import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { fileURLToPath, pathToFileURL } from "node:url";

import { AdminAuthService } from "./auth/service";
import { ConfigError, loadConfig, type AppConfig } from "./config/env";
import { getPrismaClient, hasDatabaseUrl } from "./db/client";
import { HttpError, notFound } from "./lib/errors";
import { registerAdminRoutes } from "./routes/admin";
import { registerAdminApp } from "./routes/admin-app";
import { registerAdminPhotoRoutes } from "./routes/admin-photos";
import { registerPhotoRoutes } from "./routes/photos";
import { registerSpotifyRoutes } from "./routes/spotify";
import { registerUploadRoutes } from "./routes/uploads";
import { PrismaPhotoRepository } from "./photos/prisma-repository";
import type { PhotoRepository } from "./photos/types";
import { LocalImageStore } from "./storage/local";

/** apps/admin/dist relative to this file (apps/api/src). */
const DEFAULT_ADMIN_DIST_DIR = fileURLToPath(new URL("../../admin/dist", import.meta.url));
/** apps/api/uploads, used when UPLOAD_DIR is not set. */
const DEFAULT_UPLOAD_DIR = fileURLToPath(new URL("../uploads", import.meta.url));

/** The Prisma-backed photo store when DATABASE_URL is set, otherwise none (public routes use seed data). */
function defaultPhotoRepository(): PhotoRepository | null {
  const client = getPrismaClient();
  return client ? new PrismaPhotoRepository(client) : null;
}

export type BuildServerOptions = {
  config?: AppConfig;
  logger?: boolean;
  /** Where the admin app build lives; defaults to apps/admin/dist. */
  adminDistDir?: string;
  /** Photo storage; defaults to Prisma when DATABASE_URL is set. Pass null for none. */
  photos?: PhotoRepository | null;
};

export function buildServer({
  config = loadConfig(),
  logger = true,
  adminDistDir = DEFAULT_ADMIN_DIST_DIR,
  photos = defaultPhotoRepository()
}: BuildServerOptions = {}) {
  const app = Fastify({
    logger: logger && {
      // Never log credentials or session cookies.
      redact: ["req.headers.authorization", "req.headers.cookie", 'res.headers["set-cookie"]']
    },
    trustProxy: config.trustProxy,
    bodyLimit: 1024 * 1024
  });

  const auth = new AdminAuthService(config.admin);
  const store = new LocalImageStore(config.uploads.dir ?? DEFAULT_UPLOAD_DIR);

  app.register(cors, { credentials: true, origin: config.corsOrigins });
  app.register(cookie);
  app.register(multipart, { limits: { fileSize: config.uploads.maxBytes, files: 1, fields: 0, parts: 1 } });

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
    storage: "local"
  }));

  registerAdminRoutes(app, auth);
  registerAdminApp(app, auth, adminDistDir);
  registerAdminPhotoRoutes(app, auth, photos, store, config.uploads.maxBytes);
  registerPhotoRoutes(app, photos, store);
  registerUploadRoutes(app, store);
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
