import type { FastifyInstance } from "fastify";

import { getPhoto, listPhotos } from "../db/photos";
import { notFound } from "../lib/errors";
import { parseInput, photoParamsSchema } from "../lib/validation";

export function registerPhotoRoutes(app: FastifyInstance) {
  app.get("/api/photos", async (request) => listPhotos(request.log));

  app.get("/api/photos/:id", async (request) => {
    const { id } = parseInput(photoParamsSchema, request.params);
    const photo = await getPhoto(id, request.log);
    if (!photo) {
      throw notFound("Photo not found");
    }
    return photo;
  });
}
