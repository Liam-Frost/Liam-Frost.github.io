import type { PersonRole } from "@liam-frost/shared";
import { randomUUID } from "node:crypto";

import { KeyedLock } from "../lib/keyed-lock";
import type { MediaSources } from "../media/sources";
import type { MediaRepository, MediaRow } from "../media/types";
import {
  DuplicateRelationError,
  relationKey,
  type PersonRepository,
  type PersonRow,
  type RelationRepository
} from "./types";

const nameKey = (name: string) => name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
const namesOf = (person: PersonRow) =>
  new Set(
    [...Object.values(person.name), person.originalName]
      .filter((x): x is string => Boolean(x))
      .map(nameKey)
  );
const namedRole = (kind: MediaRow["kind"]): PersonRole | null =>
  kind === "track" || kind === "album"
    ? "singer"
    : kind === "book" || kind === "comic"
      ? "author"
      : kind === "game"
        ? "studio"
        : null;

/** Additive only: source IDs prove film/TV identity; names need a unique match and an explicit role. */
export class AutomaticRelations {
  private readonly lock = new KeyedLock();

  constructor(
    private readonly media: MediaRepository,
    private readonly people: PersonRepository,
    private readonly relations: RelationRepository,
    private readonly sources: MediaSources
  ) {}

  private async add(
    personId: string,
    item: MediaRow,
    role: PersonRole,
    character: string | null = null
  ) {
    const ends = {
      fromMediaId: null,
      fromPersonId: personId,
      toMediaId: item.id,
      type: "credit" as const,
      role
    };
    const key = relationKey(ends);
    try {
      await this.relations.create({
        id: randomUUID(),
        ...ends,
        key,
        note: character ? { en: character } : {}
      });
      return 1;
    } catch (error) {
      // Existing links, notes, and user-selected roles are never overwritten.
      if (error instanceof DuplicateRelationError) return 0;
      throw error;
    }
  }

  private async named(item: MediaRow, everyone: PersonRow[], onlyPersonId?: string) {
    const role = namedRole(item.kind);
    if (!role) return 0;
    let added = 0;
    for (const name of new Set(item.credits.map(nameKey).filter(Boolean))) {
      const matches = everyone.filter((person) => namesOf(person).has(name));
      if (matches.length !== 1) continue;
      const person = matches[0]!;
      if (onlyPersonId && person.id !== onlyPersonId) continue;
      // A name alone does not prove that an actor, author and band with the same name are identical.
      const links = await this.relations.list({ personId: person.id });
      if (!links.some((link) => link.type === "credit" && link.role === role)) continue;
      added += await this.add(person.id, item, role);
    }
    return added;
  }

  mediaAdded(item: MediaRow) {
    return this.lock.run("sync", async () => {
      const everyone = await this.people.list({ includePrivate: true });
      if (!everyone.length) return 0;
      if (item.source === "tmdb" && item.sourceId && this.sources.available().tmdb) {
        const known = new Map(
          everyone.filter((p) => p.source === "tmdb" && p.sourceId).map((p) => [p.sourceId!, p.id])
        );
        if (!known.size) return 0;
        const credits = await this.sources.credits(item.sourceId, item.kind, { all: true });
        let added = 0;
        for (const credit of credits) {
          const id = known.get(credit.sourceId);
          if (id) added += await this.add(id, item, credit.role, credit.character);
        }
        return added;
      }
      return this.named(item, everyone);
    });
  }

  personAdded(person: PersonRow) {
    return this.lock.run("sync", async () => {
      const items = await this.media.list({ includePrivate: true });
      let added = 0;
      if (person.source === "tmdb" && person.sourceId && this.sources.available().tmdb) {
        const works = await this.sources.personCredits(person.sourceId);
        const bySource = new Map(
          items
            .filter((item) => item.source === "tmdb" && item.sourceId)
            .map((item) => [item.sourceId!, item])
        );
        for (const work of works) {
          const item = bySource.get(work.sourceId);
          if (!item) continue;
          const role = item.kind === "anime" && work.role === "actor" ? "voice" : work.role;
          added += await this.add(person.id, item, role, work.character);
        }
      }
      const everyone = await this.people.list({ includePrivate: true });
      const keys = namesOf(person);
      for (const item of items) {
        if (namedRole(item.kind) && item.credits.some((name) => keys.has(nameKey(name))))
          added += await this.named(item, everyone, person.id);
      }
      return added;
    });
  }
}

/** Observe every import path, including Spotify playlist imports and Steam sync, at composition time. */
export function withAutomaticMedia(
  repo: MediaRepository,
  sync: AutomaticRelations,
  onError: (error: unknown) => void
): MediaRepository {
  const synchronize = async (row: MediaRow) => {
    await sync.mediaAdded(row).catch(onError);
    return row;
  };
  return {
    list: repo.list.bind(repo),
    get: repo.get.bind(repo),
    findBySource: repo.findBySource.bind(repo),
    imageAccess: repo.imageAccess.bind(repo),
    delete: repo.delete.bind(repo),
    setFeaturedOrder: repo.setFeaturedOrder.bind(repo),
    create: async (input) => synchronize(await repo.create(input)),
    update: async (id, patch) => {
      const row = await repo.update(id, patch);
      return row && patch.credits !== undefined ? synchronize(row) : row;
    }
  };
}

export function withAutomaticPeople(
  repo: PersonRepository,
  sync: AutomaticRelations,
  onError: (error: unknown) => void
): PersonRepository {
  const synchronize = async (row: PersonRow) => {
    await sync.personAdded(row).catch(onError);
    return row;
  };
  return {
    list: repo.list.bind(repo),
    get: repo.get.bind(repo),
    findBySource: repo.findBySource.bind(repo),
    delete: repo.delete.bind(repo),
    create: async (input) => synchronize(await repo.create(input)),
    update: async (id, patch) => {
      const row = await repo.update(id, patch);
      return row && (patch.name !== undefined || patch.originalName !== undefined)
        ? synchronize(row)
        : row;
    }
  };
}
