import type { FastifyInstance } from "fastify";

import type { AdminAuthService } from "../auth/service";
import { notFound } from "../lib/errors";
import { photoIdSchema } from "../lib/validation";
import type { PhotoRepository } from "../photos/types";
import type { LocalImageStore } from "../storage/local";

/**
 * Serves generated image sizes from UPLOAD_DIR. Only `<n>.webp` files of an existing photo are reachable;
 * originals and anything else are 404. Hidden photos' images are only served to a signed-in admin, so
 * drafts cannot be found by guessing URLs. A public URL's content never changes, so it caches forever.
 */
export function registerUploadRoutes(app: FastifyInstance, store: LocalImageStore, photos: PhotoRepository | null, auth: AdminAuthService) {
  app.get("/uploads/photos/:id/:file", async (request, reply) => {
    const { file } = request.params as { file: string };
    // Any malformed path is simply not found, like every other miss under /uploads.
    const parsed = photoIdSchema.safeParse(request.params);
    if (!parsed.success || !photos) throw notFound();
    const { id } = parsed.data;

    // Without the database the visibility cannot be checked, so nothing is served.
    const row = await photos.get(id).catch(() => null);
    if (!row || row.storage !== "local" || row.storageKey !== `photos/${id}`) throw notFound();

    const isPublic = row.visibility === "public";
    if (!isPublic && !auth.identify(request)) throw notFound();

    const data = await store.readPublic(row.storageKey, file);
    if (!data) throw notFound();
    reply.header("content-type", "image/webp");
    reply.header("cache-control", isPublic ? "public, max-age=31536000, immutable" : "private, no-store");
    return reply.send(data);
  });
}
