import type { PhotoRepository } from "../photos/types";
import type { LocalImageStore } from "../storage/local";
import type { AssetRepository } from "./types";

/**
 * Registers the site-hosted images of photos that are not in the register yet (photos added before it
 * existed). Safe to run again: registered photos are skipped. Returns how many were added.
 */
export async function backfillPhotoAssets(
  photos: PhotoRepository,
  assets: AssetRepository,
  store: LocalImageStore
) {
  const known = new Set(await assets.keys("photo"));
  const rows = await photos.list({ includePrivate: true });
  let added = 0;
  for (const row of rows) {
    if (row.storage !== "local" || !row.storageKey || known.has(row.storageKey)) continue;
    const files = await store.files(row.storageKey);
    // Nothing on disk: the scan reports the photo as missing its files; there is nothing to register.
    if (!files.length) continue;
    const original = files.find((file) => file.name.startsWith("original."));
    await assets.register({
      storageKey: row.storageKey,
      ownerType: "photo",
      ownerId: row.id,
      role: "image",
      originalName: row.source?.type === "upload" ? row.source.ref : null,
      format: original?.name.split(".").pop() ?? "",
      bytes: original?.bytes ?? 0,
      totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
      width: row.width,
      height: row.height,
      variants: row.variants ?? [],
      sha256: original ? await store.hash(row.storageKey, original.name) : null,
      uploadId: null
    });
    added += 1;
  }
  return added;
}
