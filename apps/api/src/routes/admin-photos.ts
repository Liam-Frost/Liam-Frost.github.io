import {
  UPLOAD_ID_HEADER,
  type AdminPhotoResponse,
  type AdminPhotoVersionsResponse,
  type AdminPhotosResponse,
  type AdminServerFolder,
  type AdminUploadCheckResponse,
  type AdminUploadStatusResponse,
  type PhotoSource
} from "@liam-frost/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomBytes } from "node:crypto";
import sharp from "sharp";

import type { AssetRepository } from "../assets/types";
import type { AdminAuthService } from "../auth/service";
import { badRequest, HttpError, notFound } from "../lib/errors";
import {
  parseInput,
  photoIdSchema,
  photoImageReplaceSchema,
  photoImportSchema,
  photoOrderSchema,
  photoUpdateSchema,
  photoVersionLabelSchema,
  photoVersionParamsSchema,
  serverFileQuerySchema,
  uploadCheckSchema,
  uploadIdSchema,
  uploadStatusSchema
} from "../lib/validation";
import { InvalidImageError } from "../photos/images";
import { toAdminPhoto, toAdminVersion } from "../photos/mapping";
import { removeImageFiles, type PhotoTrash } from "../photos/trash";
import {
  hostImage,
  PhotoSourceError,
  type PhotoImage,
  type PhotoSources
} from "../photos/photo-sources";
import type { PhotoPatch, PhotoRepository, PhotoRow } from "../photos/types";
import { imageFields, type PhotoVersionRepository, type VersionRow } from "../photos/versions";
import type { ImageSettings } from "../settings/images";
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

