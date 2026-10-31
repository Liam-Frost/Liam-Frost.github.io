import type { AdminSpotifyResponse, PublicSpotifyPlayer } from "@liam-frost/shared";
import type { FastifyInstance } from "fastify";

import type { AdminAuthService } from "../auth/service";
import { HttpError } from "../lib/errors";
import { parseInput } from "../lib/validation";
import { spotifySettingsSchema, type SpotifyService } from "../spotify/service";

/**
 * The site's Spotify player. The public route works without a database (default settings, playlist
 * cached in memory); changing settings needs one so they survive restarts.
 */
export function registerSpotifyRoutes(app: FastifyInstance, auth: AdminAuthService, spotify: SpotifyService, persistent: boolean) {
  const admin = { preHandler: auth.requireAdmin };
  const requirePersistent = () => {
    if (!persistent) {
      throw new HttpError(503, "DATABASE_NOT_CONFIGURED", "Music settings need a database (set DATABASE_URL)");
    }
  };
  const respond = async (): Promise<AdminSpotifyResponse> => ({ settings: await spotify.settings(), sync: await spotify.status() });

  app.get("/api/spotify/player", async (): Promise<PublicSpotifyPlayer> => spotify.player());

  app.get("/api/admin/spotify", admin, async () => {
    requirePersistent();
    return respond();
  });

  app.put("/api/admin/spotify", admin, async (request) => {
    requirePersistent();
    await spotify.saveSettings(parseInput(spotifySettingsSchema, request.body));
    return respond();
  });

  app.post("/api/admin/spotify/sync", admin, async () => {
    requirePersistent();
    await spotify.sync();
    return respond();
  });
}
