import type {
  AdminPhotoResponse,
  AdminPhotosResponse,
  AdminServerFolder,
  PhotoSource
} from "@liam-frost/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomBytes } from "node:crypto";
import sharp from "sharp";

import type { AdminAuthService } from "../auth/service";
import { badRequest, HttpError, notFound } from "../lib/errors";
import {
  parseInput,
  photoIdSchema,
  photoImageReplaceSchema,
  photoImportSchema,
  photoOrderSchema,
  photoUpdateSchema,
  serverFileQuerySchema
} from "../lib/validation";
import { InvalidImageError } from "../photos/images";
import { toAdminPhoto } from "../photos/mapping";
import {
  hostImage,
  PhotoSourceError,
  type PhotoImage,
  type PhotoSources
} from "../photos/photo-sources";
import type { PhotoPatch, PhotoRepository, PhotoRow } from "../photos/types";
import type { LocalImageStore } from "../storage/local";
import { readUploadedImage } from "./read-upload";

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

/** Removes a photo's site-hosted files: its image folder, or an older photo's flat folder (files only). */
async function removeImage(store: LocalImageStore, row: Pick<PhotoRow, "storage" | "storageKey">) {
  if (row.storage !== "local" || !row.storageKey) return;
  const parts = row.storageKey.split("/");
  if (parts.length === 2) {
    await store.removeFiles(row.storageKey);
    await store.removeIfEmpty(row.storageKey);
  } else {
    await store.remove(row.storageKey);
    await store.removeIfEmpty(parts.slice(0, 2).join("/"));
  }
}

/** Source failures (bad link, missing file) and unreadable images are the request's fault. */
function sourceFailure(error: unknown): never {
  if (error instanceof PhotoSourceError) throw badRequest(error.message, "PHOTO_SOURCE");
  if (error instanceof InvalidImageError) throw badRequest(error.message, "INVALID_IMAGE");
  throw error;
}

