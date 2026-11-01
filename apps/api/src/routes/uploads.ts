import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { AdminAuthService } from "../auth/service";
import { notFound } from "../lib/errors";
import { photoIdSchema, projectImageParamsSchema } from "../lib/validation";
import type { CollectionSettingsStore } from "../media/collection-settings";
import { isMediaPublic, type MediaRepository } from "../media/types";
import type { PersonRepository } from "../people/types";
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
  repos: {
    photos: PhotoRepository | null;
    projects: ProjectRepository | null;
    media: MediaRepository | null;
    people: PersonRepository | null;
    collection: CollectionSettingsStore | null;
  },
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

    const row = await repos.projects.imageAccess(id).catch(() => null);
    const image = row && [row.cover, ...row.gallery].find((candidate) => candidate?.id === imageId);
    if (!row || !image) throw notFound();
    return send(request, reply, image.key, row.visibility === "public");
  });

  // Collection posters follow the site's rules: the entry's visibility, its kind's switch and the "want" switch.
  app.get("/uploads/media/:id/:imageId/:file", async (request, reply) => {
    const parsed = projectImageParamsSchema.safeParse(request.params);
    if (!parsed.success || !repos.media || !repos.collection) throw notFound();
    const { id, imageId } = parsed.data;

    const row = await repos.media.imageAccess(id).catch(() => null);
    if (!row?.poster || row.poster.id !== imageId) throw notFound();
    const settings = await repos.collection.get().catch(() => null);
    return send(request, reply, row.poster.key, settings !== null && isMediaPublic(row, settings));
  });

  // People's photos are public when the person is public and the site shows people.
  app.get("/uploads/people/:id/:imageId/:file", async (request, reply) => {
    const parsed = projectImageParamsSchema.safeParse(request.params);
    if (!parsed.success || !repos.people || !repos.collection) throw notFound();
    const { id, imageId } = parsed.data;

    const row = await repos.people.get(id).catch(() => null);
    if (!row?.photo || row.photo.id !== imageId) throw notFound();
    const settings = await repos.collection.get().catch(() => null);
    return send(request, reply, row.photo.key, row.visibility === "public" && settings?.show.people === true);
  });
}
