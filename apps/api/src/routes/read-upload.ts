import type { FastifyRequest } from "fastify";

import { badRequest, HttpError } from "../lib/errors";
import { InvalidImageError, processImage, type ProcessedImage } from "../photos/images";

/**
 * Reads the single multipart file of an admin upload and processes it. Maps the failure modes to API errors:
 * not multipart / no file (400), over UPLOAD_MAX_MB (413), interrupted (400), not a supported image (400).
 */
export async function readUploadedImage(
  request: FastifyRequest,
  maxBytes: number
): Promise<{ fileName: string; image: ProcessedImage; bytes: number }> {
  if (!request.isMultipart()) throw badRequest("Upload the image as multipart/form-data");
  const file = await request.file({ limits: { fileSize: maxBytes, files: 1, fields: 0 } });
  if (!file) throw badRequest("Choose an image to upload");

  let input: Buffer;
  try {
    input = await file.toBuffer();
  } catch (error) {
    if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
      throw new HttpError(
        413,
        "FILE_TOO_LARGE",
        `Images must be at most ${Math.round(maxBytes / 1024 / 1024)} MB`
      );
    }
    throw badRequest("The upload was interrupted; try again", "UPLOAD_INTERRUPTED");
  }

  try {
    return { fileName: file.filename, image: await processImage(input), bytes: input.length };
  } catch (error) {
    if (error instanceof InvalidImageError) throw badRequest(error.message, "INVALID_IMAGE");
    throw error;
  }
}
