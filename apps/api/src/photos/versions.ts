import { randomUUID } from "node:crypto";

import type { PhotoSource } from "@liam-frost/shared";

import { Prisma, type PhotoVersion, type PrismaClient } from "../generated/prisma/client";
import type { PhotoRow, StoredVariant } from "./types";

/** The fields that make up an image: copied from the current version onto the photo. */
export type ImageFields = Pick<
  PhotoRow,
  "src" | "storage" | "storageKey" | "variants" | "source" | "width" | "height"
>;

/** One image of a photo, independent of Prisma. */
export type VersionRow = ImageFields & {
  id: string;
  photoId: string;
  label: string;
  createdAt: Date;
  /** When this version alone was moved to the trash; null while it is in use. */
  deletedAt: Date | null;
};

export type NewVersion = ImageFields & { photoId: string; label?: string; createdAt?: Date };

export interface PhotoVersionRepository {
  /** Oldest first; versions in the trash only on request. */
  list(photoId: string, options?: { includeTrashed?: boolean }): Promise<VersionRow[]>;
  /** In use or in the trash: `deletedAt` tells which. */
  get(id: string): Promise<VersionRow | null>;
  /** The version in use whose site-hosted files are under this key. */
  findByStorageKey(key: string): Promise<VersionRow | null>;
  /** Moves a version to the trash. */
  trash(id: string, at: Date): Promise<VersionRow | null>;
  restore(id: string): Promise<VersionRow | null>;
  /** Versions put in the trash on their own, most recently deleted first. */
  listTrashed(): Promise<VersionRow[]>;
  create(version: NewVersion): Promise<VersionRow>;
  setLabel(id: string, label: string): Promise<VersionRow | null>;
  delete(id: string): Promise<VersionRow | null>;
  /** Removes whatever is left of a deleted photo's versions. */
  removeAll(photoId: string): Promise<void>;
}

export const imageFields = (row: ImageFields): ImageFields => ({
  src: row.src,
  storage: row.storage,
  storageKey: row.storageKey,
  variants: row.variants,
  source: row.source,
  width: row.width,
  height: row.height
});

function toRow(record: PhotoVersion): VersionRow {
  return {
    ...record,
    storage: record.storage === "LOCAL" ? "local" : "remote-url",
    variants: record.variants as StoredVariant[] | null,
    source: record.source as PhotoSource | null
  };
}

const json = <T>(value: T | null) =>
  value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
const missing = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";

export class PrismaPhotoVersionRepository implements PhotoVersionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(photoId: string, { includeTrashed = false } = {}) {
    const records = await this.prisma.photoVersion.findMany({
      where: { photoId, ...(includeTrashed ? {} : { deletedAt: null }) },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });
    return records.map(toRow);
  }

  async get(id: string) {
    const record = await this.prisma.photoVersion.findUnique({ where: { id } });
    return record ? toRow(record) : null;
  }

  async findByStorageKey(key: string) {
    const record = await this.prisma.photoVersion.findFirst({
      where: { storageKey: key, deletedAt: null }
    });
    return record ? toRow(record) : null;
  }

  async trash(id: string, at: Date) {
    return this.mark(id, at);
  }

  async restore(id: string) {
    return this.mark(id, null);
  }

  private async mark(id: string, deletedAt: Date | null) {
    try {
      return toRow(await this.prisma.photoVersion.update({ where: { id }, data: { deletedAt } }));
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  }

  async listTrashed() {
    const records = await this.prisma.photoVersion.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" }
    });
    return records.map(toRow);
  }

  async create(version: NewVersion) {
    const record = await this.prisma.photoVersion.create({
      data: {
        id: randomUUID(),
        photoId: version.photoId,
        label: version.label ?? "",
        src: version.src,
        storage: version.storage === "local" ? "LOCAL" : "REMOTE_URL",
        storageKey: version.storageKey,
        variants: json(version.variants),
        source: json(version.source),
        width: version.width,
        height: version.height,
        ...(version.createdAt ? { createdAt: version.createdAt } : {})
      }
    });
    return toRow(record);
  }

  async setLabel(id: string, label: string) {
    try {
      return toRow(await this.prisma.photoVersion.update({ where: { id }, data: { label } }));
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  }

  async delete(id: string) {
    try {
      return toRow(await this.prisma.photoVersion.delete({ where: { id } }));
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  }

  async removeAll(photoId: string) {
    await this.prisma.photoVersion.deleteMany({ where: { photoId } });
  }
}
