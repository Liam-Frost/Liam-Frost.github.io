import { createHash } from "node:crypto";

import type { ImageDetails } from "./describe";
import type { AssetOwnerType, AssetRepository } from "./types";

const OWNERS: Record<string, AssetOwnerType> = {
  projects: "project",
  media: "media",
  people: "person",
  stack: "stack",
  branding: "branding"
};

/** The owner a storage key says it belongs to; null for photos (registered with more detail) and unknown areas. */
export function ownerOfKey(key: string): { ownerType: AssetOwnerType; ownerId: string } | null {
  const [area, ownerId] = key.split("/");
  const ownerType = area ? OWNERS[area] : undefined;
  return ownerType && ownerId ? { ownerType, ownerId } : null;
}

/**
 * Keeps the image register in step with the image store for every section but photos: an image is
 * registered when it is written, moved to the trash when its owner gives it up, and forgotten when its
 * files are removed. The store calls it, so the sections' own code stays as it was.
 */
export class ImageLedger {
  constructor(
    private readonly assets: AssetRepository,
    private readonly now: () => Date
  ) {}

  private async register(key: string, details: ImageDetails) {
    const owner = ownerOfKey(key);
    if (!owner) return;
    await this.assets.register({
      ...details,
      ...owner,
      storageKey: key,
      role: "image",
      originalName: null,
      uploadId: null
    });
  }

  /** A processed image (generated sizes and an original) was written under `key`. */
  async saved(key: string, details: ImageDetails) {
    await this.register(key, details);
  }

  /** A single file (a logo, an icon) was written under `key`. */
  async savedFile(
    key: string,
    name: string,
    data: Buffer,
    size: { width: number; height: number }
  ) {
    await this.register(key, {
      format: name.split(".").pop() ?? "",
      bytes: data.length,
      totalBytes: data.length,
      width: size.width,
      height: size.height,
      variants: [],
      sha256: createHash("sha256").update(data).digest("hex")
    });
  }

  private async under(key: string) {
    return (await this.assets.all()).filter(
      (asset) => asset.storageKey === key || asset.storageKey.startsWith(`${key}/`)
    );
  }

  /**
   * Moves the registered images at `key` (an image folder, or an owner's folder with all its images) to
   * the trash. False when nothing there is registered: the caller then removes the files itself.
   */
  async trash(key: string) {
    const found = (await this.under(key)).filter((asset) => ownerOfKey(asset.storageKey));
    const at = this.now();
    for (const asset of found)
      if (asset.status === "ready") await this.assets.setStatus(asset.storageKey, "trashed", at);
    return found.length > 0;
  }

  /** The files at `key` are gone: drop their entries. */
  async forget(key: string) {
    for (const asset of await this.under(key)) await this.assets.removeByKey(asset.storageKey);
  }
}