export function registerAdminPhotoRoutes(
  app: FastifyInstance,
  auth: AdminAuthService,
  photos: PhotoRepository | null,
  store: LocalImageStore,
  maxUploadBytes: number,
  sources: PhotoSources
) {
  const repo = () => {
    if (!photos) {
      throw new HttpError(
        503,
        "DATABASE_NOT_CONFIGURED",
        "Photo management needs a database (set DATABASE_URL)"
      );
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
  /**
   * Creates a hidden photo from an image, prefilled from EXIF (and the file name or Flickr title), so an
   * added image is never orphaned: the admin edits it and makes it public, or deletes it.
   */
  const createPhoto = async (
    request: FastifyRequest,
    reply: FastifyReply,
    id: string,
    image: PhotoImage
  ): Promise<AdminPhotoResponse> => {
    try {
      const row = await repo().create({
        id,
        slug: id,
        title: { zh: image.title || id },
        date: image.exif.date ?? today(),
        category: {},
        location: null,
        camera: image.exif.camera ?? null,
        lens: image.exif.lens ?? null,
        settings: image.exif.settings ?? null,
        description: null,
        tags: [],
        alt: {},
        ...image.fields,
        visibility: "private",
        featured: false
      });
      request.log.info(
        { photoId: id, source: image.fields.source?.type, by: request.adminUser?.username },
        "Photo added"
      );
      reply.code(201);
      return { photo: toAdminPhoto(row, store) };
    } catch (error) {
      // Leave no files behind when the database insert fails.
      await removeImage(store, image.fields).catch(() => undefined);
      throw error;
    }
  };

  const uploadSource = (fileName: string): PhotoSource => ({
    type: "upload",
    ref: fileName.slice(0, 200),
    importedAt: new Date().toISOString()
  });
  const fileTitle = (fileName: string) =>
    fileName
      .replace(/\.[^.]*$/, "")
      .trim()
      .slice(0, 120) || null;

  /** Uploads one image from the device. */
  app.post("/api/admin/photos", admin, async (request, reply): Promise<AdminPhotoResponse> => {
    repo();
    const { fileName, image, bytes, receiveMs } = await readUploadedImage(
      request,
      maxUploadBytes,
      store
    );
    const id = photoIdFromFileName(fileName);
    const saving = performance.now();
    const hosted = await hostImage(store, id, image, uploadSource(fileName), fileTitle(fileName));
    const saveMs = Math.round(performance.now() - saving);
    // Where an upload's time goes; decides whether sizes should be generated in the background.
    request.log.info(
      {
        photoId: id,
        bytes,
        width: image.width,
        height: image.height,
        receiveMs,
        ...image.timings,
        saveMs
      },
      "Photo upload timings"
    );
    return createPhoto(request, reply, id, hosted);
  });

  /** Adds a photo from an image link, a Flickr photo or a file in a server import folder. */
  app.post(
    "/api/admin/photos/import",
    admin,
    async (request, reply): Promise<AdminPhotoResponse> => {
      repo();
      const { from, mode } = parseInput(photoImportSchema, request.body);
      const name =
        from.type === "server"
          ? from.path.split("/").pop()!
          : new URL(from.url).pathname.split("/").pop() || "photo";
      const id = photoIdFromFileName(name);
      const image = await fetchImage(id, from, mode).catch(sourceFailure);
      return createPhoto(request, reply, id, image);
    }
  );

  const fetchImage = (
    id: string,
    from:
      | { type: "url"; url: string }
      | { type: "gallery"; url: string }
      | { type: "server"; root: number; path: string },
    mode: "import" | "reference"
  ) =>
    from.type === "server"
      ? sources.fromServer(id, from.root, from.path)
      : from.type === "gallery"
        ? sources.fromGallery(id, from.url, mode)
        : sources.fromUrl(id, from.url, mode);

  /**
   * Puts a new image on a photo, keeping its details, order and visibility; `useExif` also takes the
   * date and camera details from the new image. The old site-hosted files are removed afterwards.
   */
  const replaceImage = async (
    request: FastifyRequest,
    row: PhotoRow,
    image: PhotoImage,
    useExif: boolean
  ): Promise<AdminPhotoResponse> => {
    const patch: PhotoPatch = { ...image.fields };
    if (useExif) {
      if (image.exif.date) patch.date = image.exif.date;
      if (image.exif.camera) patch.camera = image.exif.camera;
      if (image.exif.lens) patch.lens = image.exif.lens;
      if (image.exif.settings) patch.settings = image.exif.settings;
    }
    let updated: PhotoRow | null;
    try {
      updated = await repo().update(row.id, patch);
    } catch (error) {
      await removeImage(store, image.fields).catch(() => undefined);
      throw error;
    }
    if (!updated) {
      await removeImage(store, image.fields).catch(() => undefined);
      throw notFound("Photo not found");
    }
    await removeImage(store, row).catch((error) =>
      request.log.warn({ error, photoId: row.id }, "Failed to remove the replaced image")
    );
    request.log.info(
      { photoId: row.id, source: image.fields.source?.type, by: request.adminUser?.username },
      "Photo image replaced"
    );
    return { photo: toAdminPhoto(updated, store) };
  };

  const getRow = async (request: FastifyRequest) => {
    const row = await repo().get(idParam(request));
    if (!row) throw notFound("Photo not found");
    return row;
  };

  /** Replaces a photo's image with an upload (`?exif=1` also takes its date and camera details). */
  app.post("/api/admin/photos/:id/image", admin, async (request): Promise<AdminPhotoResponse> => {
    const row = await getRow(request);
    const { fileName, image } = await readUploadedImage(request, maxUploadBytes, store);
    const hosted = await hostImage(store, row.id, image, uploadSource(fileName), null);
    const useExif = (request.query as { exif?: string }).exif === "1";
    return replaceImage(request, row, hosted, useExif);
  });

  /** Replaces a photo's image from a link, a Flickr photo or a server file. */
  app.put("/api/admin/photos/:id/image", admin, async (request): Promise<AdminPhotoResponse> => {
    const row = await getRow(request);
    const { from, mode, useExif } = parseInput(photoImageReplaceSchema, request.body);
    const image = await fetchImage(row.id, from, mode).catch(sourceFailure);
    return replaceImage(request, row, image, useExif ?? false);
  });

  /** Downloads a referenced image and hosts it on the site, keeping where it came from. */
  app.post("/api/admin/photos/:id/host", admin, async (request): Promise<AdminPhotoResponse> => {
    const row = await getRow(request);
    if (row.storage !== "remote-url" || !row.src)
      throw new HttpError(409, "ALREADY_HOSTED", "This photo is already hosted by the site");
    const image = await sources.fromUrl(row.id, row.src, "import").catch(sourceFailure);
    // It is the same image: keep the recorded source (a gallery page, the original link).
    image.fields.source = row.source ?? image.fields.source;
    return replaceImage(request, row, image, false);
  });

  /** Folders and images in a server import folder (PHOTO_IMPORT_DIRS). */
  app.get("/api/admin/photos/server", admin, async (request): Promise<AdminServerFolder> => {
    const { root, path } = parseInput(serverFileQuerySchema, request.query);
    const roots = sources.roots();
    if (!roots.length) return { roots, root: 0, path: "", entries: [] };
    const listing = await sources.list(root, path ?? "").catch(sourceFailure);
    return { roots, root, ...listing };
  });

  /** A small preview of a server image for the import browser; never cached. */
  app.get("/api/admin/photos/server/preview", admin, async (request, reply) => {
    const { root, path } = parseInput(serverFileQuerySchema, request.query);
    if (!path) throw badRequest("Choose an image");
    const { data } = await sources.readServerFile(root, path).catch(sourceFailure);
    let preview: Buffer;
    try {
      preview = await sharp(data, { failOn: "error", limitInputPixels: 120_000_000 })
        .rotate()
        .resize(320, 320, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 70 })
        .toBuffer();
    } catch {
      throw badRequest("无法识别的图片", "INVALID_IMAGE");
    }
    reply.header("content-type", "image/webp");
    reply.header("cache-control", "private, no-store");
    return reply.send(preview);
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
    await removeImage(store, row).catch((error) =>
      request.log.warn({ error, photoId: row.id }, "Failed to remove photo files")
    );
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
