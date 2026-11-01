import {
  PERSON_ROLES,
  SOUNDTRACK_ROLES,
  type AdminBatchResult,
  type AdminPeopleResponse,
  type AdminPersonResponse,
  type AdminPersonSearchResponse,
  type AdminRelationCreate,
  type AdminRelationResponse,
  type AdminRelationsResponse,
  type AdminRelationSuggestionsResponse,
  type RelationSuggestion,
  type RelationType
} from "@liam-frost/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";

import type { AdminAuthService } from "../auth/service";
import { badRequest, HttpError, notFound } from "../lib/errors";
import { KeyedLock } from "../lib/keyed-lock";
import {
  mediaIdSchema,
  parseInput,
  personCreateSchema,
  personBatchSchema,
  personIdSchema,
  personImportSchema,
  personSearchQuerySchema,
  personUpdateSchema,
  relationCreateSchema,
  relationIdSchema,
  relationUpdateSchema
} from "../lib/validation";
import { storePoster } from "../media/import";
import { SourceError, titleKey, type MediaSources } from "../media/sources";
import type { MediaRepository, MediaRow } from "../media/types";
import { mediaEnd, personEnd, sides, toAdminPerson, toAdminRelation } from "../people/mapping";
import {
  DuplicatePersonError,
  DuplicateRelationError,
  relationKey,
  type PersonRepository,
  type PersonRow,
  type RelationRepository,
  type RelationRow
} from "../people/types";
import { InvalidImageError, processImage } from "../photos/images";
import type { StoredImage } from "../projects/types";
import type { LocalImageStore } from "../storage/local";
import { readUploadedImage } from "./read-upload";

const MUSIC = new Set(["track", "album"]);

/** How an AniList relation reads as a relation of ours; `reverse` means the other work is the start. */
const ANILIST_RELATIONS: Record<string, { type: RelationType; reverse: boolean }> = {
  SOURCE: { type: "adaptation", reverse: false },
  ADAPTATION: { type: "adaptation", reverse: true },
  PREQUEL: { type: "sequel", reverse: false },
  SEQUEL: { type: "sequel", reverse: true },
  SIDE_STORY: { type: "related", reverse: false },
  SPIN_OFF: { type: "related", reverse: false },
  PARENT: { type: "related", reverse: false },
  ALTERNATIVE: { type: "related", reverse: false },
  SUMMARY: { type: "related", reverse: false },
  COMPILATION: { type: "related", reverse: false },
  CONTAINS: { type: "related", reverse: false }
};

function sourceFailure(error: unknown): never {
  if (error instanceof SourceError) throw new HttpError(502, "SOURCE_ERROR", error.message);
  throw error;
}

/** Name identity across scripts and spacing, for matching singers to people. */
const personKeys = (person: PersonRow) => [...Object.values(person.name), person.originalName].filter((name): name is string => Boolean(name)).map(titleKey);

/** Whether a relation's role fits its type (credits: a person's role; soundtracks: optional song role). */
function checkRole(type: RelationType, role: string | null) {
  if (type === "credit") {
    if (!role || !(PERSON_ROLES as readonly string[]).includes(role)) throw badRequest("Credits need a person's role", "VALIDATION");
  } else if (type === "soundtrack") {
    if (role && !(SOUNDTRACK_ROLES as readonly string[]).includes(role)) throw badRequest("Invalid soundtrack role", "VALIDATION");
  } else if (role) {
    throw badRequest("Only credits and soundtracks have a role", "VALIDATION");
  }
}

/**
 * People (actors, directors, singers, writers, studios) and the links between collection entries and
 * people. People are imported from TMDB or created by hand; links are stored once and listed from both
 * ends.
 */
