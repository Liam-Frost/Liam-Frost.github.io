import type { AdminProjectResponse, AdminProjectsResponse } from "@liam-frost/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomBytes, randomUUID } from "node:crypto";

import type { AdminAuthService } from "../auth/service";
import { badRequest, HttpError, notFound } from "../lib/errors";
import { KeyedLock } from "../lib/keyed-lock";
import {
  parseInput,
  projectCreateSchema,
  projectIdSchema,
  projectImageParamsSchema,
  projectImageSlotSchema,
  projectOrderSchema,
  projectUpdateSchema
} from "../lib/validation";
import { saveImage } from "../photos/images";
import { toAdminProject } from "../projects/mapping";
import { SlugTakenError, type ProjectPatch, type ProjectRepository, type ProjectRow, type StoredImage } from "../projects/types";
import type { LocalImageStore } from "../storage/local";
import { readUploadedImage } from "./read-upload";

const MAX_GALLERY = 30;

function slugTaken(slug: string) {
  return new HttpError(409, "SLUG_TAKEN", `Another project already uses the slug "${slug}"`);
}

export function registerAdminProjectRoutes(
  app: FastifyInstance,
  auth: AdminAuthService,
  projects: ProjectRepository | null,
  store: LocalImageStore,
  maxUploadBytes: number
) {
  const repo = () => {
    if (!projects) {
      throw new HttpError(503, "DATABASE_NOT_CONFIGURED", "Project management needs a database (set DATABASE_URL)");
    }
    return projects;
  };
  const admin = { preHandler: auth.requireAdmin };
  const respond = (row: ProjectRow): AdminProjectResponse => ({ project: toAdminProject(row, store) });

  const projectId = (request: FastifyRequest) => parseInput(projectIdSchema, request.params).id;

  const get = async (id: string) => {
    const row = await repo().get(id);
    if (!row) throw notFound("Project not found");
    return row;
  };

  const load = (request: FastifyRequest) => get(projectId(request));

  // Every change that rewrites a project from a snapshot of it runs under that project's lock,
  // so concurrent uploads, deletions and reorders cannot overwrite each other.
  const lock = new KeyedLock();

  const save = async (id: string, patch: ProjectPatch) => {
    try {
      const row = await repo().update(id, patch);
      if (!row) throw notFound("Project not found");
      return row;
    } catch (error) {
      if (error instanceof SlugTakenError) throw slugTaken(patch.slug ?? "");
      throw error;
    }
  };

  app.get("/api/admin/projects", admin, async (): Promise<AdminProjectsResponse> => {
    const rows = await repo().list({ includePrivate: true });
    return { projects: rows.map((row) => toAdminProject(row, store)) };
  });

  /** New projects start hidden with only a title and slug. */
  app.post("/api/admin/projects", admin, async (request, reply): Promise<AdminProjectResponse> => {
    const { title, slug } = parseInput(projectCreateSchema, request.body);
    try {
      const row = await repo().create({ id: randomUUID(), slug, title });
      reply.code(201);
      return respond(row);
    } catch (error) {
      if (error instanceof SlugTakenError) throw slugTaken(slug);
      throw error;
    }
  });

  app.get("/api/admin/projects/:id", admin, async (request) => respond(await load(request)));

  app.patch("/api/admin/projects/:id", admin, async (request): Promise<AdminProjectResponse> => {
    const id = projectId(request);
    const { gallery: galleryOrder, ...patch } = parseInput(projectUpdateSchema, request.body);
    return lock.run(id, async () => {
      const row = await get(id);
      const startedAt = patch.startedAt !== undefined ? patch.startedAt : row.startedAt;
      const endedAt = patch.endedAt !== undefined ? patch.endedAt : row.endedAt;
      if (startedAt && endedAt && endedAt < startedAt) throw badRequest("The end month is before the start month", "VALIDATION");

      let gallery: StoredImage[] | undefined;
      if (galleryOrder) {
        // A new order of the existing screenshots; adding and removing go through the image routes.
        const byId = new Map(row.gallery.map((image) => [image.id, image]));
        if (galleryOrder.length !== byId.size || galleryOrder.some((imageId) => !byId.has(imageId))) {
          throw new HttpError(409, "GALLERY_OUT_OF_DATE", "The screenshots changed; reload and try again");
        }
        gallery = galleryOrder.map((imageId) => byId.get(imageId)!);
      }

      return respond(await save(row.id, { ...patch, ...(gallery ? { gallery } : {}) }));
    });
  });

  app.delete("/api/admin/projects/:id", admin, async (request, reply) => {
    const id = projectId(request);
    const row = await lock.run(id, async () => {
      const current = await get(id);
      await repo().delete(id);
      return current;
    });
    await store.remove(`projects/${row.id}`).catch((error) => request.log.warn({ error, projectId: row.id }, "Failed to remove project files"));
    request.log.info({ projectId: row.id, by: request.adminUser?.username }, "Project deleted");
    return reply.code(204).send();
  });

  /** Upload the cover (replacing the previous one) or add a screenshot: POST ...?slot=cover|gallery */
  app.post("/api/admin/projects/:id/images", admin, async (request, reply): Promise<AdminProjectResponse> => {
    const { slot } = parseInput(projectImageSlotSchema, request.query);
    const preflight = await load(request);
    if (slot === "gallery" && preflight.gallery.length >= MAX_GALLERY) throw badRequest(`At most ${MAX_GALLERY} screenshots`);

    // Receiving and processing the image happens outside the lock; only the project update is serialized.
    const { image, bytes } = await readUploadedImage(request, maxUploadBytes);
    const imageId = randomBytes(6).toString("hex");
    const key = `projects/${preflight.id}/${imageId}`;
    const stored: StoredImage = {
      id: imageId,
      key,
      width: image.width,
      height: image.height,
      variants: image.variants.map(({ width, height }) => ({ width, height }))
    };

    let result: { updated: ProjectRow; oldCover: StoredImage | null };
    try {
      await saveImage(store, key, image);
      result = await lock.run(preflight.id, async () => {
        const row = await get(preflight.id);
        if (slot === "gallery" && row.gallery.length >= MAX_GALLERY) throw badRequest(`At most ${MAX_GALLERY} screenshots`);
        const updated = await save(row.id, slot === "cover" ? { cover: stored } : { gallery: [...row.gallery, stored] });
        return { updated, oldCover: slot === "cover" ? row.cover : null };
      });
    } catch (error) {
      await store.remove(key).catch(() => undefined);
      throw error;
    }

    const { updated, oldCover } = result;
    if (oldCover) {
      await store.remove(oldCover.key).catch((error) => request.log.warn({ error, projectId: preflight.id }, "Failed to remove old cover"));
    }
    request.log.info({ projectId: preflight.id, slot, bytes, by: request.adminUser?.username }, "Project image uploaded");
    reply.code(201);
    return respond(updated);
  });

  app.delete("/api/admin/projects/:id/images/:imageId", admin, async (request): Promise<AdminProjectResponse> => {
    const { id, imageId } = parseInput(projectImageParamsSchema, request.params);

    const { updated, removed } = await lock.run(id, async () => {
      const row = await get(id);
      let patch: ProjectPatch;
      let removed: StoredImage | undefined;
      if (row.cover?.id === imageId) {
        removed = row.cover;
        patch = { cover: null };
      } else {
        removed = row.gallery.find((image) => image.id === imageId);
        patch = { gallery: row.gallery.filter((image) => image.id !== imageId) };
      }
      if (!removed) throw notFound("Image not found");
      return { updated: await save(row.id, patch), removed };
    });

    await store.remove(removed.key).catch((error) => request.log.warn({ error, projectId: id }, "Failed to remove image files"));
    return respond(updated);
  });

  /** Replaces the order of all projects, first to last. The list must contain every project exactly once. */
  app.put("/api/admin/projects/order", admin, async (request): Promise<AdminProjectsResponse> => {
    const { ids } = parseInput(projectOrderSchema, request.body);
    const projects = repo();
    const known = new Set((await projects.list({ includePrivate: true })).map((row) => row.id));
    if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
      throw new HttpError(409, "ORDER_OUT_OF_DATE", "The project list changed; reload and try again");
    }
    await projects.reorder(ids);
    const rows = await projects.list({ includePrivate: true });
    return { projects: rows.map((row) => toAdminProject(row, store)) };
  });
}
