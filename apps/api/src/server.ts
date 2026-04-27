import cors from "@fastify/cors";
import Fastify from "fastify";

import { registerPhotoRoutes } from "./routes/photos";
import { registerSpotifyRoutes } from "./routes/spotify";
import { readStorageConfig } from "./storage/config";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";

export function buildServer() {
  const app = Fastify({ logger: true });
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
    : true;

  app.register(cors, { origin: corsOrigin });

  app.get("/api/health", async () => ({
    ok: true,
    service: "liam-frost-api",
    storage: readStorageConfig().driver
  }));

  registerPhotoRoutes(app);
  registerSpotifyRoutes(app);

  return app;
}

const app = buildServer();

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
