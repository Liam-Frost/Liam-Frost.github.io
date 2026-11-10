import { randomUUID } from "node:crypto";

import type { AssetOwnerType, AssetRepository, AssetRow, NewAsset } from "../src/assets/types";

/** In-memory AssetRepository with the same rules as the Prisma one. */
export class MemoryAssetRepository implements AssetRepository {
  rows = new Map<string, AssetRow>();

  async register(asset: NewAsset) {
    const now = new Date();
    const existing = this.rows.get(asset.storageKey);
    const row: AssetRow = {
      id: existing?.id ?? randomUUID(),
      status: existing?.status ?? "ready",
      trashedAt: existing?.trashedAt ?? null,
      createdAt: existing?.createdAt ?? now,
      ...asset,
      updatedAt: now
    };
    this.rows.set(asset.storageKey, row);
    return row;
  }

  async getByKey(storageKey: string) {
    return this.rows.get(storageKey) ?? null;
  }

  async removeByKey(storageKey: string) {
    this.rows.delete(storageKey);
  }

  async setStatus(storageKey: string, status: AssetRow["status"], at: Date | null) {
    const row = this.rows.get(storageKey);
    if (row) this.rows.set(storageKey, { ...row, status, trashedAt: at });
  }

  async findBySha256(hashes: string[], ownerType?: AssetOwnerType) {
    return [...this.rows.values()].filter(
      (row) =>
        row.status === "ready" &&
        row.sha256 !== null &&
        hashes.includes(row.sha256) &&
        (!ownerType || row.ownerType === ownerType)
    );
  }

  async findByUploadIds(uploadIds: string[]) {
    return [...this.rows.values()].filter(
      (row) => row.uploadId !== null && uploadIds.includes(row.uploadId)
    );
  }

  async keys(ownerType: AssetOwnerType) {
    return [...this.rows.values()]
      .filter((row) => row.ownerType === ownerType)
      .map((row) => row.storageKey);
  }
}
