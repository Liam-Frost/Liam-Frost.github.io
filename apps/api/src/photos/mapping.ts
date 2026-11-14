import type { Photo } from "@liam-frost/content";
import type { AdminPhoto, AdminPhotoVersion, PhotoVariantInfo } from "@liam-frost/shared";

import type { AssetRow } from "../assets/types";
import type { LocalImageStore } from "../storage/local";
import type { PhotoRow } from "./types";
import type { ImageFields, VersionRow } from "./versions";

export function variantFileName(width: number) {
  return `${width}.webp`;
}

function variantUrls(row: ImageFields, store: LocalImageStore): PhotoVariantInfo[] {
  if (row.storage !== "local" || !row.storageKey || !row.variants) return [];
  const key = row.storageKey;
  return row.variants.map((v) => ({ ...v, url: store.publicUrl(key, variantFileName(v.width)) }));
}

/** Flickr static URLs end in "_<size>.<ext>"; "_n" (320px) is plenty for admin lists. */
export function remoteThumbnail(src: string) {
  return src.replace(
    /^(https:\/\/live\.staticflickr\.com\/\d+\/\d+_[a-z0-9]+)(?:_[a-z0-9]{1,2})?\.(jpe?g|png)$/i,
    "$1_n.$2"
  );
}

function optional<T>(value: T | null): T | undefined {
  return value ?? undefined;
}

/** Shape used by the public site; matches the content package's Photo. */
export function toPublicPhoto(row: PhotoRow, store: LocalImageStore): Photo {
  const variants = variantUrls(row, store);
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    category: row.category,
    location: optional(row.location),
    camera: optional(row.camera),
    lens: optional(row.lens),
    settings: optional(row.settings),
    description: optional(row.description),
    tags: row.tags,
    src: variants.at(-1)?.url ?? row.src,
    alt: row.alt,
    width: row.width,
    height: row.height,
    featured: row.featured,
    ...(variants.length ? { variants } : {})
  };
}

/** A version for the editor; `asset` is its register entry, when it is site-hosted and registered. */
export function toAdminVersion(
  version: VersionRow,
  current: boolean,
  store: LocalImageStore,
  asset: AssetRow | null
): AdminPhotoVersion {
  const variants = variantUrls(version, store);
  return {
    id: version.id,
    label: version.label,
    current,
    storage: version.storage,
    src: variants.at(-1)?.url ?? version.src,
    thumbnail: variants[0]?.url ?? remoteThumbnail(version.src),
    width: version.width,
    height: version.height,
    source: version.source,
    createdAt: version.createdAt.toISOString(),
    format: asset?.format || null,
    bytes: asset?.bytes ?? null
  };
}

export function toAdminPhoto(row: PhotoRow, store: LocalImageStore): AdminPhoto {
  const variants = variantUrls(row, store);
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    category: row.category,
    location: row.location,
    camera: row.camera,
    lens: row.lens,
    settings: row.settings,
    description: row.description,
    tags: row.tags,
    alt: row.alt,
    width: row.width,
    height: row.height,
    src: variants.at(-1)?.url ?? row.src,
    thumbnail: variants[0]?.url ?? remoteThumbnail(row.src),
    storage: row.storage,
    variants,
    source: row.source,
    visibility: row.visibility,
    featured: row.featured,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}
