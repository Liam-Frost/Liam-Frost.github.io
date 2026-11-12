import type { AdminTrashItem, AdminTrashResponse } from "@liam-frost/shared";

import type { AssetRepository, AssetRow } from "../assets/types";
import { HttpError, notFound } from "../lib/errors";
import type { ImageSettings } from "../settings/images";
import type { LocalImageStore } from "../storage/local";
import { variantFileName, remoteThumbnail } from "./mapping";
import type { PhotoRepository, PhotoRow } from "./types";
import type { ImageFields, PhotoVersionRepository, VersionRow } from "./versions";

const DAY = 24 * 60 * 60 * 1000;

/** Removes an image's site-hosted files: its folder, or an older photo's flat folder (files only). */
export async function removeImageFiles(
  store: LocalImageStore,
  image: Pick<ImageFields, "storage" | "storageKey">
) {
  if (image.storage !== "local" || !image.storageKey) return;
  const parts = image.storageKey.split("/");
  if (parts.length === 2) {
    await store.removeFiles(image.storageKey);
    await store.removeIfEmpty(image.storageKey);
  } else {
    await store.remove(image.storageKey);
    await store.removeIfEmpty(parts.slice(0, 2).join("/"));
  }
}

export type TrashKind = AdminTrashItem["kind"];

type Deps = {
  photos: PhotoRepository;
  versions: PhotoVersionRepository;
  assets: AssetRepository | null;
  store: LocalImageStore;
  settings: () => Promise<ImageSettings>;
  now: () => Date;
  /** The title of another section's entry (a project, a collection entry, a person), if it still exists. */
  ownerTitle?: (ownerType: string, ownerId: string) => Promise<AdminTrashItem["title"] | null>;
};

/**
 * The trash for photos and their versions. Deleting marks the row and leaves the files where they are;
 * nothing in the trash is served to visitors. Restoring clears the mark. Removing for good deletes the
 * files first and the rows after, so a failed file removal is retried instead of leaving files nobody
 * knows about.
 */
export class PhotoTrash {
  constructor(private readonly deps: Deps) {}

  /** The site-hosted images of a photo: every version's, and its own in case it has no versions. */
  private async imagesOf(row: PhotoRow) {
    const versions = await this.deps.versions.list(row.id, { includeTrashed: true });
    const images = new Map<string, ImageFields>();
    for (const image of [row, ...versions])
      if (image.storage === "local" && image.storageKey) images.set(image.storageKey, image);
    return { versions, images: [...images.values()] };
  }

  private async mark(images: ImageFields[], status: "ready" | "trashed") {
    const at = status === "trashed" ? this.deps.now() : null;
    for (const image of images)
      if (image.storageKey) await this.deps.assets?.setStatus(image.storageKey, status, at);
  }

  async trashPhoto(id: string) {
    const row = await this.deps.photos.trash(id, this.deps.now());
    if (!row) return null;
    await this.mark((await this.imagesOf(row)).images, "trashed");
    return row;
  }

  async trashVersion(version: VersionRow) {
    const row = await this.deps.versions.trash(version.id, this.deps.now());
    if (row) await this.mark([row], "trashed");
    return row;
  }

  private async bytes(images: ImageFields[]) {
    if (!this.deps.assets) return null;
    let total = 0;
    for (const image of images)
      total += (await this.deps.assets.getByKey(image.storageKey!))?.totalBytes ?? 0;
    return total;
  }

  private thumbnail(kind: TrashKind, id: string, image: ImageFields) {
    return image.storage === "local"
      ? `/api/admin/trash/${kind}/${encodeURIComponent(id)}/thumbnail`
      : remoteThumbnail(image.src);
  }

