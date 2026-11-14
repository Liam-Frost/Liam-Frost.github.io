import type { ProcessedImage } from "../photos/images";
import type { NewAsset } from "./types";

/** What the register records about an image's files, known once it has been processed. */
export type ImageDetails = Pick<
  NewAsset,
  "format" | "bytes" | "totalBytes" | "width" | "height" | "variants" | "sha256"
>;

export function describeImage(image: ProcessedImage): ImageDetails {
  return {
    format: image.original.extension,
    bytes: image.original.bytes,
    totalBytes:
      image.original.bytes + image.variants.reduce((sum, variant) => sum + variant.data.length, 0),
    width: image.width,
    height: image.height,
    variants: image.variants.map(({ width, height }) => ({ width, height })),
    sha256: image.original.sha256
  };
}
