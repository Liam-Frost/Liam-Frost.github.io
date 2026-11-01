import {
  ANALYTICS_CLEAR_SCOPES,
  ANALYTICS_CONTENT_TYPES,
  ANALYTICS_EXPORTS,
  ANALYTICS_RANGES,
  type AnalyticsAudience,
  type AnalyticsContentCounts,
  type AnalyticsContentDetail,
  type AnalyticsContentReport,
  type AnalyticsHealth,
  type AnalyticsMeta,
  type AnalyticsOverview
} from "@liam-frost/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { AnalyticsRangeError, type AnalyticsService } from "../analytics/service";
import { isDay } from "../analytics/time";
import type { CountryLookup } from "../analytics/geo";
import type { AdminAuthService } from "../auth/service";
import { HttpError, notFound } from "../lib/errors";
import { parseInput } from "../lib/validation";

const day = z.string().refine(isDay, "Invalid day");
const rangeFields = {
  range: z.enum(ANALYTICS_RANGES).default("7d"),
  from: day.optional(),
  to: day.optional()
};
const rangeQuerySchema = z.object(rangeFields).strict();
const contentParamsSchema = z
  .object({
    type: z.enum(ANALYTICS_CONTENT_TYPES),
    id: z.string().regex(/^[A-Za-z0-9_.:-]{1,80}$/, "Invalid id")
  })
  .strict();
const countsQuerySchema = z.object({ type: z.enum(ANALYTICS_CONTENT_TYPES) }).strict();
const exportQuerySchema = z
  .object({
    ...rangeFields,
    dataset: z.enum(ANALYTICS_EXPORTS),
    format: z.enum(["csv", "json"]).default("csv")
  })
  .strict();
const clearQuerySchema = z.object({ scope: z.enum(ANALYTICS_CLEAR_SCOPES) }).strict();

/** Range errors become 400s. */
async function ranged<T>(work: () => Promise<T>) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof AnalyticsRangeError)
      throw new HttpError(400, "INVALID_RANGE", error.message);
    throw error;
  }
}

/**
 * Events from the site (public, rate limited, always answered with 204 so nothing is learned from the
 * answer) and the admin's analytics.
 */
export function registerAnalyticsRoutes(
  app: FastifyInstance,
  auth: AdminAuthService,
  analytics: AnalyticsService | null,
  geo: CountryLookup,
  rateLimitPerMinute: number
) {
  const admin = { preHandler: auth.requireAdmin };
  const requireAnalytics = () => {
    if (!analytics)
      throw new HttpError(
        503,
        "DATABASE_NOT_CONFIGURED",
        "Analytics needs a database (set DATABASE_URL)"
      );
    return analytics;
  };

  // Sent with sendBeacon as text/plain, which needs no CORS preflight; JSON is accepted too.
  app.post(
    "/api/analytics/events",
    {
      bodyLimit: 32 * 1024,
      config: { rateLimit: { max: rateLimitPerMinute, timeWindow: "1 minute" } }
    },
    async (request, reply) => {
      if (analytics) {
        await analytics.ingest(request.body, {
          ip: request.ip,
          userAgent: request.headers["user-agent"],
          host: request.hostname.toLowerCase(),
          country: () => geo.country(request),
          isAdmin: auth.identify(request) !== null
        });
      }
      return reply.code(204).send();
    }
  );

  app.get("/api/admin/analytics/meta", admin, async (): Promise<AnalyticsMeta> => {
    return requireAnalytics().meta();
  });

  app.get("/api/admin/analytics/overview", admin, async (request): Promise<AnalyticsOverview> => {
    const { range, from, to } = parseInput(rangeQuerySchema, request.query);
    return ranged(() => requireAnalytics().overview(range, from, to));
  });

  app.get(
    "/api/admin/analytics/content",
    admin,
    async (request): Promise<AnalyticsContentReport> => {
      const { range, from, to } = parseInput(rangeQuerySchema, request.query);
      return ranged(() => requireAnalytics().content(range, from, to));
    }
  );

  app.get(
    "/api/admin/analytics/content/:type/:id",
    admin,
    async (request): Promise<AnalyticsContentDetail> => {
      const { type, id } = parseInput(contentParamsSchema, request.params);
      const { range, from, to } = parseInput(rangeQuerySchema, request.query);
      const detail = await ranged(() =>
        requireAnalytics().contentDetail(type, id, range, from, to)
      );
      if (!detail) throw notFound("No statistics for this content");
      return detail;
    }
  );

  app.get(
    "/api/admin/analytics/counts",
    admin,
    async (request): Promise<AnalyticsContentCounts> => {
      const { type } = parseInput(countsQuerySchema, request.query);
      return requireAnalytics().contentCounts(type);
    }
  );

  app.get("/api/admin/analytics/audience", admin, async (request): Promise<AnalyticsAudience> => {
    const { range, from, to } = parseInput(rangeQuerySchema, request.query);
    return ranged(() => requireAnalytics().audience(range, from, to));
  });

  app.get("/api/admin/analytics/health", admin, async (request): Promise<AnalyticsHealth> => {
    const { range, from, to } = parseInput(rangeQuerySchema, request.query);
    return ranged(() => requireAnalytics().health(range, from, to));
  });

  app.get("/api/admin/analytics/export", admin, async (request, reply) => {
    const { dataset, format, range, from, to } = parseInput(exportQuerySchema, request.query);
    const file = await ranged(() => requireAnalytics().export(dataset, format, range, from, to));
    reply.header("content-type", file.type);
    reply.header("content-disposition", `attachment; filename="${file.file}"`);
    reply.header("cache-control", "no-store");
    return reply.send(file.body);
  });

  app.delete("/api/admin/analytics/data", admin, async (request, reply) => {
    const { scope } = parseInput(clearQuerySchema, request.query);
    await requireAnalytics().clear(scope);
    request.log.info({ scope }, "Analytics data cleared");
    return reply.code(204).send();
  });
}