  async list(): Promise<AdminTrashResponse> {
    const { photos, versions } = this.deps;
    const { trashRetentionDays } = await this.deps.settings();
    const expires = (deletedAt: Date) =>
      new Date(deletedAt.getTime() + trashRetentionDays * DAY).toISOString();
    const items: AdminTrashItem[] = [];
    for (const row of await photos.listTrashed()) {
      const owned = await this.imagesOf(row);
      items.push({
        kind: "photo",
        id: row.id,
        photoId: row.id,
        ownerType: "photo",
        restorable: true,
        title: row.title,
        label: "",
        thumbnail: this.thumbnail("photo", row.id, row),
        width: row.width,
        height: row.height,
        versions: Math.max(owned.versions.length, 1),
        bytes: await this.bytes(owned.images),
        deletedAt: row.deletedAt!.toISOString(),
        expiresAt: expires(row.deletedAt!)
      });
    }
    for (const version of await versions.listTrashed()) {
      const owner =
        (await photos.get(version.photoId)) ?? (await photos.getTrashed(version.photoId));
      items.push({
        kind: "version",
        id: version.id,
        photoId: version.photoId,
        ownerType: "photo",
        restorable: true,
        title: owner?.title ?? {},
        label: version.label,
        thumbnail: this.thumbnail("version", version.id, version),
        width: version.width,
        height: version.height,
        versions: 1,
        bytes: version.storage === "local" && version.storageKey ? await this.bytes([version]) : 0,
        deletedAt: version.deletedAt!.toISOString(),
        expiresAt: expires(version.deletedAt!)
      });
    }
    for (const asset of await this.trashedImages()) {
      const files = await this.deps.store.files(asset.storageKey);
      items.push({
        kind: "image",
        id: asset.id,
        photoId: asset.ownerId,
        ownerType: asset.ownerType,
        restorable: false,
        title: (await this.deps.ownerTitle?.(asset.ownerType, asset.ownerId)) ?? {},
        label: asset.storageKey,
        thumbnail: this.previewFile(files) ? `/api/admin/trash/image/${asset.id}/thumbnail` : null,
        width: asset.width,
        height: asset.height,
        versions: 1,
        bytes: asset.totalBytes,
        deletedAt: asset.trashedAt!.toISOString(),
        expiresAt: expires(asset.trashedAt!)
      });
    }
    items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
    return {
      items,
      retentionDays: trashRetentionDays,
      totalBytes: items.reduce((sum, item) => sum + (item.bytes ?? 0), 0)
    };
  }

  /** Images of other sections in the trash: replaced or deleted covers, posters, logos, icons. */
  private async trashedImages() {
    const all = this.deps.assets ? await this.deps.assets.all() : [];
    return all.filter(
      (asset) => asset.status === "trashed" && asset.ownerType !== "photo" && asset.trashedAt
    );
  }

  private async trashedImage(id: string) {
    const asset = await this.deps.assets?.get(id);
    return asset && asset.status === "trashed" && asset.ownerType !== "photo" ? asset : null;
  }