const removeImage = removeImageFiles;

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
  sources: PhotoSources,
  assets: AssetRepository | null,
  versions: PhotoVersionRepository | null,
  imageSettings: () => Promise<ImageSettings>,
  trash: PhotoTrash | null
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

  /**
   * Records a photo's site-hosted image in the register. The photo is already saved, so a failure here
   * only costs duplicate detection until the next scan; it must not fail the request.
   */
  const registerAsset = async (
    request: FastifyRequest,
    photoId: string,
    image: PhotoImage,
    extra: { originalName?: string | null; uploadId?: string | null } = {}
  ) => {
    if (!assets || !image.details || !image.fields.storageKey) return;
    await assets
      .register({
        ...image.details,
        storageKey: image.fields.storageKey,
        ownerType: "photo",
        ownerId: photoId,
        role: "image",
        originalName: extra.originalName ?? null,
        uploadId: extra.uploadId ?? null
      })
      .catch((error) => request.log.warn({ error, photoId }, "Failed to register the image"));
  };
  const vers = () => {
    if (!versions) {
      throw new HttpError(
        503,
        "DATABASE_NOT_CONFIGURED",
        "Photo management needs a database (set DATABASE_URL)"
      );
    }
    return versions;
  };
  /** A photo from before versions existed gets its image as its first, current version. */
  const ensureVersions = async (row: PhotoRow): Promise<PhotoRow> => {
    if (row.currentVersionId) return row;
    const version = await vers().create({
      photoId: row.id,
      ...imageFields(row),
      createdAt: row.createdAt
    });
    return (await repo().update(row.id, { currentVersionId: version.id })) ?? row;
  };
  /** Uploads being handled right now, by the client's upload id. */
  const inFlight = new Set<string>();

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
    image: PhotoImage,
    upload: { originalName?: string | null; uploadId?: string | null } = {}
  ): Promise<AdminPhotoResponse> => {
    try {
      const created = await repo().create({
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
      const row = await ensureVersions(created);
      request.log.info(
        { photoId: id, source: image.fields.source?.type, by: request.adminUser?.username },
        "Photo added"
      );
      await registerAsset(request, id, image, upload);
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
    const photos = repo();
    const header = request.headers[UPLOAD_ID_HEADER];
    const uploadId = header === undefined ? null : parseInput(uploadIdSchema, header);
    if (uploadId) {
      // A retry of an upload that already succeeded (its answer was lost): return that photo.
      const [known] = assets ? await assets.findByUploadIds([uploadId]) : [];
      const existing = known ? await photos.get(known.ownerId) : null;
      if (existing) {
        const file = request.isMultipart() ? await request.file() : null;
        file?.file.resume();
        return { photo: toAdminPhoto(existing, store) };
      }
      if (inFlight.has(uploadId))
        throw new HttpError(409, "UPLOAD_IN_PROGRESS", "This upload is still being processed");
      inFlight.add(uploadId);
    }
    try {
      return await receivePhoto(request, reply, uploadId);
    } finally {
      if (uploadId) inFlight.delete(uploadId);
    }
  });

  const receivePhoto = async (
    request: FastifyRequest,
    reply: FastifyReply,
    uploadId: string | null
  ): Promise<AdminPhotoResponse> => {
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
    return createPhoto(request, reply, id, hosted, { originalName: fileName, uploadId });
  };

  /**
   * Which of the files about to be uploaded match a photo already there: the very same file (by
   * hash), or an upload with the same file name. The admin then skips, replaces or keeps both.
   */
  app.post("/api/admin/photos/check", admin, async (request): Promise<AdminUploadCheckResponse> => {
    const { files } = parseInput(uploadCheckSchema, request.body);
    const rows = await repo().list({ includePrivate: true });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const byName = new Map<string, PhotoRow>();
    for (const row of rows)
      if (row.source?.type === "upload" && row.source.ref && !byName.has(row.source.ref))
        byName.set(row.source.ref, row);
    const hashed = assets
      ? await assets.findBySha256([...new Set(files.map((file) => file.sha256))], "photo")
      : [];
    return {
      conflicts: files.flatMap((file, index) => {
        const same = hashed.find(
          (asset) => asset.sha256 === file.sha256 && byId.has(asset.ownerId)
        );
        const row = same ? byId.get(same.ownerId) : byName.get(file.name.slice(0, 200));
        if (!row) return [];
        const { id, title, thumbnail } = toAdminPhoto(row, store);
        return [{ index, reason: same ? "content" : "name", photo: { id, title, thumbnail } }];
      })
    };
  });

  /** Which uploads of an interrupted batch reached the server and became photos. */
  app.post(
    "/api/admin/photos/uploads/status",
    admin,
    async (request): Promise<AdminUploadStatusResponse> => {
      const { ids } = parseInput(uploadStatusSchema, request.body);
      const photos = repo();
      const found = assets ? await assets.findByUploadIds(ids) : [];
      const entries = await Promise.all(
        found.map(async (asset) =>
          (await photos.get(asset.ownerId)) ? [asset.uploadId!, asset.ownerId] : null
        )
      );
      return {
        photos: Object.fromEntries(entries.filter((entry): entry is string[] => entry !== null))
      };
    }
  );

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

  const versionLimit = () =>
    new HttpError(
      409,
      "VERSION_LIMIT",
      "This photo has reached its version limit; delete a version first"
    );
  /** Refuses early, before an image is received or fetched for a photo that is already full. */
  const checkVersionRoom = async (row: PhotoRow) => {
    const [existing, settings] = await Promise.all([vers().list(row.id), imageSettings()]);
    if (Math.max(existing.length, 1) >= settings.maxPhotoVersions) throw versionLimit();
  };

  /**
   * Adds an image to a photo as a new version. As the current one it replaces what the photo shows,
   * keeping the photo's details, order and visibility (`useExif` also takes the date and camera details
   * from the new image). The earlier versions stay, for switching back.
   */
  const addVersion = async (
    request: FastifyRequest,
    row: PhotoRow,
    image: PhotoImage,
    options: { makeCurrent: boolean; useExif: boolean; originalName?: string | null }
  ): Promise<AdminPhotoResponse> => {
    let created: VersionRow | null = null;
    let updated: PhotoRow | null;
    try {
      updated = await ensureVersions(row);
      const [existing, settings] = await Promise.all([vers().list(row.id), imageSettings()]);
      if (existing.length >= settings.maxPhotoVersions) throw versionLimit();
      created = await vers().create({ photoId: row.id, ...image.fields });
      if (options.makeCurrent) {
        const patch: PhotoPatch = { ...image.fields, currentVersionId: created.id };
        if (options.useExif) {
          if (image.exif.date) patch.date = image.exif.date;
          if (image.exif.camera) patch.camera = image.exif.camera;
          if (image.exif.lens) patch.lens = image.exif.lens;
          if (image.exif.settings) patch.settings = image.exif.settings;
        }
        updated = await repo().update(row.id, patch);
        if (!updated) throw notFound("Photo not found");
      }
    } catch (error) {
      // Leave neither files nor a version behind when the photo could not take the image.
      if (created)
        await vers()
          .delete(created.id)
          .catch(() => undefined);
      await removeImage(store, image.fields).catch(() => undefined);
      throw error;
    }
    await registerAsset(request, row.id, image, { originalName: options.originalName });
    request.log.info(
      {
        photoId: row.id,
        versionId: created.id,
        current: options.makeCurrent,
        source: image.fields.source?.type,
        by: request.adminUser?.username
      },
      "Photo version added"
    );
    return { photo: toAdminPhoto(updated, store) };
  };

  const getRow = async (request: FastifyRequest) => {
    const row = await repo().get(idParam(request));
    if (!row) throw notFound("Photo not found");
    return row;
  };

  /**
   * Adds an uploaded image to a photo as a version, the current one unless `?current=0` (`?exif=1`
   * also takes its date and camera details).
   */
  app.post("/api/admin/photos/:id/image", admin, async (request): Promise<AdminPhotoResponse> => {
    const row = await getRow(request);
    await checkVersionRoom(row);
    const { fileName, image } = await readUploadedImage(request, maxUploadBytes, store);
    const hosted = await hostImage(store, row.id, image, uploadSource(fileName), null);
    const query = request.query as { exif?: string; current?: string };
    return addVersion(request, row, hosted, {
      makeCurrent: query.current !== "0",
      useExif: query.exif === "1",
      originalName: fileName
    });
  });

  /** Adds an image from a link, a Flickr photo or a server file as a version (current by default). */
  app.put("/api/admin/photos/:id/image", admin, async (request): Promise<AdminPhotoResponse> => {
    const row = await getRow(request);
    const { from, mode, useExif, current } = parseInput(photoImageReplaceSchema, request.body);
    await checkVersionRoom(row);
    const image = await fetchImage(row.id, from, mode).catch(sourceFailure);
    return addVersion(request, row, image, {
      makeCurrent: current ?? true,
      useExif: useExif ?? false
    });
  });

  /**
   * Downloads a referenced image and hosts it on the site as a new current version, keeping where it
   * came from. The referenced version stays.
   */
  app.post("/api/admin/photos/:id/host", admin, async (request): Promise<AdminPhotoResponse> => {
    const row = await getRow(request);
    if (row.storage !== "remote-url" || !row.src)
      throw new HttpError(409, "ALREADY_HOSTED", "This photo is already hosted by the site");
    await checkVersionRoom(row);
    const image = await sources.fromUrl(row.id, row.src, "import").catch(sourceFailure);
    // It is the same image: keep the recorded source (a gallery page, the original link).
    image.fields.source = row.source ?? image.fields.source;
    return addVersion(request, row, image, { makeCurrent: true, useExif: false });
  });

  const versionsOf = async (row: PhotoRow): Promise<AdminPhotoVersionsResponse> => {
    const current = await ensureVersions(row);
    const [list, settings] = await Promise.all([vers().list(row.id), imageSettings()]);
    const versions = await Promise.all(
      list.map(async (version) =>
        toAdminVersion(
          version,
          current.currentVersionId === version.id,
          store,
          assets && version.storageKey ? await assets.getByKey(version.storageKey) : null
        )
      )
    );
    return { photo: toAdminPhoto(current, store), versions, limit: settings.maxPhotoVersions };
  };
  const getVersion = async (request: FastifyRequest) => {
    const { id, versionId } = parseInput(photoVersionParamsSchema, request.params);
    const row = await repo().get(id);
    const version = row ? await vers().get(versionId) : null;
    if (!row || !version || version.photoId !== row.id || version.deletedAt)
      throw notFound("Version not found");
    return { row, version };
  };

  /** A photo's versions, oldest first, with which one it shows. */
  app.get(
    "/api/admin/photos/:id/versions",
    admin,
    async (request): Promise<AdminPhotoVersionsResponse> => versionsOf(await getRow(request))
  );

  /** Shows another version: the photo's image changes, its details, order and visibility do not. */
  app.post(
    "/api/admin/photos/:id/versions/:versionId/current",
    admin,
    async (request): Promise<AdminPhotoVersionsResponse> => {
      const { row, version } = await getVersion(request);
      const updated = await repo().update(row.id, {
        ...imageFields(version),
        currentVersionId: version.id
      });
      if (!updated) throw notFound("Photo not found");
      request.log.info(
        { photoId: row.id, versionId: version.id, by: request.adminUser?.username },
        "Photo version switched"
      );
      return versionsOf(updated);
    }
  );

  app.patch(
    "/api/admin/photos/:id/versions/:versionId",
    admin,
    async (request): Promise<AdminPhotoVersionsResponse> => {
      const { row, version } = await getVersion(request);
      const { label } = parseInput(photoVersionLabelSchema, request.body);
      await vers().setLabel(version.id, label);
      return versionsOf(row);
    }
  );

  /** Moves a version to the trash. The version being shown cannot be deleted. */
  app.delete(
    "/api/admin/photos/:id/versions/:versionId",
    admin,
    async (request): Promise<AdminPhotoVersionsResponse> => {
      const { row, version } = await getVersion(request);
      if (row.currentVersionId === version.id)
        throw new HttpError(
          409,
          "VERSION_IN_USE",
          "This version is the one being shown; switch to another first"
        );
      if (!trash) throw notFound("Version not found");
      await trash.trashVersion(version);
      request.log.info(
        { photoId: row.id, versionId: version.id, by: request.adminUser?.username },
        "Photo version moved to the trash"
      );
      return versionsOf(row);
    }
  );

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
    // To the trash: the files stay until it is emptied or the retention period runs out.
    repo();
    const row = trash ? await trash.trashPhoto(idParam(request)) : null;
    if (!row) throw notFound("Photo not found");
    request.log.info(
      { photoId: row.id, by: request.adminUser?.username },
      "Photo moved to the trash"
    );
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
