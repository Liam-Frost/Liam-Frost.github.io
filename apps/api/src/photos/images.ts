import { createHash } from "node:crypto";
import { availableParallelism } from "node:os";
import sharp from "sharp";

import { describeImage } from "../assets/describe";
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
  /** The untouched input: its bytes, or the path of the temporary file it was received into. */
  original: {
    source: Buffer | string;
    extension: string;
    bytes: number;
    /** SHA-256 of the original, hex. */
    sha256: string;
  };
  exif: ExifSuggestions;
  /** Where the processing time went, for the upload log. */
  timings: { waitMs: number; decodeMs: number; encodeMs: number };
};

/**
 * Images processed at once. sharp already spreads one image over the cores, so more than this only
 * multiplies the memory held by decoded images.
 */
const PROCESS_SLOTS = Math.min(4, Math.max(1, Math.floor(availableParallelism() / 2)));
let busy = 0;
const waiting: (() => void)[] = [];

async function withSlot<T>(work: () => Promise<T>): Promise<T> {
  if (busy >= PROCESS_SLOTS) await new Promise<void>((resolve) => waiting.push(resolve));
  else busy += 1;
  try {
    return await work();
  } finally {
    // A waiter takes the slot over directly, so `busy` stays the same.
    const next = waiting.shift();
    if (next) next();
    else busy -= 1;
  }
}

/**
 * Validates an upload and renders WebP sizes. Outputs are auto-oriented and carry no metadata
 * (sharp drops EXIF, including GPS). The original is returned unchanged for private storage.
 */
/** Validates an image and reads its displayed size (after EXIF orientation) and EXIF suggestions. */
async function readImage(input: Buffer | string) {
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
  return {
    meta,
    width: rotated ? meta.height : meta.width,
    height: rotated ? meta.width : meta.height,
    exif: readExif(meta.exif)
  };
}

/** Size and EXIF of an image that is shown from its own address (not processed or stored). */
export async function inspectImage(input: Buffer) {
  const { width, height, exif } = await readImage(input);
  return { width, height, exif };
}

/** An image received into a file, with what was measured while receiving it. */
export type ReceivedFile = { path: string; bytes: number; sha256: string };

/** `source` is the image's bytes, or the file an upload was received into. */
export async function processImage(source: Buffer | ReceivedFile): Promise<ProcessedImage> {
  const queued = performance.now();
  return withSlot(() => renderImage(source, performance.now() - queued));
}

async function renderImage(source: Buffer | ReceivedFile, waitMs: number): Promise<ProcessedImage> {
  const started = performance.now();
  const input = Buffer.isBuffer(source) ? source : source.path;
  const measured = Buffer.isBuffer(source)
    ? { bytes: source.length, sha256: createHash("sha256").update(source).digest("hex") }
    : { bytes: source.bytes, sha256: source.sha256 };
  const { meta, width, height, exif } = await readImage(input);
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
  const decoded = performance.now();

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
    original: { source: input, extension: ORIGINAL_EXTENSIONS[meta.format!]!, ...measured },
    exif,
    timings: {
      waitMs: Math.round(waitMs),
      decodeMs: Math.round(decoded - started),
      encodeMs: Math.round(performance.now() - decoded)
    }
  };
}

/**
 * Writes every generated size and the private original under `key`, all or nothing: an interrupted save
 * leaves no partial folder. Callers remove `key` on later failures.
 */
export async function saveImage(store: LocalImageStore, key: string, image: ProcessedImage) {
  await store.writeAll(key, [
    ...image.variants.map((variant) => ({
      name: variantFileName(variant.width),
      data: variant.data
    })),
    { name: `original.${image.original.extension}`, data: image.original.source }
  ]);
  // Photos are registered by their routes, with the upload's details; the ledger skips them.
  await store.ledger?.saved(key, describeImage(image));
}
