import type { MediaRepository } from "../media/types";
import type { PersonRepository } from "../people/types";
import type { PhotoRepository } from "../photos/types";
import type { ProjectRepository, StoredImage } from "../projects/types";
import { brandKey, type BrandingStore } from "../site/branding";
import type { StackRepository } from "../stack/types";
import { BRAND_SLOTS } from "@liam-frost/shared";
import { ownerOfKey } from "./ledger";
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

export type SectionRepositories = {
  projects: ProjectRepository | null;
  media: MediaRepository | null;
  people: PersonRepository | null;
  stack: StackRepository | null;
  branding: BrandingStore | null;
};

/**
 * Registers the images of the other sections that are not in the register yet: project covers and
 * screenshots, posters, people's photos, custom stack icons and brand files. Safe to run again.
 */
export async function backfillSectionAssets(
  sections: SectionRepositories,
  assets: AssetRepository,
  store: LocalImageStore
) {
  const images: Pick<StoredImage, "key" | "width" | "height" | "variants">[] = [];
  const add = (image: StoredImage | null | undefined) => {
    if (image) images.push(image);
  };
  for (const row of (await sections.projects?.list({ includePrivate: true })) ?? []) {
    add(row.cover);
    row.gallery.forEach(add);
  }
  for (const row of (await sections.media?.list({ includePrivate: true })) ?? []) add(row.poster);
  for (const row of (await sections.people?.list({ includePrivate: true })) ?? []) add(row.photo);
  for (const category of (await sections.stack?.list()) ?? [])
    for (const technology of category.technologies) add(technology.customIcon);
  const brand = await sections.branding?.get();
  if (brand)
    for (const slot of BRAND_SLOTS) {
      const file = brand[slot];
      if (file)
        images.push({
          key: brandKey(slot, file.id),
          width: file.width,
          height: file.height,
          variants: []
        });
    }

  const known = new Set((await assets.all()).map((asset) => asset.storageKey));
  let added = 0;
  for (const image of images) {
    const owner = ownerOfKey(image.key);
    if (!owner || known.has(image.key)) continue;
    const files = await store.files(image.key);
    if (!files.length) continue;
    const original = files.find((file) => file.name.startsWith("original."));
    // Logos and icons are one file: that file is the original.
    const main = original ?? (files.length === 1 ? files[0] : undefined);
    await assets.register({
      ...owner,
      storageKey: image.key,
      role: "image",
      originalName: null,
      format: main?.name.split(".").pop() ?? "",
      bytes: main?.bytes ?? 0,
      totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
      width: image.width,
      height: image.height,
      variants: original ? image.variants : [],
      sha256: main ? await store.hash(image.key, main.name) : null,
      uploadId: null
    });
    known.add(image.key);
    added += 1;
  }
  return added;
}
