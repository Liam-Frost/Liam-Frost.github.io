import type { SteamAccountStatus, SteamSyncJob } from "@liam-frost/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { AdminAuthService } from "../auth/service";
import { HttpError, notFound } from "../lib/errors";
import { parseInput, spotifyConnectSchema } from "../lib/validation";
import { SourceError } from "../media/sources";
import type { SteamAccount } from "../steam/account";
import type { SteamSync } from "../steam/sync";

const callbackQuerySchema = z.object({ state: z.string().regex(/^[0-9a-f]{32}$/) }).passthrough();
const jobParamsSchema = z.object({ id: z.string().regex(/^[0-9a-f]{16}$/, "Invalid job id") });

/** Connecting the admin's Steam account and syncing its library into the collection. */
export function registerSteamRoutes(app: FastifyInstance, auth: AdminAuthService, account: SteamAccount, sync: SteamSync | null) {
  const admin = { preHandler: auth.requireAdmin };
  const requireSync = () => {
    if (!sync) throw new HttpError(503, "DATABASE_NOT_CONFIGURED", "The Steam sync needs a database (set DATABASE_URL)");
    return sync;
  };

  app.get("/api/admin/steam/account", admin, async (): Promise<SteamAccountStatus> => account.status());

  /** Starts "Sign in through Steam": the browser goes to Steam, back to the callback, then to `returnTo`. */
  app.post("/api/admin/steam/connect", admin, async (request): Promise<{ url: string }> => {
    requireSync();
    const { returnTo } = parseInput(spotifyConnectSchema, request.body);
    try {
      return { url: account.signInUrl(returnTo, `${request.protocol}://${request.host}/api/admin/steam/callback`) };
    } catch (error) {
      if (error instanceof SourceError) throw new HttpError(502, "SOURCE_ERROR", error.message);
      throw error;
    }
  });

  /** Steam sends the browser here without the admin cookie; the one-time state authorizes it. */
  app.get("/api/admin/steam/callback", async (request, reply) => {
    const query = callbackQuerySchema.safeParse(request.query);
    const entry = query.success ? account.takeState(query.data.state) : null;
    if (!query.success || !entry) {
      reply.code(400).type("text/plain; charset=utf-8");
      return "This Steam sign-in link has expired. Start again from the admin.";
    }
    const back = new URL(entry.returnTo);
    try {
      const params = Object.fromEntries(Object.entries(query.data).filter((pair): pair is [string, string] => typeof pair[1] === "string"));
      await account.complete(params, entry.callbackUrl);
      back.searchParams.set("steam", "connected");
    } catch (error) {
      request.log.warn({ err: error }, "Steam sign-in failed");
      back.searchParams.set("steam", "error");
      back.searchParams.set("reason", error instanceof SourceError ? error.message : "登录失败");
    }
    return reply.redirect(back.toString());
  });

  app.delete("/api/admin/steam/account", admin, async (_request, reply) => {
    await account.disconnect();
    return reply.code(204).send();
  });

  /** Starts a library sync in the background (or returns the one running). */
  app.post("/api/admin/steam/sync", admin, async (_request, reply): Promise<{ job: SteamSyncJob }> => {
    const job = requireSync().start();
    reply.code(202);
    return { job };
  });

  app.get("/api/admin/steam/jobs/:id", admin, async (request): Promise<{ job: SteamSyncJob }> => {
    const job = requireSync().get(parseInput(jobParamsSchema, request.params).id);
    if (!job) throw notFound("Sync not found");
    return { job };
  });
}
