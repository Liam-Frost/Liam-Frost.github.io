import type { FastifyInstance } from "fastify";

import { getPhoto, listPhotos } from "../db/photos";

export function registerPhotoRoutes(app: FastifyInstance) {
  app.get("/api/photos", async (request) => listPhotos(request.log));

  app.get<{ Params: { id: string } }>("/api/photos/:id", async (request, reply) => {
    const photo = await getPhoto(request.params.id, request.log);
    if (!photo) {
      return reply.code(404).send({ message: "Photo not found" });
    }
    return photo;
  });
}
