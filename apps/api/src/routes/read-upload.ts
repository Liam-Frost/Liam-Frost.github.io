import type { FastifyInstance, FastifyRequest } from "fastify";
import { createWriteStream } from "node:fs";
import { rm, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";

import { badRequest, HttpError } from "../lib/errors";
import { InvalidImageError, processImage, type ProcessedImage } from "../photos/images";
import type { LocalImageStore } from "../storage/local";

/** Temporary files of uploads being handled; saving the image moves the file away. */
const received = new WeakMap<FastifyRequest, string[]>();

/** Removes a request's leftover upload files once it is answered or dropped. */
export function registerUploadCleanup(app: FastifyInstance) {
  const discard = async (request: FastifyRequest) => {
    const files = received.get(request);
    if (!files) return;
    received.delete(request);
    for (const file of files) await rm(file, { force: true }).catch(() => undefined);
  };
  app.addHook("onResponse", discard);
  app.addHook("onRequestAbort", discard);
}

/**
 * Receives the single multipart file of an admin upload into a temporary file (never whole in memory)
 * and processes it. Maps the failure modes to API errors: not multipart / no file (400), over
 * UPLOAD_MAX_MB (413), interrupted (400), not a supported image (400).
 */
export async function readUploadedImage(
  request: FastifyRequest,
  maxBytes: number,
  store: LocalImageStore
): Promise<{ fileName: string; image: ProcessedImage; bytes: number; receiveMs: number }> {
  if (!request.isMultipart()) throw badRequest("Upload the image as multipart/form-data");
  const started = performance.now();
  const file = await request.file({ limits: { fileSize: maxBytes, files: 1, fields: 0 } });
  if (!file) throw badRequest("Choose an image to upload");

  const path = await store.tempFile();
  received.set(request, [...(received.get(request) ?? []), path]);
  try {
    await pipeline(file.file, createWriteStream(path));
  } catch {
    throw badRequest("The upload was interrupted; try again", "UPLOAD_INTERRUPTED");
  }
  if (file.file.truncated) {
    throw new HttpError(
      413,
      "FILE_TOO_LARGE",
      `Images must be at most ${Math.round(maxBytes / 1024 / 1024)} MB`
    );
  }
  const { size } = await stat(path);
  const receiveMs = Math.round(performance.now() - started);

  try {
    return { fileName: file.filename, image: await processImage(path), bytes: size, receiveMs };
  } catch (error) {
    if (error instanceof InvalidImageError) throw badRequest(error.message, "INVALID_IMAGE");
    throw error;
  }
}