  /** The smallest WebP of a folder, which the trash page can show. */
  private previewFile(files: { name: string }[]) {
    return files
      .map((file) => file.name)
      .filter((name) => /^\d+\.webp$/.test(name))
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))[0];
  }

  /** The original of a trashed image of another section (or its only file), as a download. */
  async imageOriginal(id: string) {
    const asset = await this.trashedImage(id);
    if (!asset) return null;
    const names = (await this.deps.store.files(asset.storageKey)).map((file) => file.name);
    const name = names.find((file) => file.startsWith("original.")) ?? names[0];
    const data = name ? await this.deps.store.readStored(asset.storageKey, name) : null;
    return name && data ? { name, data, asset } : null;
  }

  private async purgeImage(asset: AssetRow) {
    // Removing the files also drops the register entry.
    await this.deps.store.remove(asset.storageKey);
    await this.deps.store.removeIfEmpty(asset.storageKey.split("/").slice(0, 2).join("/"));
    await this.deps.assets?.removeByKey(asset.storageKey);
  }

  /** The smallest generated size of a trashed image, for the trash page. */
  async thumbnailFile(kind: TrashKind, id: string) {
    if (kind === "image") {
      const asset = await this.trashedImage(id);
      const name = asset ? this.previewFile(await this.deps.store.files(asset.storageKey)) : null;
      return asset && name ? this.deps.store.readPublic(asset.storageKey, name) : null;
    }
    const image =
      kind === "photo" ? await this.deps.photos.getTrashed(id) : await this.trashedVersion(id);
    const smallest = image?.variants?.[0];
    if (!image || image.storage !== "local" || !image.storageKey || !smallest) return null;
    return this.deps.store.readPublic(image.storageKey, variantFileName(smallest.width));
  }

  private async trashedVersion(id: string) {
    const version = await this.deps.versions.get(id);
    return version?.deletedAt ? version : null;
  }

  async restore(kind: TrashKind, id: string) {
    if (kind === "image")
      throw new HttpError(
        409,
        "NOT_RESTORABLE",
        "This image cannot be put back; download it and add it again"
      );
    if (kind === "photo") {
      const row = await this.deps.photos.restore(id);
      if (!row) throw notFound("Not in the trash");
      // Versions deleted on their own before the photo stay in the trash.
      const { versions } = await this.imagesOf(row);
      await this.mark(
        [row, ...versions.filter((version) => !version.deletedAt)].filter(
          (image) => image.storage === "local"
        ),
        "ready"
      );
      return;
    }
    const version = await this.trashedVersion(id);
    if (!version) throw notFound("Not in the trash");
    if (!(await this.deps.photos.get(version.photoId)))
      throw new HttpError(
        409,
        "TRASH_PHOTO_FIRST",
        "This version's photo is in the trash; restore the photo first"
      );
    const [inUse, settings] = await Promise.all([
      this.deps.versions.list(version.photoId),
      this.deps.settings()
    ]);
    if (inUse.length >= settings.maxPhotoVersions)
      throw new HttpError(
        409,
        "VERSION_LIMIT",
        "This photo has reached its version limit; delete a version first"
      );
    await this.deps.versions.restore(id);
    await this.mark([version], "ready");
  }

  private async removeImages(images: ImageFields[]) {
    for (const image of images) {
      await removeImageFiles(this.deps.store, image);
      if (image.storageKey) await this.deps.assets?.removeByKey(image.storageKey);
    }
  }

  private async purgePhoto(row: PhotoRow) {
    await this.removeImages((await this.imagesOf(row)).images);
    await this.deps.photos.delete(row.id);
    await this.deps.versions.removeAll(row.id);
  }

  private async purgeVersion(version: VersionRow) {
    await this.removeImages([version]);
    await this.deps.versions.delete(version.id);
  }

  /** Removes one item for good. */
  async purge(kind: TrashKind, id: string) {
    if (kind === "image") {
      const asset = await this.trashedImage(id);
      if (!asset) throw notFound("Not in the trash");
      return this.purgeImage(asset);
    }
    if (kind === "photo") {
      const row = await this.deps.photos.getTrashed(id);
      if (!row) throw notFound("Not in the trash");
      return this.purgePhoto(row);
    }
    const version = await this.trashedVersion(id);
    if (!version) throw notFound("Not in the trash");
    return this.purgeVersion(version);
  }

  /**
   * Removes everything deleted before `before` (everything, without it). One item failing does not stop
   * the others; it stays in the trash for the next run. Returns how many were removed and how many failed.
   */
  async purgeAll(before?: Date) {
    const due = (deletedAt: Date | null | undefined) =>
      Boolean(deletedAt) && (!before || deletedAt! <= before);
    let removed = 0;
    let failed = 0;
    const attempt = async (work: () => Promise<void>) => {
      try {
        await work();
        removed += 1;
      } catch {
        failed += 1;
      }
    };
    for (const row of await this.deps.photos.listTrashed())
      if (due(row.deletedAt)) await attempt(() => this.purgePhoto(row));
    // After the photos: their versions went with them.
    for (const version of await this.deps.versions.listTrashed())
      if (due(version.deletedAt)) await attempt(() => this.purgeVersion(version));
    for (const asset of await this.trashedImages())
      if (due(asset.trashedAt)) await attempt(() => this.purgeImage(asset));
    return { removed, failed };
  }

  /** What the retention period has run out for. */
  async purgeExpired() {
    const { trashRetentionDays } = await this.deps.settings();
    return this.purgeAll(new Date(this.deps.now().getTime() - trashRetentionDays * DAY));
  }
}