export function registerAdminPeopleRoutes(
  app: FastifyInstance,
  auth: AdminAuthService,
  deps: {
    media: MediaRepository | null;
    people: PersonRepository | null;
    relations: RelationRepository | null;
    sources: MediaSources;
    store: LocalImageStore;
    maxUploadBytes: number;
  }
) {
  const { sources, store } = deps;
  const repo = () => {
    if (!deps.media || !deps.people || !deps.relations) {
      throw new HttpError(503, "DATABASE_NOT_CONFIGURED", "People need a database (set DATABASE_URL)");
    }
    return { media: deps.media, people: deps.people, relations: deps.relations };
  };
  const admin = { preHandler: auth.requireAdmin };
  const personId = (request: FastifyRequest) => parseInput(personIdSchema, request.params).id;
  // Photo changes read the person and write them back; run them one at a time per person.
  const lock = new KeyedLock();

  const getPerson = async (id: string) => {
    const row = await repo().people.get(id);
    if (!row) throw notFound("Person not found");
    return row;
  };
  const getMedia = async (id: string) => {
    const row = await repo().media.get(id);
    if (!row) throw notFound("Entry not found");
    return row;
  };
  const works = async (id: string) => new Set((await repo().relations.list({ personId: id })).map((relation) => relation.toMediaId)).size;
  const respond = async (row: PersonRow): Promise<AdminPersonResponse> => ({ person: toAdminPerson(row, await works(row.id), store) });

  /** A subject's relations, each with the other end loaded. */
  const relationsOf = async (subjectId: string, rows: RelationRow[]) => {
    const { media, people } = repo();
    const ends = await Promise.all(
      rows.map(async (relation) => {
        const { direction, other } = sides(relation, subjectId);
        const end = other.type === "media" ? await media.get(other.id) : await people.get(other.id);
        if (!end) return null;
        return toAdminRelation(relation, direction, other.type === "media" ? mediaEnd(end as MediaRow, store) : personEnd(end as PersonRow, store));
      })
    );
    return ends.filter((relation) => relation !== null);
  };

  app.get("/api/admin/people", admin, async (): Promise<AdminPeopleResponse> => {
    const [rows, relations] = await Promise.all([repo().people.list({ includePrivate: true }), repo().relations.list()]);
    const works = new Map<string, Set<string>>();
    for (const relation of relations) {
      if (relation.fromPersonId) works.set(relation.fromPersonId, (works.get(relation.fromPersonId) ?? new Set()).add(relation.toMediaId));
    }
    return { people: rows.map((row) => toAdminPerson(row, works.get(row.id)?.size ?? 0, store)) };
  });

  app.get("/api/admin/people/search", admin, async (request): Promise<AdminPersonSearchResponse> => {
    const { q } = parseInput(personSearchQuerySchema, request.query);
    const hits = await sources.searchPeople(q).catch(sourceFailure);
    const existing = await repo().people.findBySource("tmdb", hits.map((hit) => hit.sourceId));
    return { results: hits.map((hit) => ({ ...hit, existingId: existing.get(hit.sourceId) ?? null })) };
  });

  /** Imports a TMDB person: details and photo are fetched by the server. */
  app.post("/api/admin/people/import", admin, async (request, reply): Promise<AdminPersonResponse> => {
    const { sourceId } = parseInput(personImportSchema, request.body);
    const { people } = repo();
    if ((await people.findBySource("tmdb", [sourceId])).has(sourceId)) throw new HttpError(409, "PERSON_EXISTS", "This person is already in the collection");
    const { photoUrl, ...details } = await sources.person(sourceId).catch(sourceFailure);
    const id = randomUUID();

    let photo: StoredImage | null = null;
    if (photoUrl) {
      try {
        photo = await storePoster(store, id, await processImage(await sources.download(photoUrl)), "people");
      } catch (error) {
        if (!(error instanceof SourceError || error instanceof InvalidImageError)) throw error;
        request.log.warn({ error, sourceId }, "Photo download failed");
      }
    }

    try {
      const row = await people.create({ id, source: "tmdb", ...details, photo });
      reply.code(201);
      return respond(row);
    } catch (error) {
      if (photo) await store.remove(`people/${id}`).catch(() => undefined);
      if (error instanceof DuplicatePersonError) throw new HttpError(409, "PERSON_EXISTS", "This person is already in the collection");
      throw error;
    }
  });

  app.post("/api/admin/people", admin, async (request, reply): Promise<AdminPersonResponse> => {
    const { name, originalName } = parseInput(personCreateSchema, request.body);
    const row = await repo().people.create({ id: randomUUID(), source: "manual", name, originalName: originalName ?? null });
    reply.code(201);
    return respond(row);
  });

  app.get("/api/admin/people/:id", admin, async (request) => respond(await getPerson(personId(request))));

  app.patch("/api/admin/people/:id", admin, async (request): Promise<AdminPersonResponse> => {
    const id = personId(request);
    const patch = parseInput(personUpdateSchema, request.body);
    const row = await lock.run(id, () => repo().people.update(id, patch));
    if (!row) throw notFound("Person not found");
    return respond(row);
  });

  /** Deletes a person, their photo and their links. */
  const removePerson = async (request: FastifyRequest, id: string) => {
    await lock.run(id, async () => {
      await getPerson(id);
      await repo().people.delete(id);
    });
    await store.remove(`people/${id}`).catch((error) => request.log.warn({ error, personId: id }, "Failed to remove person files"));
  };

  app.delete("/api/admin/people/:id", admin, async (request, reply) => {
    await removePerson(request, personId(request));
    return reply.code(204).send();
  });

  /** Bulk delete, or change visibility / featured, of people; missing ones are reported. */
  app.post("/api/admin/people/batch", admin, async (request): Promise<AdminBatchResult> => {
    const input = parseInput(personBatchSchema, request.body);
    repo();
    const result: AdminBatchResult = { done: [], failed: [] };
    for (const id of input.ids) {
      try {
        if (input.action === "delete") {
          await removePerson(request, id);
        } else {
          const row = await lock.run(id, () => repo().people.update(id, input.patch));
          if (!row) throw notFound("Person not found");
        }
        result.done.push(id);
      } catch (error) {
        if (!(error instanceof HttpError)) throw error;
        result.failed.push({ id, message: error.message });
      }
    }
    return result;
  });

  /** Replaces the photo with an uploaded image. */
  app.post("/api/admin/people/:id/photo", admin, async (request, reply): Promise<AdminPersonResponse> => {
    const preflight = await getPerson(personId(request));
    const { image } = await readUploadedImage(request, deps.maxUploadBytes);
    const photo = await storePoster(store, preflight.id, image, "people");

    let result: { updated: PersonRow; old: StoredImage | null };
    try {
      result = await lock.run(preflight.id, async () => {
        const row = await getPerson(preflight.id);
        const updated = await repo().people.update(row.id, { photo });
        if (!updated) throw notFound("Person not found");
        return { updated, old: row.photo };
      });
    } catch (error) {
      await store.remove(photo.key).catch(() => undefined);
      throw error;
    }
    if (result.old) await store.remove(result.old.key).catch((error) => request.log.warn({ error, personId: preflight.id }, "Failed to remove old photo"));
    reply.code(201);
    return respond(result.updated);
  });

  app.get("/api/admin/people/:id/relations", admin, async (request): Promise<AdminRelationsResponse> => {
    const person = await getPerson(personId(request));
    return { relations: await relationsOf(person.id, await repo().relations.list({ personId: person.id })) };
  });

  app.get("/api/admin/media/:id/relations", admin, async (request): Promise<AdminRelationsResponse> => {
    const item = await getMedia(parseInput(mediaIdSchema, request.params).id);
    return { relations: await relationsOf(item.id, await repo().relations.list({ mediaId: item.id })) };
  });

  app.post("/api/admin/relations", admin, async (request, reply): Promise<AdminRelationResponse> => {
    const input = parseInput(relationCreateSchema, request.body);
    const to = await getMedia(input.toId);
    if (input.from.type === "person") {
      await getPerson(input.from.id);
    } else {
      const from = await getMedia(input.from.id);
      if (input.type === "soundtrack" && (from.kind !== "track" || MUSIC.has(to.kind))) throw badRequest("Soundtracks link a song to a work", "VALIDATION");
      if ((input.type === "adaptation" || input.type === "sequel") && (MUSIC.has(from.kind) || MUSIC.has(to.kind))) {
        throw badRequest("Adaptations and sequels link works, not songs", "VALIDATION");
      }
    }

    const ends = {
      fromMediaId: input.from.type === "media" ? input.from.id : null,
      fromPersonId: input.from.type === "person" ? input.from.id : null,
      toMediaId: to.id,
      type: input.type,
      role: input.role
    };
    try {
      const relation = await repo().relations.create({ id: randomUUID(), ...ends, note: input.note, key: relationKey(ends) });
      reply.code(201);
      return { relation: toAdminRelation(relation, "from", mediaEnd(to, store)) };
    } catch (error) {
      if (error instanceof DuplicateRelationError) throw new HttpError(409, "RELATION_EXISTS", "This link already exists");
      throw error;
    }
  });

  app.patch("/api/admin/relations/:id", admin, async (request): Promise<AdminRelationResponse> => {
    const { id } = parseInput(relationIdSchema, request.params);
    const patch = parseInput(relationUpdateSchema, request.body);
    const current = await repo().relations.get(id);
    if (!current) throw notFound("Link not found");
    const role = patch.role === undefined ? current.role : patch.role;
    checkRole(current.type, role);
    try {
      const relation = await repo().relations.update(id, { ...patch, key: relationKey({ ...current, role }) });
      if (!relation) throw notFound("Link not found");
      return { relation: toAdminRelation(relation, "from", mediaEnd(await getMedia(relation.toMediaId), store)) };
    } catch (error) {
      if (error instanceof DuplicateRelationError) throw new HttpError(409, "RELATION_EXISTS", "This link already exists");
      throw error;
    }
  });

  app.delete("/api/admin/relations/:id", admin, async (request, reply) => {
    const { id } = parseInput(relationIdSchema, request.params);
    if (!(await repo().relations.delete(id))) throw notFound("Link not found");
    return reply.code(204).send();
  });

  /**
   * Links the admin may want to add, from the entry's source data: TMDB cast and crew, a song's singers,
   * and AniList's adaptations and sequels that are already in the collection. Links that exist are left out.
   */
  app.get("/api/admin/media/:id/suggestions", admin, async (request): Promise<AdminRelationSuggestionsResponse> => {
    const item = await getMedia(parseInput(mediaIdSchema, request.params).id);
    const { media, people, relations } = repo();
    const existing = new Set((await relations.list({ mediaId: item.id })).map((relation) => relation.key));
    const suggestions: RelationSuggestion[] = [];

    if (item.source === "tmdb" && item.sourceId && !MUSIC.has(item.kind)) {
      const credits = await sources.credits(item.sourceId, item.kind).catch(sourceFailure);
      const known = await people.findBySource("tmdb", credits.map((credit) => credit.sourceId));
      for (const credit of credits) {
        const personId = known.get(credit.sourceId) ?? null;
        if (personId && existing.has(relationKey({ fromMediaId: null, fromPersonId: personId, toMediaId: item.id, type: "credit", role: credit.role }))) continue;
        suggestions.push({ kind: "tmdb-person", ...credit, personId });
      }
    }

    // Songs' singers, books' and comics' authors and games' developers, by name.
    const nameRole =
      item.kind === "track" ? ("singer" as const) : item.kind === "book" || item.kind === "comic" ? ("author" as const) : item.kind === "game" ? ("studio" as const) : null;
    if (nameRole && item.credits.length) {
      const everyone = await people.list({ includePrivate: true });
      for (const name of item.credits) {
        const match = everyone.find((person) => personKeys(person).includes(titleKey(name)));
        if (match && existing.has(relationKey({ fromMediaId: null, fromPersonId: match.id, toMediaId: item.id, type: "credit", role: nameRole }))) continue;
        suggestions.push({ kind: "name", name, role: nameRole, personId: match?.id ?? null });
      }
    }

    if ((item.kind === "anime" || item.kind === "comic" || item.kind === "book") && item.originalTitle) {
      const linked = await sources.relations(item.kind, item.originalTitle, item.year);
      if (linked.length) {
        const candidates = (await media.list({ includePrivate: true })).filter((row) => row.id !== item.id);
        for (const link of linked) {
          const mapping = ANILIST_RELATIONS[link.relationType];
          if (!mapping) continue;
          const keys = new Set(link.titles.map(titleKey));
          // A manga often has its anime's title, so only entries of the related work's kind match.
          const matches = candidates.filter(
            (row) => row.kind === link.kind && [row.originalTitle, ...Object.values(row.title)].some((title) => title && keys.has(titleKey(title)))
          );
          for (const other of matches) {
            const [from, to] = mapping.reverse ? [other, item] : [item, other];
            const relation: AdminRelationCreate = { from: { type: "media", id: from.id }, toId: to.id, type: mapping.type };
            const key = relationKey({ fromMediaId: from.id, fromPersonId: null, toMediaId: to.id, type: mapping.type, role: null });
            if (existing.has(key)) continue;
            existing.add(key);
            suggestions.push({ kind: "media", relation, other: mediaEnd(other, store) });
          }
        }
      }
    }

    return { suggestions };
  });
}
