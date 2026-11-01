import sharp from "sharp";

import type { LocalImageStore } from "../storage/local";
import { readExif, type ExifSuggestions } from "./exif";
import { variantFileName } from "./mapping";

// Keep file handles short-lived (Windows cannot delete files sharp still holds).
sharp.cache(false);

/** Longest-edge sizes generated for every upload (never larger than the original). */
export const VARIANT_SIZES = [640, 1280, 2048, 3072];

const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "tiff"]);
const ORIGINAL_EXTENSIONS: Record<string, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  avif: "avif",
  tiff: "tif"
};

/** 120 megapixels: generous for camera files, but stops decompression bombs. */
const MAX_PIXELS = 120_000_000;

export class InvalidImageError extends Error {}

/** sharp 0.35 no longer exports its namespace types; derive the metadata type from the API. */
type ImageMetadata = Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;

export type ProcessedImage = {
  /** Display size after applying EXIF orientation. */
  width: number;
  height: number;
  variants: { width: number; height: number; data: Buffer }[];
  original: { data: Buffer; extension: string };
  exif: ExifSuggestions;
};

/**
 * Validates an upload and renders WebP sizes. Outputs are auto-oriented and carry no metadata
 * (sharp drops EXIF, including GPS). The original is returned unchanged for private storage.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  let meta: ImageMetadata;
  try {
    meta = await sharp(input, { failOn: "error", limitInputPixels: MAX_PIXELS }).metadata();
  } catch {
    throw new InvalidImageError("无法识别的图片，请上传 JPEG、PNG、WebP、AVIF 或 TIFF 图片");
  }
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format) || !meta.width || !meta.height) {
    throw new InvalidImageError("仅支持 JPEG、PNG、WebP、AVIF 或 TIFF 图片");
  }

  // EXIF orientations 5-8 rotate by 90°, swapping the displayed width and height.
  const rotated = (meta.orientation ?? 1) >= 5;
  const width = rotated ? meta.height : meta.width;
  const height = rotated ? meta.width : meta.height;
  const longest = Math.max(width, height);

  const sizes = [...new Set(VARIANT_SIZES.map((size) => Math.min(size, longest)))];
  const largest = sizes[sizes.length - 1];

  // Decode, rotate and downscale the original once; every size is rendered from that smaller raw image.
  const base = await sharp(input, {
    failOn: "error",
    limitInputPixels: MAX_PIXELS,
    animated: false
  })
    .rotate()
    .resize(largest, largest, { fit: "inside", withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const raw = { width: base.info.width, height: base.info.height, channels: base.info.channels };

  const variants = [];
  for (const size of sizes) {
    const { data, info } = await sharp(base.data, { raw })
      .resize(size, size, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    variants.push({ width: info.width, height: info.height, data });
  }

  return {
    width,
    height,
    variants,
    original: { data: input, extension: ORIGINAL_EXTENSIONS[meta.format] },
    exif: readExif(meta.exif)
  };
}

/** Writes every generated size and the private original under `key`. Callers remove `key` on later failures. */
export async function saveImage(store: LocalImageStore, key: string, image: ProcessedImage) {
  for (const variant of image.variants) {
    await store.write(key, variantFileName(variant.width), variant.data);
  }
  await store.write(key, `original.${image.original.extension}`, image.original.data);
}
