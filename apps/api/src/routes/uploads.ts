import type { FastifyInstance } from "fastify";

import { notFound } from "../lib/errors";
import type { LocalImageStore } from "../storage/local";

/**
 * Serves generated image sizes from UPLOAD_DIR. Only `<n>.webp` files under `photos/<id>/` are reachable;
 * originals and anything else are 404. A URL's content never changes, so it can be cached forever.
 */
export function registerUploadRoutes(app: FastifyInstance, store: LocalImageStore) {
  app.get("/uploads/photos/:id/:file", async (request, reply) => {
    const { id, file } = request.params as { id: string; file: string };
    const data = await store.readPublic(`photos/${id}`, file);
    if (!data) throw notFound();
    reply.header("content-type", "image/webp");
    reply.header("cache-control", "public, max-age=31536000, immutable");
    return reply.send(data);
  });
}
