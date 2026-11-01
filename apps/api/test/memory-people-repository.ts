import { byName } from "../src/people/prisma-repository";
import {
  DuplicatePersonError,
  DuplicateRelationError,
  type NewPerson,
  type NewRelation,
  type PersonPatch,
  type PersonRepository,
  type PersonRow,
  type RelationPatch,
  type RelationRepository,
  type RelationRow
} from "../src/people/types";
import type { MemoryMediaRepository } from "./memory-media-repository";

/** In-memory PersonRepository with the same rules as the Prisma one (unique source person, by name). */
export class MemoryPersonRepository implements PersonRepository {
  rows = new Map<string, PersonRow>();

  async list({ includePrivate = false }: { includePrivate?: boolean } = {}) {
    return [...this.rows.values()].filter((row) => includePrivate || row.visibility === "public").sort(byName).map((row) => structuredClone(row));
  }

  async get(id: string) {
    const row = this.rows.get(id);
    return row ? structuredClone(row) : null;
  }

  async findBySource(source: PersonRow["source"], sourceIds: string[]) {
    return new Map([...this.rows.values()].filter((row) => row.source === source && row.sourceId && sourceIds.includes(row.sourceId)).map((row) => [row.sourceId!, row.id]));
  }

  async create(person: NewPerson) {
    if (person.sourceId && (await this.findBySource(person.source, [person.sourceId])).size) throw new DuplicatePersonError();
    const now = new Date();
    const row: PersonRow = {
      sourceId: null,
      sourceUrl: null,
      originalName: null,
      photo: null,
      bio: {},
      links: [],
      featured: false,
      visibility: "public",
      ...person,
      createdAt: now,
      updatedAt: now
    };
    this.rows.set(row.id, structuredClone(row));
    return structuredClone(row);
  }

  async update(id: string, patch: PersonPatch) {
    const row = this.rows.get(id);
    if (!row) return null;
    const next = { ...row, ...structuredClone(patch), updatedAt: new Date() };
    this.rows.set(id, next);
    return structuredClone(next);
  }

  async delete(id: string) {
    const row = this.rows.get(id);
    if (!row) return null;
    this.rows.delete(id);
    return row;
  }
}

/**
 * In-memory RelationRepository. Relations whose entry or person was deleted disappear, like the
 * database's ON DELETE CASCADE.
 */
export class MemoryRelationRepository implements RelationRepository {
  rows = new Map<string, RelationRow>();

  constructor(
    private readonly media: MemoryMediaRepository,
    private readonly people: MemoryPersonRepository
  ) {}

  private live() {
    for (const [id, row] of this.rows) {
      const fromGone = row.fromMediaId ? !this.media.rows.has(row.fromMediaId) : !this.people.rows.has(row.fromPersonId!);
      if (fromGone || !this.media.rows.has(row.toMediaId)) this.rows.delete(id);
    }
    return [...this.rows.values()];
  }

  async list({ mediaId, personId }: { mediaId?: string; personId?: string } = {}) {
    return this.live()
      .filter((row) => (mediaId ? row.fromMediaId === mediaId || row.toMediaId === mediaId : personId ? row.fromPersonId === personId : true))
      .map((row) => structuredClone(row));
  }

  async get(id: string) {
    return structuredClone(this.live().find((row) => row.id === id) ?? null);
  }

  async create(relation: NewRelation) {
    if (this.live().some((row) => row.key === relation.key)) throw new DuplicateRelationError();
    const row: RelationRow = { ...structuredClone(relation), createdAt: new Date() };
    this.rows.set(row.id, row);
    return structuredClone(row);
  }

  async update(id: string, patch: RelationPatch) {
    const row = this.live().find((candidate) => candidate.id === id);
    if (!row) return null;
    if (patch.key && this.live().some((other) => other.id !== id && other.key === patch.key)) throw new DuplicateRelationError();
    const next = { ...row, ...structuredClone(patch) };
    this.rows.set(id, next);
    return structuredClone(next);
  }

  async delete(id: string) {
    const row = this.live().find((candidate) => candidate.id === id);
    if (!row) return null;
    this.rows.delete(id);
    return row;
  }
}
