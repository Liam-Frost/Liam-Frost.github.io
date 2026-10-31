import type { AdminPhotoResponse, AdminPhotosResponse } from "@liam-frost/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomBytes } from "node:crypto";

import type { AdminAuthService } from "../auth/service";
import { badRequest, HttpError, notFound } from "../lib/errors";
import { parseInput, photoIdSchema, photoOrderSchema, photoUpdateSchema } from "../lib/validation";
import { InvalidImageError, processImage } from "../photos/images";
import { toAdminPhoto, variantFileName } from "../photos/mapping";
import type { PhotoRepository } from "../photos/types";
import type { LocalImageStore } from "../storage/local";

/** "IMG_1234 (2).JPG" -> "img-1234-2-k3f9a1": readable, URL-safe and unique. */
export function photoIdFromFileName(fileName: string) {
  const base = fileName
    .replace(/\.[^.]*$/, "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return `${base || "photo"}-${randomBytes(3).toString("hex")}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function registerAdminPhotoRoutes(
  app: FastifyInstance,
  auth: AdminAuthService,
  photos: PhotoRepository | null,
  store: LocalImageStore,
  maxUploadBytes: number
) {
  const repo = () => {
    if (!photos) {
      throw new HttpError(503, "DATABASE_NOT_CONFIGURED", "Photo management needs a database (set DATABASE_URL)");
    }
    return photos;
  };
  const admin = { preHandler: auth.requireAdmin };
  const idParam = (request: FastifyRequest) => parseInput(photoIdSchema, request.params).id;

  app.get("/api/admin/photos", admin, async (): Promise<AdminPhotosResponse> => {
    const rows = await repo().list({ includePrivate: true });
    return { photos: rows.map((row) => toAdminPhoto(row, store)) };
  });

  app.get("/api/admin/photos/:id", admin, async (request): Promise<AdminPhotoResponse> => {
    const row = await repo().get(idParam(request));
    if (!row) throw notFound("Photo not found");
    return { photo: toAdminPhoto(row, store) };
  });

  /**
   * Upload one image. It becomes a hidden photo prefilled from EXIF, so an upload is never orphaned:
   * the admin edits it and makes it public, or deletes it (which removes the files).
   */
  app.post("/api/admin/photos", admin, async (request, reply): Promise<AdminPhotoResponse> => {
    const photos = repo();
    if (!request.isMultipart()) throw badRequest("Upload the image as multipart/form-data");
    const file = await request.file({ limits: { fileSize: maxUploadBytes, files: 1, fields: 0 } });
    if (!file) throw badRequest("Choose an image to upload");

    let input: Buffer;
    try {
      input = await file.toBuffer();
    } catch (error) {
      if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
        throw new HttpError(413, "FILE_TOO_LARGE", `Images must be at most ${Math.round(maxUploadBytes / 1024 / 1024)} MB`);
      }
      throw badRequest("The upload was interrupted; try again", "UPLOAD_INTERRUPTED");
    }

    let image;
    try {
      image = await processImage(input);
    } catch (error) {
      if (error instanceof InvalidImageError) throw badRequest(error.message, "INVALID_IMAGE");
      throw error;
    }

    const id = photoIdFromFileName(file.filename);
    const storageKey = `photos/${id}`;
    try {
      for (const variant of image.variants) {
        await store.write(storageKey, variantFileName(variant.width), variant.data);
      }
      await store.write(storageKey, `original.${image.original.extension}`, image.original.data);

      const title = file.filename.replace(/\.[^.]*$/, "").trim().slice(0, 120) || id;
      const row = await photos.create({
        id,
        slug: id,
        title: { zh: title },
        date: image.exif.date ?? today(),
        category: {},
        location: null,
        camera: image.exif.camera ?? null,
        lens: image.exif.lens ?? null,
        settings: image.exif.settings ?? null,
        description: null,
        tags: [],
        alt: {},
        width: image.width,
        height: image.height,
        src: "",
        storage: "local",
        storageKey,
        variants: image.variants.map(({ width, height }) => ({ width, height })),
        visibility: "private",
        featured: false
      });
      request.log.info({ photoId: id, bytes: input.length, by: request.adminUser?.username }, "Photo uploaded");
      reply.code(201);
      return { photo: toAdminPhoto(row, store) };
    } catch (error) {
      // Leave no files behind when a file write or the database insert fails.
      await store.remove(storageKey).catch(() => undefined);
      throw error;
    }
  });

  app.patch("/api/admin/photos/:id", admin, async (request): Promise<AdminPhotoResponse> => {
    const id = idParam(request);
    const patch = parseInput(photoUpdateSchema, request.body);
    const row = await repo().update(id, patch);
    if (!row) throw notFound("Photo not found");
    return { photo: toAdminPhoto(row, store) };
  });

  app.delete("/api/admin/photos/:id", admin, async (request, reply) => {
    const row = await repo().delete(idParam(request));
    if (!row) throw notFound("Photo not found");
    if (row.storage === "local" && row.storageKey) {
      await store.remove(row.storageKey).catch((error) => request.log.warn({ error, photoId: row.id }, "Failed to remove photo files"));
    }
    request.log.info({ photoId: row.id, by: request.adminUser?.username }, "Photo deleted");
    return reply.code(204).send();
  });

  /** Replaces the order of all photos, first to last. The list must contain every photo exactly once. */
  app.put("/api/admin/photos/order", admin, async (request): Promise<AdminPhotosResponse> => {
    const { ids } = parseInput(photoOrderSchema, request.body);
    const photos = repo();
    const current = await photos.list({ includePrivate: true });
    const known = new Set(current.map((row) => row.id));
    if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
      throw new HttpError(409, "ORDER_OUT_OF_DATE", "The photo list changed; reload and try again");
    }
    await photos.reorder(ids);
    const rows = await photos.list({ includePrivate: true });
    return { photos: rows.map((row) => toAdminPhoto(row, store)) };
  });
}
