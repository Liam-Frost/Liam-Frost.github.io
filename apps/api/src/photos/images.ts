import sharp from "sharp";

import { readExif, type ExifSuggestions } from "./exif";

// Keep file handles short-lived (Windows cannot delete files sharp still holds).
sharp.cache(false);

/** Longest-edge sizes generated for every upload (never larger than the original). */
export const VARIANT_SIZES = [640, 1280, 2048, 3072];

const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "tiff"]);
const ORIGINAL_EXTENSIONS: Record<string, string> = { jpeg: "jpg", png: "png", webp: "webp", avif: "avif", tiff: "tif" };

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
  const variants = [];
  for (const size of sizes) {
    const { data, info } = await sharp(input, { failOn: "error", limitInputPixels: MAX_PIXELS, animated: false })
      .rotate()
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
