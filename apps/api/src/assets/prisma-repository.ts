import { randomUUID } from "node:crypto";

import type { ImageAsset, Prisma, PrismaClient } from "../generated/prisma/client";
import type { StoredVariant } from "../photos/types";
import type { AssetOwnerType, AssetRepository, AssetRow, NewAsset } from "./types";

function toRow(record: ImageAsset): AssetRow {
  return {
    ...record,
    ownerType: record.ownerType as AssetOwnerType,
    variants: record.variants as StoredVariant[],
    status: record.status === "trashed" ? "trashed" : "ready"
  };
}

export class PrismaAssetRepository implements AssetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async register(asset: NewAsset) {
    const data = { ...asset, variants: asset.variants as Prisma.InputJsonValue };
    return toRow(
      await this.prisma.imageAsset.upsert({
        where: { storageKey: asset.storageKey },
        create: { id: randomUUID(), ...data },
        update: data
      })
    );
  }

  async getByKey(storageKey: string) {
    const record = await this.prisma.imageAsset.findUnique({ where: { storageKey } });
    return record ? toRow(record) : null;
  }

  async removeByKey(storageKey: string) {
    await this.prisma.imageAsset.deleteMany({ where: { storageKey } });
  }

  async findBySha256(hashes: string[], ownerType?: AssetOwnerType) {
    if (!hashes.length) return [];
    const records = await this.prisma.imageAsset.findMany({
      where: { sha256: { in: hashes }, status: "ready", ...(ownerType ? { ownerType } : {}) },
      orderBy: { createdAt: "asc" }
    });
    return records.map(toRow);
  }

  async findByUploadIds(uploadIds: string[]) {
    if (!uploadIds.length) return [];
    const records = await this.prisma.imageAsset.findMany({
      where: { uploadId: { in: uploadIds } }
    });
    return records.map(toRow);
  }

  async keys(ownerType: AssetOwnerType) {
    const records = await this.prisma.imageAsset.findMany({
      where: { ownerType },
      select: { storageKey: true }
    });
    return records.map((record) => record.storageKey);
  }
}
