import {
  DEFAULT_ABOUT,
  toPublicAbout,
  type AdminAboutResponse,
  type PublicAbout
} from "@liam-frost/shared";
import type { FastifyInstance } from "fastify";

import type { AboutStore } from "../about/store";
import type { AdminAuthService } from "../auth/service";
import { HttpError } from "../lib/errors";
import { aboutUpdateSchema, parseInput } from "../lib/validation";

/**
 * The home page's about section. Public: GET /api/about, the visible manifestos and gear (the
 * defaults when nothing is saved or the database is unreachable). Admin: read and save the whole
 * content at once.
 */
export function registerAboutRoutes(
  app: FastifyInstance,
  auth: AdminAuthService,
  about: AboutStore | null
) {
  app.get("/api/about", async (request): Promise<PublicAbout> => {
    if (!about) return toPublicAbout(DEFAULT_ABOUT);
    try {
      return toPublicAbout((await about.get()).about);
    } catch (error) {
      request.log.warn({ error }, "About content unavailable; serving the defaults");
      return toPublicAbout(DEFAULT_ABOUT);
    }
  });

  const store = () => {
    if (!about)
      throw new HttpError(
        503,
        "DATABASE_NOT_CONFIGURED",
        "About section management needs a database (set DATABASE_URL)"
      );
    return about;
  };
  const admin = { preHandler: auth.requireAdmin };

  app.get("/api/admin/about", admin, (): Promise<AdminAboutResponse> => store().get());

  app.put("/api/admin/about", admin, async (request): Promise<AdminAboutResponse> => {
    const { about: content, revision } = parseInput(aboutUpdateSchema, request.body);
    const result = await store().save(content, revision);
    if (result === "conflict")
      throw new HttpError(
        409,
        "ABOUT_OUT_OF_DATE",
        "The about section was saved elsewhere; reload and try again"
      );
    request.log.info(
      {
        manifestos: content.manifestos.length,
        gearCategories: content.gear.length,
        by: request.adminUser?.username
      },
      "About section saved"
    );
    return result;
  });
}
