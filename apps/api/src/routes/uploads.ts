import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { AdminAuthService } from "../auth/service";
import { notFound } from "../lib/errors";
import { photoIdSchema, projectImageParamsSchema } from "../lib/validation";
import type { PhotoRepository } from "../photos/types";
import type { ProjectRepository } from "../projects/types";
import type { LocalImageStore } from "../storage/local";

/**
 * Serves generated image sizes from UPLOAD_DIR. Only `<n>.webp` files of an existing photo or project image
 * are reachable; originals and anything else are 404. Images of hidden photos and projects are only served
 * to a signed-in admin, so drafts cannot be found by guessing URLs. A public URL's content never changes,
 * so it caches forever. Without the database visibility cannot be checked, so nothing is served.
 */
export function registerUploadRoutes(
  app: FastifyInstance,
  store: LocalImageStore,
  repos: { photos: PhotoRepository | null; projects: ProjectRepository | null },
  auth: AdminAuthService
) {
  const send = async (request: FastifyRequest, reply: FastifyReply, key: string, isPublic: boolean) => {
    if (!isPublic && !auth.identify(request)) throw notFound();
    const data = await store.readPublic(key, (request.params as { file: string }).file);
    if (!data) throw notFound();
    reply.header("content-type", "image/webp");
    reply.header("cache-control", isPublic ? "public, max-age=31536000, immutable" : "private, no-store");
    return reply.send(data);
  };

  app.get("/uploads/photos/:id/:file", async (request, reply) => {
    const parsed = photoIdSchema.safeParse(request.params);
    if (!parsed.success || !repos.photos) throw notFound();
    const { id } = parsed.data;

    const row = await repos.photos.get(id).catch(() => null);
    if (!row || row.storage !== "local" || row.storageKey !== `photos/${id}`) throw notFound();
    return send(request, reply, row.storageKey, row.visibility === "public");
  });

  app.get("/uploads/projects/:id/:imageId/:file", async (request, reply) => {
    const parsed = projectImageParamsSchema.safeParse(request.params);
    if (!parsed.success || !repos.projects) throw notFound();
    const { id, imageId } = parsed.data;

    const row = await repos.projects.get(id).catch(() => null);
    const image = row && [row.cover, ...row.gallery].find((candidate) => candidate?.id === imageId);
    if (!row || !image) throw notFound();
    return send(request, reply, image.key, row.visibility === "public");
  });
}
