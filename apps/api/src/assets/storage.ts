import type {
  AdminStorageIssue,
  AdminStorageOverview,
  AdminStorageScan,
  LocalizedText
} from "@liam-frost/shared";
import sharp from "sharp";

import { HttpError, notFound } from "../lib/errors";
import { processImage } from "../photos/images";
import { variantFileName } from "../photos/mapping";
import type { PhotoRepository } from "../photos/types";
import type { ImageFields, PhotoVersionRepository } from "../photos/versions";
import type { LocalImageStore, StoredFolder } from "../storage/local";
import { describeImage } from "./describe";
import type { AssetRepository } from "./types";

const HOUR = 60 * 60 * 1000;
const isOriginal = (name: string) => name.startsWith("original.");

type Deps = {
  photos: PhotoRepository;
  versions: PhotoVersionRepository;
  assets: AssetRepository | null;
  store: LocalImageStore;
  now: () => Date;
  /** Registers other sections' existing images; run before each scan. */
  backfill?: () => Promise<unknown>;
  /** The title of another section's entry, if it still exists. */
  ownerTitle?: (ownerType: string, ownerId: string) => Promise<LocalizedText | null>;
};

/** An image folder the database knows, with the photo it belongs to. */
type Known = {
  image: Pick<ImageFields, "storage" | "storageKey" | "variants">;
  ownerType: string;
  photoId: string;
  title: LocalizedText;
  singleFile?: boolean;
};

/** The folders under UPLOAD_DIR that hold images. */
const AREAS = ["photos", "projects", "media", "people", "stack", "branding"];

/**
 * Compares the image folders on disk with what the database knows, and repairs what it can. A scan only
 * reports: orphan folders (on disk, unknown to the database), missing images (known, nothing on disk)
 * and incomplete ones (a generated size or the original is gone). Nothing is deleted without being asked.
 */
export class StorageManager {
  private last: AdminStorageScan | null = null;

  constructor(private readonly deps: Deps) {}

  /**
   * Every site-hosted image the database knows. Photos: in use, in the trash, every version. Other
   * sections: what the register holds (kept complete by the backfill that runs before each scan).
   */
  private async known() {
    const { photos, versions, assets } = this.deps;
    const rows = [
      ...(await photos.list({ includePrivate: true })),
      ...(await photos.listTrashed())
    ];
    const known = new Map<string, Known>();
    for (const row of rows) {
      const images = [row, ...(await versions.list(row.id, { includeTrashed: true }))];
      for (const image of images)
        if (image.storage === "local" && image.storageKey)
          known.set(image.storageKey, {
            image,
            ownerType: "photo",
            photoId: row.id,
            title: row.title
          });
    }
    for (const asset of assets ? await assets.all() : []) {
      if (asset.ownerType === "photo") continue;
      known.set(asset.storageKey, {
        image: { storage: "local", storageKey: asset.storageKey, variants: asset.variants },
        ownerType: asset.ownerType,
        photoId: asset.ownerId,
        title: (await this.deps.ownerTitle?.(asset.ownerType, asset.ownerId)) ?? {},
        // Logos and icons are a single file with no separate original.
        singleFile: asset.variants.length === 0
      });
    }
    return known;
  }

  private issue(
    key: string,
    owner: Known,
    folder: StoredFolder | undefined
  ): AdminStorageIssue | null {
    const names = new Set(folder?.files.map((file) => file.name) ?? []);
    const missing = (owner.image.variants ?? [])
      .map((variant) => variantFileName(variant.width))
      .filter((name) => !names.has(name));
    const original = [...names].some(isOriginal);
    if (!original && !owner.singleFile) missing.push("original");
    if (!missing.length) return null;
    return {
      key,
      ownerType: owner.ownerType,
      photoId: owner.photoId,
      title: owner.title,
      missing,
      repairable: original
    };
  }

  private async folders() {
    const all: StoredFolder[] = [];
    // Without the register the other sections' images cannot be told from orphans: photos only.
    for (const area of this.deps.assets ? AREAS : ["photos"])
      all.push(...(await this.deps.store.tree(area)));
    return all;
  }

  async scan(): Promise<AdminStorageScan> {
    const now = this.deps.now();
    // Other sections are known through the register: make sure it is complete first, or their
    // existing images would be reported as orphans.
    await this.deps.backfill?.();
    const [known, folders] = [await this.known(), await this.folders()];
    const onDisk = new Map(folders.map((folder) => [folder.key, folder]));
    const scan: AdminStorageScan = {
      scannedAt: now.toISOString(),
      // Folders newer than an hour may belong to an upload that is still being saved.
      orphans: folders
        .filter(
          (folder) => !known.has(folder.key) && now.getTime() - folder.modifiedAt.getTime() > HOUR
        )
        .map((folder) => ({
          key: folder.key,
          files: folder.files.length,
          bytes: folder.files.reduce((sum, file) => sum + file.bytes, 0),
          modifiedAt: folder.modifiedAt.toISOString(),
          // Only photos can take in a stray original.
          adoptable:
            folder.key.startsWith("photos/") && folder.files.some((file) => isOriginal(file.name))
        })),
      missing: [],
      incomplete: []
    };
    for (const [key, owner] of known) {
      const folder = onDisk.get(key);
      if (!folder?.files.length)
        scan.missing.push({
          key,
          ownerType: owner.ownerType,
          photoId: owner.photoId,
          title: owner.title,
          missing: [],
          repairable: false
        });
      else {
        const issue = this.issue(key, owner, folder);
        if (issue) scan.incomplete.push(issue);
      }
    }
    this.last = scan;
    return scan;
  }

