import type { PublicProject, PublicProjectSummary } from "@liam-frost/shared";
import type { FastifyInstance } from "fastify";

import { HttpError, notFound } from "../lib/errors";
import { projectSlugParamsSchema } from "../lib/validation";
import { toPublicProject, toPublicProjectSummary } from "../projects/mapping";
import type { ProjectRepository } from "../projects/types";
import type { LocalImageStore } from "../storage/local";

/**
 * Public project routes. Projects only exist in the database: without one (or when it is unreachable)
 * the list is empty, and the site hides its project sections.
 */
export function registerProjectRoutes(app: FastifyInstance, projects: ProjectRepository | null, store: LocalImageStore) {
  app.get("/api/projects", async (request): Promise<PublicProjectSummary[]> => {
    if (!projects) return [];
    try {
      return (await projects.list()).map((row) => toPublicProjectSummary(row, store));
    } catch (error) {
      request.log.warn({ error }, "Project database unavailable");
      return [];
    }
  });

  app.get("/api/projects/:slug", async (request): Promise<PublicProject> => {
    const parsed = projectSlugParamsSchema.safeParse(request.params);
    if (!parsed.success || !projects) throw notFound("Project not found");
    let row;
    try {
      row = await projects.getBySlug(parsed.data.slug);
    } catch (error) {
      request.log.warn({ error }, "Project database unavailable");
      throw new HttpError(503, "UNAVAILABLE", "Projects are temporarily unavailable");
    }
    // Hidden projects are indistinguishable from missing ones.
    if (!row || row.visibility !== "public") throw notFound("Project not found");
    return toPublicProject(row, store);
  });
}
