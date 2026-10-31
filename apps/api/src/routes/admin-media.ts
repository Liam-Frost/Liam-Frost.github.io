import type { AdminCollectionSettingsResponse, AdminMediaListResponse, AdminMediaResponse, AdminMediaSearchResponse } from "@liam-frost/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";

import type { AdminAuthService } from "../auth/service";
import { badRequest, HttpError, notFound } from "../lib/errors";
import { KeyedLock } from "../lib/keyed-lock";
import {
  collectionSettingsSchema,
  mediaCreateSchema,
  mediaIdSchema,
  mediaImportSchema,
  mediaListQuerySchema,
  mediaSearchQuerySchema,
  mediaUpdateSchema,
  parseInput
} from "../lib/validation";
import type { CollectionSettingsStore } from "../media/collection-settings";
import { importMedia, storePoster } from "../media/import";
import { toAdminMedia } from "../media/mapping";
import { SourceError, type MediaSources } from "../media/sources";
import { DuplicateMediaError, type MediaPatch, type MediaRepository, type MediaRow } from "../media/types";
import type { StoredImage } from "../projects/types";
import type { LocalImageStore } from "../storage/local";
import { readUploadedImage } from "./read-upload";

function sourceFailure(error: unknown): never {
  if (error instanceof SourceError) throw new HttpError(502, "SOURCE_ERROR", error.message);
  throw error;
}

/** The search results mark entries already in the collection, so the admin can open them from there. */
const alreadyAdded = () => new HttpError(409, "MEDIA_EXISTS", "This entry is already in the collection");

/**
 * Collection management. Entries are imported from TMDB / Bangumi (details and poster fetched by the
 * server; the client only names the source entry) or created by hand.
 */
export function registerAdminMediaRoutes(
  app: FastifyInstance,
  auth: AdminAuthService,
  deps: {
    media: MediaRepository | null;
    collection: CollectionSettingsStore | null;
    sources: MediaSources;
    store: LocalImageStore;
    maxUploadBytes: number;
  }
) {
  const { sources, store } = deps;
  const repo = () => {
    if (!deps.media || !deps.collection) {
      throw new HttpError(503, "DATABASE_NOT_CONFIGURED", "The collection needs a database (set DATABASE_URL)");
    }
    return { media: deps.media, collection: deps.collection };
  };
  const admin = { preHandler: auth.requireAdmin };
  const respond = (row: MediaRow): AdminMediaResponse => ({ item: toAdminMedia(row, store) });
  const mediaId = (request: FastifyRequest) => parseInput(mediaIdSchema, request.params).id;

  const get = async (id: string) => {
    const row = await repo().media.get(id);
    if (!row) throw notFound("Entry not found");
    return row;
  };

  const save = async (id: string, patch: MediaPatch) => {
    const row = await repo().media.update(id, patch);
    if (!row) throw notFound("Entry not found");
    return row;
  };

  // Poster changes read the entry and write it back; run them one at a time per entry.
  const lock = new KeyedLock();

  app.get("/api/admin/media", admin, async (request): Promise<AdminMediaListResponse> => {
    const { kind } = parseInput(mediaListQuerySchema, request.query);
    const rows = await repo().media.list({ kind, includePrivate: true });
    return { items: rows.map((row) => toAdminMedia(row, store)) };
  });

  app.get("/api/admin/media/search", admin, async (request): Promise<AdminMediaSearchResponse> => {
    const { kind, source, q } = parseInput(mediaSearchQuerySchema, request.query);
    const hits = await sources.search(source, kind, q).catch(sourceFailure);
    const existing = await repo().media.findBySource(source, hits.map((hit) => hit.sourceId));
    return { results: hits.map((hit) => ({ ...hit, existingId: existing.get(hit.sourceId) ?? null })) };
  });

  /** Imports a source entry: details and poster are fetched by the server. */
  app.post("/api/admin/media/import", admin, async (request, reply): Promise<AdminMediaResponse> => {
    const { kind, source, sourceId } = parseInput(mediaImportSchema, request.body);
    try {
      const row = await importMedia(
        { media: repo().media, sources, store, onPosterError: (error) => request.log.warn({ error, source, sourceId }, "Poster download failed") },
        kind,
        source,
        sourceId
      );
      reply.code(201);
      return respond(row);
    } catch (error) {
      if (error instanceof DuplicateMediaError) throw alreadyAdded();
      return sourceFailure(error);
    }
  });

  app.post("/api/admin/media", admin, async (request, reply): Promise<AdminMediaResponse> => {
    const { kind, title } = parseInput(mediaCreateSchema, request.body);
    const row = await repo().media.create({ id: randomUUID(), kind, source: "manual", title, status: "done" });
    reply.code(201);
    return respond(row);
  });

  app.get("/api/admin/media/:id", admin, async (request) => respond(await get(mediaId(request))));

  app.patch("/api/admin/media/:id", admin, async (request): Promise<AdminMediaResponse> => {
    const id = mediaId(request);
    const patch = parseInput(mediaUpdateSchema, request.body);
    if (patch.progress !== undefined || patch.status !== undefined) {
      const row = await get(id);
      if (row.kind === "track" || row.kind === "album") throw badRequest("Music entries have no watch status or progress", "VALIDATION");
    }
    return respond(await save(id, patch));
  });

  app.delete("/api/admin/media/:id", admin, async (request, reply) => {
    const id = mediaId(request);
    const row = await lock.run(id, async () => {
      const current = await get(id);
      await repo().media.delete(id);
      return current;
    });
    await store.remove(`media/${row.id}`).catch((error) => request.log.warn({ error, mediaId: row.id }, "Failed to remove entry files"));
    return reply.code(204).send();
  });

  /** Replaces the poster with an uploaded image. */
  app.post("/api/admin/media/:id/poster", admin, async (request, reply): Promise<AdminMediaResponse> => {
    const preflight = await get(mediaId(request));
    const { image } = await readUploadedImage(request, deps.maxUploadBytes);
    const poster = await storePoster(store, preflight.id, image);

    let result: { updated: MediaRow; old: StoredImage | null };
    try {
      result = await lock.run(preflight.id, async () => {
        const row = await get(preflight.id);
        return { updated: await save(row.id, { poster }), old: row.poster };
      });
    } catch (error) {
      await store.remove(poster.key).catch(() => undefined);
      throw error;
    }
    if (result.old) await store.remove(result.old.key).catch((error) => request.log.warn({ error, mediaId: preflight.id }, "Failed to remove old poster"));
    reply.code(201);
    return respond(result.updated);
  });

  app.get("/api/admin/collection/settings", admin, async (): Promise<AdminCollectionSettingsResponse> => ({
    settings: await repo().collection.get(),
    sources: sources.available()
  }));

  app.put("/api/admin/collection/settings", admin, async (request): Promise<AdminCollectionSettingsResponse> => {
    const settings = parseInput(collectionSettingsSchema, request.body);
    await repo().collection.save(settings);
    return { settings, sources: sources.available() };
  });
}