  async overview(): Promise<AdminStorageOverview> {
    const { assets, store } = this.deps;
    const all = assets ? await assets.all() : [];
    const ready = all.filter((asset) => asset.status === "ready");
    const trashed = all.filter((asset) => asset.status === "trashed");
    const sum = (rows: typeof all, pick: (row: (typeof all)[number]) => number) =>
      rows.reduce((total, row) => total + pick(row), 0);
    const owners = new Map<string, { images: number; bytes: number }>();
    for (const asset of ready) {
      const entry = owners.get(asset.ownerType) ?? { images: 0, bytes: 0 };
      owners.set(asset.ownerType, {
        images: entry.images + 1,
        bytes: entry.bytes + asset.totalBytes
      });
    }
    const titles = new Map<string, LocalizedText>();
    const largest = [...ready].sort((a, b) => b.totalBytes - a.totalBytes).slice(0, 10);
    for (const asset of largest)
      if (asset.ownerType === "photo" && !titles.has(asset.ownerId)) {
        const row = await this.deps.photos.get(asset.ownerId);
        if (row) titles.set(asset.ownerId, row.title);
      }
    return {
      registered: assets !== null,
      images: ready.length,
      totalBytes: sum(ready, (asset) => asset.totalBytes),
      originalBytes: sum(ready, (asset) => asset.bytes),
      byOwner: [...owners].map(([ownerType, entry]) => ({ ownerType, ...entry })),
      trash: { images: trashed.length, bytes: sum(trashed, (asset) => asset.totalBytes) },
      disk: await store.diskSpace(),
      largest: largest.map((asset) => ({
        key: asset.storageKey,
        ownerType: asset.ownerType,
        ownerId: asset.ownerId,
        title: titles.get(asset.ownerId) ?? null,
        format: asset.format,
        bytes: asset.totalBytes
      })),
      scan: this.last
    };
  }

  /** The folder if it is still an orphan: checked again at the moment of acting on it. */
  private async orphan(key: string) {
    const folder = (await this.folders()).find((entry) => entry.key === key);
    if (!folder || (await this.known()).has(key)) throw notFound("Not an orphan folder");
    return folder;
  }

  private forget(key: string) {
    if (this.last)
      this.last = {
        ...this.last,
        orphans: this.last.orphans.filter((orphan) => orphan.key !== key),
        incomplete: this.last.incomplete.filter((issue) => issue.key !== key)
      };
  }

  async deleteOrphan(key: string) {
    const folder = await this.orphan(key);
    await this.deps.store.removeFolder(
      key,
      folder.files.map((file) => file.name)
    );
    await this.deps.assets?.removeByKey(key);
    this.forget(key);
  }

  /** A small preview of an orphan folder's image, from a generated size or the original. */
  async orphanPreview(key: string) {
    const folder = await this.orphan(key);
    const names = folder.files.map((file) => file.name);
    const generated = names
      .filter((name) => /^\d+\.webp$/.test(name))
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))[0];
    // A damaged generated size falls back to the original.
    for (const source of [generated, names.find(isOriginal)]) {
      const data = source ? await this.deps.store.readStored(key, source) : null;
      if (!data) continue;
      try {
        return await sharp(data, { failOn: "error", limitInputPixels: 120_000_000 })
          .rotate()
          .resize(320, 320, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 70 })
          .toBuffer();
      } catch {
        // Try the next source.
      }
    }
    return null;
  }

  /** The original of an orphan folder, to make a photo from; the folder is deleted afterwards. */
  async orphanOriginal(key: string) {
    const folder = await this.orphan(key);
    const name = folder.files.find((file) => isOriginal(file.name))?.name;
    const data = name ? await this.deps.store.readStored(key, name) : null;
    if (!name || !data)
      throw new HttpError(
        409,
        "NO_ORIGINAL",
        "This folder has no original image to make a photo from"
      );
    return { name, data };
  }

  /** The private original of a known image, for download. */
  async original(key: string) {
    const names = (await this.deps.store.files(key)).map((file) => file.name);
    const name = names.find(isOriginal);
    const data = name ? await this.deps.store.readStored(key, name) : null;
    return name && data ? { name, data } : null;
  }

  /** Renders a known image's sizes again from its original, replacing missing or damaged files. */
  async regenerate(key: string) {
    const owner = (await this.known()).get(key);
    if (!owner) throw notFound("Image not found");
    const original = await this.original(key);
    if (!original)
      throw new HttpError(
        409,
        "NO_ORIGINAL",
        "The original is missing, so the sizes cannot be made again"
      );
    const image = await processImage(original.data);
    for (const variant of image.variants)
      await this.deps.store.write(key, variantFileName(variant.width), variant.data);
    const registered = await this.deps.assets?.getByKey(key);
    if (registered)
      await this.deps.assets!.register({
        ...describeImage(image),
        storageKey: key,
        ownerType: registered.ownerType,
        ownerId: registered.ownerId,
        role: registered.role,
        originalName: registered.originalName,
        uploadId: registered.uploadId
      });
    this.forget(key);
  }
}
