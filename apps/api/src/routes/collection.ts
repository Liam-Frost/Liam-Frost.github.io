import type {
  CollectionSettings,
  PublicCollection,
  PublicMedia,
  PublicPerson
} from "@liam-frost/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";

import { HttpError, isDatabaseUnavailable, notFound } from "../lib/errors";
import { mediaIdSchema, personIdSchema } from "../lib/validation";
import {
  DEFAULT_COLLECTION_SETTINGS,
  type CollectionSettingsStore
} from "../media/collection-settings";
import { toPublicMedia, toPublicMediaSummary } from "../media/mapping";
import { isMediaPublic, type MediaRepository, type MediaRow } from "../media/types";
import { toPublicLinks, toPublicPerson, toPublicPersonSummary } from "../people/mapping";
import type { PersonRepository, PersonRow, RelationRepository, RelationRow } from "../people/types";
import type { PlaylistRepository } from "../playlists/types";
import type { LocalImageStore } from "../storage/local";

/** Kinds the public page has sections for, with the display switch each one follows. */
const PAGE_KINDS = [
  ["movie", "movie"],
  ["tv", "tv"],
  ["anime", "anime"],
  ["book", "book"],
  ["comic", "comic"],
  ["game", "game"],
  ["track", "music"]
] as const;
const PAGE_KIND_NAMES: readonly string[] = PAGE_KINDS.map(([kind]) => kind);

type Deps = {
  media: MediaRepository | null;
  people: PersonRepository | null;
  relations: RelationRepository | null;
  playlists?: PlaylistRepository | null;
  collection: CollectionSettingsStore | null;
  store: LocalImageStore;
};

/** Everything the site shows: entries, and people with at least one shown entry (and their credits). */
type Visible = {
  settings: CollectionSettings;
  media: Map<string, MediaRow>;
  people: Map<string, { row: PersonRow; credits: RelationRow[] }>;
  relations: RelationRow[];
};

/**
 * Public collection routes. An entry is listed when it is public, its kind is shown and it is not a
 * hidden "want" entry. A person is shown when they are public, the people switch is on and they are
 * credited in a shown entry; links appear when both ends are shown. Without a database (or when it is
 * unreachable) the collection is empty and the site hides it.
 */
export function registerCollectionRoutes(app: FastifyInstance, deps: Deps) {
  const settings = () => deps.collection?.get() ?? Promise.resolve(DEFAULT_COLLECTION_SETTINGS);

  const visible = async (): Promise<Visible> => {
    const [current, rows] = await Promise.all([settings(), deps.media!.list()]);
    const media = new Map(
      rows
        .filter((row) => PAGE_KIND_NAMES.includes(row.kind) && isMediaPublic(row, current))
        .map((row) => [row.id, row])
    );
    const people: Visible["people"] = new Map();
    if (!deps.people || !deps.relations) return { settings: current, media, people, relations: [] };

    const [persons, relations] = await Promise.all([
      current.show.people ? deps.people.list() : Promise.resolve([]),
      deps.relations.list()
    ]);
    for (const row of persons) {
      const credits = relations.filter(
        (relation) => relation.fromPersonId === row.id && media.has(relation.toMediaId)
      );
      if (credits.length) people.set(row.id, { row, credits });
    }
    return { settings: current, media, people, relations };
  };

  /** Reads that fail because the database is down answer 503 rather than 500. */
  const read = async <T>(request: FastifyRequest, load: () => Promise<T>) => {
    try {
      return await load();
    } catch (error) {
      if (!isDatabaseUnavailable(error)) throw error;
      request.log.warn({ error }, "Collection unavailable");
      throw new HttpError(503, "UNAVAILABLE", "The collection is temporarily unavailable");
    }
  };

  app.get("/api/collection", async (request): Promise<PublicCollection> => {
    if (!deps.media) return { kinds: [], items: [], people: [], playlists: [] };
    try {
      const shown = await visible();
      const kinds = PAGE_KINDS.filter(([, show]) => shown.settings.show[show]).map(
        ([kind]) => kind
      );
      // A playlist shows the songs the site shows, in its order; empty ones are left out.
      const playlists = (await (deps.playlists?.list() ?? Promise.resolve([])))
        .map((row) => ({
          row,
          trackIds: row.trackIds.filter((id) => shown.media.get(id)?.kind === "track")
        }))
        .filter(({ trackIds }) => trackIds.length > 0)
        .map(({ row, trackIds }) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          trackIds,
          sourceUrl: row.sourceUrl
        }));
      return {
        kinds,
        items: [...shown.media.values()].map((row) => toPublicMediaSummary(row, deps.store)),
        people: [...shown.people.values()].map(({ row, credits }) =>
          toPublicPersonSummary(row, credits, deps.store)
        ),
        playlists
      };
    } catch (error) {
      request.log.warn({ error }, "Collection unavailable");
      return { kinds: [], items: [], people: [], playlists: [] };
    }
  });

  app.get("/api/collection/:id", async (request): Promise<PublicMedia> => {
    const parsed = mediaIdSchema.safeParse(request.params);
    if (!parsed.success || !deps.media) throw notFound("Entry not found");
    const shown = await read(request, visible);
    // Hidden entries are indistinguishable from missing ones.
    const row = shown.media.get(parsed.data.id);
    if (!row) throw notFound("Entry not found");
    const relations = shown.relations.filter(
      (relation) => relation.fromMediaId === row.id || relation.toMediaId === row.id
    );
    return {
      ...toPublicMedia(row, deps.store),
      links: toPublicLinks(row.id, relations, shown, deps.store)
    };
  });

  app.get("/api/people/:id", async (request): Promise<PublicPerson> => {
    const parsed = personIdSchema.safeParse(request.params);
    if (!parsed.success || !deps.media) throw notFound("Person not found");
    const shown = await read(request, visible);
    const person = shown.people.get(parsed.data.id);
    if (!person) throw notFound("Person not found");
    const credits = person.credits
      .map((relation) => ({ relation, row: shown.media.get(relation.toMediaId)! }))
      // Newest work first.
      .sort((a, b) => (b.row.year ?? 0) - (a.row.year ?? 0))
      .map(({ relation, row }) => ({ relation, item: toPublicMediaSummary(row, deps.store) }));
    return toPublicPerson(person.row, credits, deps.store);
  });
}
