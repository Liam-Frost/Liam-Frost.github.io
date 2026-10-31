import { photos as seedPhotos } from "@liam-frost/content";
import type { FastifyInstance } from "fastify";

import { notFound } from "../lib/errors";
import { parseInput, photoIdSchema } from "../lib/validation";
import { toPublicPhoto } from "../photos/mapping";
import type { PhotoRepository } from "../photos/types";
import type { LocalImageStore } from "../storage/local";

/**
 * Public photo routes. Without a database they serve the shared seed content; if the database is
 * configured but unreachable they fall back to it too, so the site keeps working. An empty database
 * means an empty gallery: once photos are managed in the admin, seed data is not mixed back in.
 */
export function registerPhotoRoutes(app: FastifyInstance, photos: PhotoRepository | null, store: LocalImageStore) {
  app.get("/api/photos", async (request) => {
    if (!photos) return seedPhotos;
    try {
      return (await photos.list()).map((row) => toPublicPhoto(row, store));
    } catch (error) {
      request.log.warn({ error }, "Photo database unavailable; using seed photo data");
      return seedPhotos;
    }
  });

  app.get("/api/photos/:id", async (request) => {
    const { id } = parseInput(photoIdSchema, request.params);
    const fromSeed = () => {
      const photo = seedPhotos.find((p) => p.id === id);
      if (!photo) throw notFound("Photo not found");
      return photo;
    };

    if (!photos) return fromSeed();
    let row;
    try {
      row = await photos.get(id);
    } catch (error) {
      request.log.warn({ error }, "Photo database unavailable; using seed photo data");
      return fromSeed();
    }
    // Hidden photos are indistinguishable from missing ones.
    if (!row || row.visibility !== "public") throw notFound("Photo not found");
    return toPublicPhoto(row, store);
  });
}
