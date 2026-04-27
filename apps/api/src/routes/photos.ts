import type { FastifyInstance } from "fastify";
import { photos } from "@liam-frost/content";

export function registerPhotoRoutes(app: FastifyInstance) {
  app.get("/api/photos", async () => photos);

  app.get<{ Params: { id: string } }>("/api/photos/:id", async (request, reply) => {
    const photo = photos.find((item) => item.id === request.params.id);
    if (!photo) {
      return reply.code(404).send({ message: "Photo not found" });
    }
    return photo;
  });
}
