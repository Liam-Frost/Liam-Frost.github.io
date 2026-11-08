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

const PERSON_FIELDS = new Set([
  "kind",
  "aliases",
  "identities",
  "members",
  "id",
  "source",
  "sourceId",
  "sourceUrl",
  "name",
  "originalName",
  "photo",
  "bio",
  "links",
  "featured",
  "visibility"
]);

/** In-memory PersonRepository with the same rules as the Prisma one (unique source person, by name). */
export class MemoryPersonRepository implements PersonRepository {
  rows = new Map<string, PersonRow>();

  async list({ includePrivate = false }: { includePrivate?: boolean } = {}) {
    return [...this.rows.values()]
      .filter((row) => includePrivate || row.visibility === "public")
      .sort(byName)
      .map((row) => structuredClone(row));
  }

  async get(id: string) {
    const row = this.rows.get(id);
    return row ? structuredClone(row) : null;
  }

  async findBySource(source: PersonRow["source"], sourceIds: string[]) {
    return new Map(
      [...this.rows.values()].flatMap((row) => [
        ...(row.source === source && row.sourceId && sourceIds.includes(row.sourceId)
          ? [[row.sourceId, row.id] as const]
          : []),
        ...(row.identities ?? [])
          .filter((i) => i.provider === source && sourceIds.includes(i.externalId))
          .map((i) => [i.externalId, row.id] as const)
      ])
    );
  }

  private unique(identities: PersonRow["identities"], except?: string) {
    if (
      (identities ?? []).some((i) =>
        [...this.rows.values()].some(
          (p) =>
            p.id !== except &&
            (p.identities ?? []).some(
              (other) => i.provider === other.provider && i.externalId === other.externalId
            )
        )
      )
    )
      throw new DuplicatePersonError();
  }
  async create(person: NewPerson) {
    // Prisma rejects fields the table does not have; so does this.
    const unknown = Object.keys(person).filter((key) => !PERSON_FIELDS.has(key));
    if (unknown.length) throw new Error(`Unknown person fields: ${unknown.join(", ")}`);
    if (person.sourceId && (await this.findBySource(person.source, [person.sourceId])).size)
      throw new DuplicatePersonError();
    this.unique(person.identities);
    const now = new Date();
    const row: PersonRow = {
      kind: "person",
      aliases: [],
      members: [],
      identities:
        person.source !== "manual" && person.sourceId
          ? [{ provider: person.source, externalId: person.sourceId, confirmed: true }]
          : [],
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
    this.unique(patch.identities, id);
    const next = { ...row, ...structuredClone(patch), updatedAt: new Date() };
    this.rows.set(id, next);
    return structuredClone(next);
  }

  async delete(id: string) {
    const row = this.rows.get(id);
    if (!row) return null;
    this.rows.delete(id);
    for (const p of this.rows.values())
      p.members = (p.members ?? []).filter((m) => m.personId !== id);
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
      const fromGone = row.fromMediaId
        ? !this.media.rows.has(row.fromMediaId)
        : !this.people.rows.has(row.fromPersonId!);
      if (fromGone || !this.media.rows.has(row.toMediaId)) this.rows.delete(id);
    }
    return [...this.rows.values()];
  }

  async list({ mediaId, personId }: { mediaId?: string; personId?: string } = {}) {
    return this.live()
      .filter((row) =>
        mediaId
          ? row.fromMediaId === mediaId || row.toMediaId === mediaId
          : personId
            ? row.fromPersonId === personId
            : true
      )
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
    if (patch.key && this.live().some((other) => other.id !== id && other.key === patch.key))
      throw new DuplicateRelationError();
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
