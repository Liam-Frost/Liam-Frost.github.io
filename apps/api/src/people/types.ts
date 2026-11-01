import type { LocalizedText, PersonSource, PhotoVisibility, RelationType } from "@liam-frost/shared";

import type { StoredImage } from "../projects/types";

export type PersonRow = {
  id: string;
  source: PersonSource;
  sourceId: string | null;
  sourceUrl: string | null;
  name: LocalizedText;
  originalName: string | null;
  photo: StoredImage | null;
  bio: LocalizedText;
  links: string[];
  featured: boolean;
  visibility: PhotoVisibility;
  createdAt: Date;
  updatedAt: Date;
};

export type NewPerson = Pick<PersonRow, "id" | "source" | "name"> & Partial<Omit<PersonRow, "id" | "source" | "name" | "createdAt" | "updatedAt">>;
export type PersonPatch = Partial<Omit<PersonRow, "id" | "source" | "sourceId" | "createdAt" | "updatedAt">>;

/** The same source person is already in the collection. */
export class DuplicatePersonError extends Error {}

export interface PersonRepository {
  /** By name. */
  list(options?: { includePrivate?: boolean }): Promise<PersonRow[]>;
  get(id: string): Promise<PersonRow | null>;
  /** Ids of people already imported from `source`, keyed by source id. */
  findBySource(source: PersonSource, sourceIds: string[]): Promise<Map<string, string>>;
  /** Throws DuplicatePersonError when the source person exists. */
  create(person: NewPerson): Promise<PersonRow>;
  update(id: string, patch: PersonPatch): Promise<PersonRow | null>;
  /** Also deletes the person's relations. */
  delete(id: string): Promise<PersonRow | null>;
}

export type RelationRow = {
  id: string;
  /** Exactly one of fromMediaId / fromPersonId is set. */
  fromMediaId: string | null;
  fromPersonId: string | null;
  toMediaId: string;
  type: RelationType;
  role: string | null;
  note: LocalizedText;
  key: string;
  createdAt: Date;
};

export type NewRelation = Omit<RelationRow, "createdAt">;
export type RelationPatch = Partial<Pick<RelationRow, "role" | "note" | "key">>;

/** The same relation (start, end, type and role) exists. */
export class DuplicateRelationError extends Error {}

export interface RelationRepository {
  /** Oldest first: all, an entry's (either end) or a person's. */
  list(filter?: { mediaId?: string; personId?: string }): Promise<RelationRow[]>;
  get(id: string): Promise<RelationRow | null>;
  /** Throws DuplicateRelationError when the relation exists. */
  create(relation: NewRelation): Promise<RelationRow>;
  /** Throws DuplicateRelationError when the change makes it a duplicate. */
  update(id: string, patch: RelationPatch): Promise<RelationRow | null>;
  delete(id: string): Promise<RelationRow | null>;
}

/**
 * The unique key of a relation. "related" is symmetric, so its two ends are sorted: A related to B and
 * B related to A are the same relation.
 */
export function relationKey(relation: Pick<RelationRow, "fromMediaId" | "fromPersonId" | "toMediaId" | "type" | "role">) {
  const from = relation.fromMediaId ? `m:${relation.fromMediaId}` : `p:${relation.fromPersonId}`;
  const to = `m:${relation.toMediaId}`;
  const [a, b] = relation.type === "related" ? [from, to].sort() : [from, to];
  return `${a}>${b}:${relation.type}:${relation.role ?? ""}`;
}
