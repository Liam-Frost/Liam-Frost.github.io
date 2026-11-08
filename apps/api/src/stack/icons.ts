import type { FastifyRequest } from "fastify";
import sharp from "sharp";

import { badRequest, HttpError } from "../lib/errors";

/** Uploaded logos are small; a larger file is almost certainly not a logo. */
export const MAX_ICON_BYTES = 2 * 1024 * 1024;
/** Logos are stored as one WebP whose longest edge is this (sharp enough at 40 px on 3x screens). */
export const ICON_SIZE = 256;

const ACCEPTED_TYPES = new Set(["image/svg+xml", "image/png", "image/webp"]);
const ACCEPTED_FORMATS = new Set(["svg", "png", "webp"]);

export type IconOptions = {
  /** Longest edge of the stored image. */
  size?: number;
  /** Also take JPEG (site logos and icons, which may come from a design tool or a photo). */
  allowJpeg?: boolean;
  /** Fit into a transparent square of `size` (site icons), keeping the whole image visible. */
  square?: boolean;
};

/**
 * SVG features a logo never needs: scripts, event handlers, embedded HTML, entities (XXE, billion
 * laughs) and references to anything outside the file. Rejected before the SVG is parsed at all.
 */
const UNSAFE_SVG =
  /<!DOCTYPE|<!ENTITY|<script|<foreignObject|<iframe|<embed|<object|\son[a-z]+\s*=|javascript:|(?:xlink:)?href\s*=\s*["']\s*(?!#|data:image\/(?:png|jpeg|webp);base64,)/i;

export class InvalidIconError extends Error {}

/**
 * Validates an uploaded logo and renders it to a transparent WebP. SVGs are rasterised, never stored
 * or served as SVG, so whatever markup a file carries cannot reach a visitor's browser. Aspect ratio
 * is kept; the logo is never stretched.
 */
export async function processIcon(input: Buffer, mimeType: string, options: IconOptions = {}) {
  const size = options.size ?? ICON_SIZE;
  const jpeg = Boolean(options.allowJpeg) && mimeType === "image/jpeg";
  if (!ACCEPTED_TYPES.has(mimeType) && !jpeg)
    throw new InvalidIconError(
      options.allowJpeg ? "仅支持 SVG、PNG、WebP 或 JPEG 图片" : "仅支持 SVG、PNG 或 WebP 图标"
    );
  const isSvg = mimeType === "image/svg+xml";
  if (isSvg && UNSAFE_SVG.test(input.toString("utf8")))
    throw new InvalidIconError("SVG 含有脚本、外部引用或其它不允许的内容");

  let meta;
  try {
    meta = await sharp(input, { failOn: "error", limitInputPixels: 25_000_000 }).metadata();
  } catch {
    throw new InvalidIconError("无法识别的图标文件");
  }
  // The content decides, not the name or the declared type.
  const formatOk = jpeg
    ? meta.format === "jpeg"
    : Boolean(meta.format) &&
      ACCEPTED_FORMATS.has(meta.format!) &&
      (meta.format === "svg") === isSvg;
  if (!formatOk) throw new InvalidIconError("文件内容和类型不符，请上传 SVG、PNG 或 WebP 图标");
  if (!meta.width || !meta.height) throw new InvalidIconError("无法读取图标尺寸");

  // Vectors render at the target size; raster logos are only ever scaled down.
  const density = isSvg
    ? Math.min(2400, Math.max(1, (72 * size) / Math.max(meta.width, meta.height)))
    : undefined;
  const { data, info } = await sharp(input, {
    failOn: "error",
    limitInputPixels: 25_000_000,
    animated: false,
    ...(density ? { density } : {})
  })
    .resize(
      size,
      size,
      options.square
        ? { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }
        : { fit: "inside", withoutEnlargement: !isSvg }
    )
    .webp({ quality: 90, alphaQuality: 100 })
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
}

/** Reads the single multipart file of a logo upload, mapping failures to API errors. */
export async function readUploadedIcon(request: FastifyRequest, options: IconOptions = {}) {
  if (!request.isMultipart()) throw badRequest("Upload the icon as multipart/form-data");
  const file = await request.file({ limits: { fileSize: MAX_ICON_BYTES, files: 1, fields: 0 } });
  if (!file) throw badRequest("Choose an icon to upload");
  let input: Buffer;
  try {
    input = await file.toBuffer();
  } catch (error) {
    if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE")
      throw new HttpError(413, "FILE_TOO_LARGE", "图标不能超过 2 MB");
    throw badRequest("The upload was interrupted; try again", "UPLOAD_INTERRUPTED");
  }
  try {
    return { icon: await processIcon(input, file.mimetype, options), bytes: input.length };
  } catch (error) {
    if (error instanceof InvalidIconError) throw badRequest(error.message, "INVALID_IMAGE");
    throw error;
  }
}
