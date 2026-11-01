import { ANALYTICS_RANGES, type AnalyticsMeta, type AnalyticsOverview } from "@liam-frost/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { AnalyticsRangeError, type AnalyticsService } from "../analytics/service";
import { isDay } from "../analytics/time";
import type { CountryLookup } from "../analytics/geo";
import type { AdminAuthService } from "../auth/service";
import { HttpError } from "../lib/errors";
import { parseInput } from "../lib/validation";

const day = z.string().refine(isDay, "Invalid day");
const rangeQuerySchema = z
  .object({
    range: z.enum(ANALYTICS_RANGES).default("7d"),
    from: day.optional(),
    to: day.optional()
  })
  .strict();

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
    try {
      return await requireAnalytics().overview(range, from, to);
    } catch (error) {
      if (error instanceof AnalyticsRangeError)
        throw new HttpError(400, "INVALID_RANGE", error.message);
      throw error;
    }
  });
}
