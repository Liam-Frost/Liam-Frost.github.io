import type {
  LocalizedText,
  PersonSource,
  PersonKind,
  PersonIdentity,
  PersonMembership,
  RelationType
} from "@liam-frost/shared";

import {
  Prisma,
  type MediaRelation,
  type Person,
  type PrismaClient
} from "../generated/prisma/client";
import type { StoredImage } from "../projects/types";
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
} from "./types";

const TYPE_TO_DB = {
  soundtrack: "SOUNDTRACK",
  adaptation: "ADAPTATION",
  sequel: "SEQUEL",
  related: "RELATED",
  credit: "CREDIT"
} as const;
const TYPE_FROM_DB: Record<MediaRelation["type"], RelationType> = {
  SOUNDTRACK: "soundtrack",
  ADAPTATION: "adaptation",
  SEQUEL: "sequel",
  RELATED: "related",
  CREDIT: "credit"
};

/** Nullable Json columns need Prisma.DbNull; a plain null is rejected. */
const json = (value: unknown) =>
  value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
const isUniqueConflict = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
const isMissing = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";

function personRow(
  record: Person & {
    members?: PersonMembership[];
    identities?: { provider: string; externalId: string; confirmed: boolean }[];
  }
): PersonRow {
  return {
    ...record,
    source: record.source as PersonSource,
    kind: record.kind as PersonKind,
    aliases: record.aliases as string[],
    members: (record.members ?? []).map(({ personId, role, startYear, endYear }) => ({
      personId,
      role,
      startYear,
      endYear
    })),
    identities: (record.identities ?? []).map((i) => ({
      provider: i.provider as PersonIdentity["provider"],
      externalId: i.externalId,
      confirmed: i.confirmed
    })),
    name: record.name as LocalizedText,
    photo: record.photo as StoredImage | null,
    bio: record.bio as LocalizedText,
    links: record.links as string[],
    visibility: record.visibility === "PRIVATE" ? "private" : "public"
  };
}

function personData(patch: PersonPatch): Prisma.PersonUpdateInput {
  const { photo, visibility, identities, aliases, members, ...rest } = patch;
  const data: Prisma.PersonUpdateInput = { ...rest };
  if (members !== undefined) data.members = { deleteMany: {}, create: members };
  if (aliases !== undefined) data.aliases = aliases;
  if (identities !== undefined)
    data.identities = {
      deleteMany: {},
      create: identities.map((i) => ({
        provider: i.provider,
        externalId: i.externalId,
        confirmed: i.confirmed ?? false
      }))
    };
  if (photo !== undefined) data.photo = json(photo);
  if (visibility !== undefined) data.visibility = visibility === "private" ? "PRIVATE" : "PUBLIC";
  return data;
}

/** People sort by name; names are JSON, so in code. */
export function byName(a: PersonRow, b: PersonRow) {
  const key = (row: PersonRow) =>
    (row.name.en ?? row.name.zh ?? Object.values(row.name).find(Boolean) ?? "").toLowerCase();
  return key(a).localeCompare(key(b));
}

export class PrismaPersonRepository implements PersonRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list({ includePrivate = false }: { includePrivate?: boolean } = {}) {
    const records = await this.prisma.person.findMany({
      include: { identities: true, members: true },
      where: includePrivate ? {} : { visibility: "PUBLIC" }
    });
    return records.map(personRow).sort(byName);
  }

  async get(id: string) {
    const record = await this.prisma.person.findUnique({
      where: { id },
      include: { identities: true, members: true }
    });
    return record ? personRow(record) : null;
  }

  async findBySource(source: PersonSource, sourceIds: string[]) {
    if (!sourceIds.length) return new Map<string, string>();
    const records = await this.prisma.person.findMany({
      where: {
        OR: [
          { source, sourceId: { in: sourceIds } },
          { identities: { some: { provider: source, externalId: { in: sourceIds } } } }
        ]
      },
      include: { identities: true, members: true }
    });
    return new Map(
      records.flatMap((record) => [
        ...(record.source === source && record.sourceId
          ? [[record.sourceId, record.id] as const]
          : []),
        ...record.identities
          .filter((i) => i.provider === source && sourceIds.includes(i.externalId))
          .map((i) => [i.externalId, record.id] as const)
      ])
    );
  }

  async create(person: NewPerson) {
    const { photo, visibility, links, identities, aliases, members, ...rest } = person;
    try {
      const record = await this.prisma.person.create({
        include: { identities: true, members: true },
        data: {
          bio: {},
          ...rest,
          aliases: aliases ?? [],
          members: { create: members ?? [] },
          identities: {
            create: (
              identities ??
              (person.source !== "manual" && person.sourceId
                ? [{ provider: person.source, externalId: person.sourceId, confirmed: true }]
                : [])
            ).map((i) => ({
              provider: i.provider,
              externalId: i.externalId,
              confirmed: i.confirmed ?? false
            }))
          },
          links: links ?? [],
          photo: json(photo ?? null),
          visibility: visibility === "private" ? "PRIVATE" : "PUBLIC"
        }
      });
      return personRow(record);
    } catch (error) {
      if (isUniqueConflict(error)) throw new DuplicatePersonError();
      throw error;
    }
  }

  async update(id: string, patch: PersonPatch) {
    try {
      return personRow(
        await this.prisma.person.update({
          where: { id },
          data: personData(patch),
          include: { identities: true, members: true }
        })
      );
    } catch (error) {
      if (isMissing(error)) return null;
      if (isUniqueConflict(error)) throw new DuplicatePersonError();
      throw error;
    }
  }

  async delete(id: string) {
    try {
      // Relations go with it (ON DELETE CASCADE).
      return personRow(await this.prisma.person.delete({ where: { id } }));
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }
}

function relationRow(record: MediaRelation): RelationRow {
  return { ...record, type: TYPE_FROM_DB[record.type], note: record.note as LocalizedText };
}

export class PrismaRelationRepository implements RelationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list({ mediaId, personId }: { mediaId?: string; personId?: string } = {}) {
    const where: Prisma.MediaRelationWhereInput = mediaId
      ? { OR: [{ fromMediaId: mediaId }, { toMediaId: mediaId }] }
      : personId
        ? { fromPersonId: personId }
        : {};
    const records = await this.prisma.mediaRelation.findMany({
      where,
      orderBy: { createdAt: "asc" }
    });
    return records.map(relationRow);
  }

  async get(id: string) {
    const record = await this.prisma.mediaRelation.findUnique({ where: { id } });
    return record ? relationRow(record) : null;
  }

  async create(relation: NewRelation) {
    const { type, ...rest } = relation;
    try {
      return relationRow(
        await this.prisma.mediaRelation.create({ data: { ...rest, type: TYPE_TO_DB[type] } })
      );
    } catch (error) {
      if (isUniqueConflict(error)) throw new DuplicateRelationError();
      throw error;
    }
  }

  async update(id: string, patch: RelationPatch) {
    try {
      return relationRow(await this.prisma.mediaRelation.update({ where: { id }, data: patch }));
    } catch (error) {
      if (isMissing(error)) return null;
      if (isUniqueConflict(error)) throw new DuplicateRelationError();
      throw error;
    }
  }

  async delete(id: string) {
    try {
      return relationRow(await this.prisma.mediaRelation.delete({ where: { id } }));
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }
}
