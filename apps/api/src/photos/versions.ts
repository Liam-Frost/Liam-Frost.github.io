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
};

export type NewVersion = ImageFields & { photoId: string; label?: string; createdAt?: Date };

export interface PhotoVersionRepository {
  /** Oldest first. */
  list(photoId: string): Promise<VersionRow[]>;
  get(id: string): Promise<VersionRow | null>;
  /** The version whose site-hosted files are under this key. */
  findByStorageKey(key: string): Promise<VersionRow | null>;
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

  async list(photoId: string) {
    const records = await this.prisma.photoVersion.findMany({
      where: { photoId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });
    return records.map(toRow);
  }

  async get(id: string) {
    const record = await this.prisma.photoVersion.findUnique({ where: { id } });
    return record ? toRow(record) : null;
  }

  async findByStorageKey(key: string) {
    const record = await this.prisma.photoVersion.findUnique({ where: { storageKey: key } });
    return record ? toRow(record) : null;
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
