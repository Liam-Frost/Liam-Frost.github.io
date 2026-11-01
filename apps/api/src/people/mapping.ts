import type {
  AdminPerson,
  AdminRelation,
  AdminRelationEnd,
  PersonRole,
  PublicLink,
  PublicPerson,
  PublicPersonSummary,
  PublicMediaSummary
} from "@liam-frost/shared";

import { toPublicMediaSummary } from "../media/mapping";
import type { MediaRow } from "../media/types";
import { toProjectImage } from "../projects/mapping";
import type { LocalImageStore } from "../storage/local";
import type { PersonRow, RelationRow } from "./types";

export function toAdminPerson(row: PersonRow, works: number, store: LocalImageStore): AdminPerson {
  return {
    id: row.id,
    source: row.source,
    sourceId: row.sourceId,
    sourceUrl: row.sourceUrl,
    name: row.name,
    originalName: row.originalName,
    photo: row.photo ? toProjectImage(row.photo, store) : null,
    bio: row.bio,
    links: row.links,
    featured: row.featured,
    visibility: row.visibility,
    works,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function mediaEnd(row: MediaRow, store: LocalImageStore): Extract<AdminRelationEnd, { type: "media" }> {
  return {
    type: "media",
    id: row.id,
    kind: row.kind,
    title: row.title,
    year: row.year,
    poster: row.poster ? toProjectImage(row.poster, store) : null,
    visibility: row.visibility
  };
}

export function personEnd(row: PersonRow, store: LocalImageStore): Extract<AdminRelationEnd, { type: "person" }> {
  return { type: "person", id: row.id, name: row.name, photo: row.photo ? toProjectImage(row.photo, store) : null, visibility: row.visibility };
}

/** Which end of a relation is the entry or person a list is about, and the id of the other end. */
export function sides(relation: RelationRow, subjectId: string) {
  const fromId = relation.fromMediaId ?? relation.fromPersonId!;
  const direction: "from" | "to" = fromId === subjectId ? "from" : "to";
  return direction === "from"
    ? { direction, other: { type: "media" as const, id: relation.toMediaId } }
    : { direction, other: relation.fromMediaId ? { type: "media" as const, id: relation.fromMediaId } : { type: "person" as const, id: relation.fromPersonId! } };
}

export function toAdminRelation(relation: RelationRow, direction: "from" | "to", other: AdminRelationEnd): AdminRelation {
  return { id: relation.id, type: relation.type, role: relation.role, note: relation.note, direction, other };
}

/** A public person with the roles and number of entries the site shows. */
export function toPublicPersonSummary(row: PersonRow, credits: RelationRow[], store: LocalImageStore): PublicPersonSummary {
  const counts = new Map<PersonRole, number>();
  for (const credit of credits) if (credit.role) counts.set(credit.role as PersonRole, (counts.get(credit.role as PersonRole) ?? 0) + 1);
  return {
    id: row.id,
    name: row.name,
    originalName: row.originalName,
    photo: row.photo ? toProjectImage(row.photo, store) : null,
    roles: [...counts].sort((a, b) => b[1] - a[1]).map(([role]) => role),
    works: new Set(credits.map((credit) => credit.toMediaId)).size,
    featured: row.featured
  };
}

export function toPublicPerson(
  row: PersonRow,
  credits: { relation: RelationRow; item: PublicMediaSummary }[],
  store: LocalImageStore
): PublicPerson {
  return {
    ...toPublicPersonSummary(
      row,
      credits.map((credit) => credit.relation),
      store
    ),
    bio: row.bio,
    links: row.links,
    sourceUrl: row.sourceUrl,
    credits: credits.map(({ relation, item }) => ({ id: relation.id, role: relation.role, note: relation.note, item }))
  };
}

/** Links of one public entry; `media` and `people` hold only what the site shows. */
export function toPublicLinks(
  mediaId: string,
  relations: RelationRow[],
  visible: { media: Map<string, MediaRow>; people: Map<string, { row: PersonRow; credits: RelationRow[] }> },
  store: LocalImageStore
): PublicLink[] {
  return relations.flatMap((relation): PublicLink[] => {
    const { direction, other } = sides(relation, mediaId);
    const base = { id: relation.id, type: relation.type, role: relation.role, note: relation.note, direction };
    if (other.type === "media") {
      const row = visible.media.get(other.id);
      return row ? [{ ...base, other: { type: "media", item: toPublicMediaSummary(row, store) } }] : [];
    }
    const person = visible.people.get(other.id);
    return person ? [{ ...base, other: { type: "person", person: toPublicPersonSummary(person.row, person.credits, store) } }] : [];
  });
}
