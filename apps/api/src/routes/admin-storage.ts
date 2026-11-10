import type { AdminStorageOverview } from "@liam-frost/shared";
import type { FastifyInstance } from "fastify";

import type { StorageManager } from "../assets/storage";
import type { AdminAuthService } from "../auth/service";
import { HttpError, notFound } from "../lib/errors";
import { parseInput, storageKeySchema } from "../lib/validation";

/** 文件管理: storage totals, the consistency scan and its repairs. */
export function registerAdminStorageRoutes(
  app: FastifyInstance,
  auth: AdminAuthService,
  storage: StorageManager | null
) {
  const admin = { preHandler: auth.requireAdmin };
  const manager = () => {
    if (!storage)
      throw new HttpError(
        503,
        "DATABASE_NOT_CONFIGURED",
        "File management needs a database (set DATABASE_URL)"
      );
    return storage;
  };
  const key = (input: unknown) => parseInput(storageKeySchema, input).key;

  app.get("/api/admin/storage", admin, async (): Promise<AdminStorageOverview> =>
    manager().overview()
  );

  /** Compares the disk with the database. Reports only; nothing is changed. */
  app.post("/api/admin/storage/scan", admin, async (request): Promise<AdminStorageOverview> => {
    const scan = await manager().scan();
    request.log.info(
      {
        orphans: scan.orphans.length,
        missing: scan.missing.length,
        incomplete: scan.incomplete.length,
        by: request.adminUser?.username
      },
      "Storage scanned"
    );
    return manager().overview();
  });

  app.get("/api/admin/storage/orphans/preview", admin, async (request, reply) => {
    const preview = await manager().orphanPreview(key(request.query));
    if (!preview) throw notFound();
    reply.header("content-type", "image/webp");
    reply.header("cache-control", "private, no-store");
    return reply.send(preview);
  });

  app.post(
    "/api/admin/storage/orphans/delete",
    admin,
    async (request): Promise<AdminStorageOverview> => {
      const folder = key(request.body);
      await manager().deleteOrphan(folder);
      request.log.info({ key: folder, by: request.adminUser?.username }, "Orphan folder deleted");
      return manager().overview();
    }
  );

  /** Renders an image's sizes again from its original. */
  app.post(
    "/api/admin/storage/regenerate",
    admin,
    async (request): Promise<AdminStorageOverview> => {
      const folder = key(request.body);
      await manager().regenerate(folder);
      request.log.info({ key: folder, by: request.adminUser?.username }, "Image sizes regenerated");
      return manager().overview();
    }
  );
}
