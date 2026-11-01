import type { PublicCollection, PublicMedia } from "@liam-frost/shared";
import type { FastifyInstance } from "fastify";

import { HttpError, isDatabaseUnavailable, notFound } from "../lib/errors";
import { mediaIdSchema } from "../lib/validation";
import { DEFAULT_COLLECTION_SETTINGS, type CollectionSettingsStore } from "../media/collection-settings";
import { toPublicMedia, toPublicMediaSummary } from "../media/mapping";
import { isMediaPublic, type MediaRepository } from "../media/types";
import type { LocalImageStore } from "../storage/local";

/** Kinds the public page has sections for, with the display switch each one follows. */
const PAGE_KINDS = [
  ["movie", "movie"],
  ["tv", "tv"],
  ["anime", "anime"],
  ["track", "music"]
] as const;
const PAGE_KIND_NAMES: readonly string[] = PAGE_KINDS.map(([kind]) => kind);

/**
 * Public collection routes. An entry is listed when it is public, its kind is shown and it is not a
 * hidden "want" entry. Without a database (or when it is unreachable) the collection is empty and the
 * site hides it.
 */
export function registerCollectionRoutes(app: FastifyInstance, deps: { media: MediaRepository | null; collection: CollectionSettingsStore | null; store: LocalImageStore }) {
  const settings = () => deps.collection?.get() ?? Promise.resolve(DEFAULT_COLLECTION_SETTINGS);

  app.get("/api/collection", async (request): Promise<PublicCollection> => {
    if (!deps.media) return { kinds: [], items: [] };
    try {
      const [current, rows] = await Promise.all([settings(), deps.media.list()]);
      const kinds = PAGE_KINDS.filter(([, show]) => current.show[show]).map(([kind]) => kind);
      const items = rows.filter((row) => (kinds as string[]).includes(row.kind) && isMediaPublic(row, current));
      return { kinds, items: items.map((row) => toPublicMediaSummary(row, deps.store)) };
    } catch (error) {
      request.log.warn({ error }, "Collection unavailable");
      return { kinds: [], items: [] };
    }
  });

  app.get("/api/collection/:id", async (request): Promise<PublicMedia> => {
    const parsed = mediaIdSchema.safeParse(request.params);
    if (!parsed.success || !deps.media) throw notFound("Entry not found");
    let row;
    let current;
    try {
      [row, current] = await Promise.all([deps.media.get(parsed.data.id), settings()]);
    } catch (error) {
      if (!isDatabaseUnavailable(error)) throw error;
      throw new HttpError(503, "UNAVAILABLE", "The collection is temporarily unavailable");
    }
    // Hidden entries are indistinguishable from missing ones.
    if (!row || !PAGE_KIND_NAMES.includes(row.kind) || !isMediaPublic(row, current)) throw notFound("Entry not found");
    return toPublicMedia(row, deps.store);
  });
}
