import type { LocalizedText } from "@liam-frost/shared";

import { Prisma, type Photo as PrismaPhoto, type PrismaClient } from "../generated/prisma/client";
import type { NewPhoto, PhotoPatch, PhotoRepository, PhotoRow, StoredVariant } from "./types";

const ORDER = [{ sortOrder: "asc" }, { date: "desc" }, { id: "asc" }] satisfies Prisma.PhotoOrderByWithRelationInput[];

function toRow(record: PrismaPhoto): PhotoRow {
  return {
    ...record,
    title: record.title as LocalizedText,
    category: record.category as LocalizedText,
    location: record.location as LocalizedText | null,
    description: record.description as LocalizedText | null,
    tags: record.tags as LocalizedText[],
    alt: record.alt as LocalizedText,
    storage: record.storage === "LOCAL" ? "local" : "remote-url",
    variants: record.variants as StoredVariant[] | null,
    visibility: record.visibility === "PRIVATE" ? "private" : "public"
  };
}

/** Nullable Json columns need Prisma.DbNull; a plain null is rejected. */
function json<T>(value: T | null) {
  return value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}

function toData(patch: PhotoPatch): Prisma.PhotoUpdateInput {
  const data: Prisma.PhotoUpdateInput = {};
  if (patch.title !== undefined) data.title = patch.title;
  if (patch.date !== undefined) data.date = patch.date;
  if (patch.category !== undefined) data.category = patch.category;
  if (patch.location !== undefined) data.location = json(patch.location);
  if (patch.camera !== undefined) data.camera = patch.camera;
  if (patch.lens !== undefined) data.lens = patch.lens;
  if (patch.settings !== undefined) data.settings = patch.settings;
  if (patch.description !== undefined) data.description = json(patch.description);
  if (patch.tags !== undefined) data.tags = patch.tags;
  if (patch.alt !== undefined) data.alt = patch.alt;
  if (patch.visibility !== undefined) data.visibility = patch.visibility === "private" ? "PRIVATE" : "PUBLIC";
  if (patch.featured !== undefined) data.featured = patch.featured;
  return data;
}

export class PrismaPhotoRepository implements PhotoRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list({ includePrivate = false } = {}) {
    const records = await this.prisma.photo.findMany({
      where: includePrivate ? undefined : { visibility: "PUBLIC" },
      orderBy: ORDER
    });
    return records.map(toRow);
  }

  async get(id: string) {
    const record = await this.prisma.photo.findUnique({ where: { id } });
    return record ? toRow(record) : null;
  }

  async create(photo: NewPhoto) {
    const sortOrder = photo.sortOrder ?? ((await this.prisma.photo.aggregate({ _min: { sortOrder: true } }))._min.sortOrder ?? 1) - 1;
    const record = await this.prisma.photo.create({
      data: {
        ...photo,
        sortOrder,
        location: json(photo.location),
        description: json(photo.description),
        variants: json(photo.variants),
        storage: photo.storage === "local" ? "LOCAL" : "REMOTE_URL",
        visibility: photo.visibility === "private" ? "PRIVATE" : "PUBLIC"
      }
    });
    return toRow(record);
  }

  async update(id: string, patch: PhotoPatch) {
    try {
      return toRow(await this.prisma.photo.update({ where: { id }, data: toData(patch) }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return null;
      throw error;
    }
  }

  async delete(id: string) {
    try {
      return toRow(await this.prisma.photo.delete({ where: { id } }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return null;
      throw error;
    }
  }

  async reorder(ids: string[]) {
    await this.prisma.$transaction(ids.map((id, index) => this.prisma.photo.update({ where: { id }, data: { sortOrder: index } })));
  }
}
