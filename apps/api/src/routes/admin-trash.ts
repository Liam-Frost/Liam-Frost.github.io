import type { AdminTrashResponse } from "@liam-frost/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";

import type { AdminAuthService } from "../auth/service";
import { HttpError, notFound } from "../lib/errors";
import { parseInput, trashItemParamsSchema } from "../lib/validation";
import type { PhotoTrash } from "../photos/trash";

/** The trash page: what is in it, restoring, and removing for good. */
export function registerAdminTrashRoutes(
  app: FastifyInstance,
  auth: AdminAuthService,
  trash: PhotoTrash | null
) {
  const admin = { preHandler: auth.requireAdmin };
  const bin = () => {
    if (!trash)
      throw new HttpError(
        503,
        "DATABASE_NOT_CONFIGURED",
        "The trash needs a database (set DATABASE_URL)"
      );
    return trash;
  };
  const item = (request: FastifyRequest) => parseInput(trashItemParamsSchema, request.params);

  app.get("/api/admin/trash", admin, async (): Promise<AdminTrashResponse> => bin().list());

  app.get("/api/admin/trash/:kind/:id/thumbnail", admin, async (request, reply) => {
    const { kind, id } = item(request);
    const data = await bin().thumbnailFile(kind, id);
    if (!data) throw notFound();
    reply.header("content-type", "image/webp");
    reply.header("cache-control", "private, no-store");
    return reply.send(data);
  });

  app.post(
    "/api/admin/trash/:kind/:id/restore",
    admin,
    async (request): Promise<AdminTrashResponse> => {
      const { kind, id } = item(request);
      await bin().restore(kind, id);
      request.log.info({ kind, id, by: request.adminUser?.username }, "Restored from the trash");
      return bin().list();
    }
  );

  app.delete("/api/admin/trash/:kind/:id", admin, async (request): Promise<AdminTrashResponse> => {
    const { kind, id } = item(request);
    await bin().purge(kind, id);
    request.log.info(
      { kind, id, by: request.adminUser?.username },
      "Removed from the trash for good"
    );
    return bin().list();
  });

  /** Empties the trash. Items whose files could not be removed stay and are reported. */
  app.delete("/api/admin/trash", admin, async (request): Promise<AdminTrashResponse> => {
    const result = await bin().purgeAll();
    request.log.info({ ...result, by: request.adminUser?.username }, "Trash emptied");
    return bin().list();
  });
}
