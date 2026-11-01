import type { AdminSpotifyResponse, PublicSpotifyPlayer, SpotifyAccountStatus, SpotifyOwnPlaylist } from "@liam-frost/shared";
import type { FastifyInstance } from "fastify";

import type { AdminAuthService } from "../auth/service";
import { HttpError } from "../lib/errors";
import { parseInput, spotifyCallbackQuerySchema, spotifyConnectSchema } from "../lib/validation";
import { SourceError } from "../media/sources";
import type { SpotifyAccount } from "../spotify/account";
import { spotifySettingsSchema, type SpotifyService } from "../spotify/service";

/**
 * The site's music player. Its songs come from the collection; changing the player's settings needs a
 * database so they survive restarts.
 */
export function registerSpotifyRoutes(app: FastifyInstance, auth: AdminAuthService, spotify: SpotifyService, account: SpotifyAccount, persistent: boolean) {
  const admin = { preHandler: auth.requireAdmin };
  const requirePersistent = () => {
    if (!persistent) {
      throw new HttpError(503, "DATABASE_NOT_CONFIGURED", "Music settings need a database (set DATABASE_URL)");
    }
  };
  const respond = async (): Promise<AdminSpotifyResponse> => {
    const [settings, tracks] = await Promise.all([spotify.settings(), spotify.tracks()]);
    return { settings, playerTracks: tracks.length };
  };

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

  const sourceFailure = (error: unknown): never => {
    if (error instanceof SourceError) throw new HttpError(502, "SOURCE_ERROR", error.message);
    throw error;
  };

  /** The admin's Spotify account, for importing Liked Songs and playlists. */
  app.get("/api/admin/spotify/account", admin, async (): Promise<SpotifyAccountStatus> => account.status());

  /** Starts connecting: the admin's browser goes to Spotify, then back to `returnTo`. */
  app.post("/api/admin/spotify/connect", admin, async (request): Promise<{ url: string }> => {
    requirePersistent();
    const { returnTo } = parseInput(spotifyConnectSchema, request.body);
    try {
      return { url: account.authorizeUrl(returnTo) };
    } catch (error) {
      return sourceFailure(error);
    }
  });

  /**
   * Spotify sends the browser here after the consent page. There is no admin cookie on this request
   * (SameSite=Strict, and in development another origin), so the one-time state authorizes it.
   */
  app.get("/api/admin/spotify/callback", async (request, reply) => {
    const query = spotifyCallbackQuerySchema.safeParse(request.query);
    const returnTo = query.success ? account.takeState(query.data.state) : null;
    if (!query.success || !returnTo) {
      reply.code(400).type("text/plain; charset=utf-8");
      return "This Spotify sign-in link has expired. Start again from the admin.";
    }
    const back = new URL(returnTo);
    try {
      if (query.data.error || !query.data.code) throw new SourceError(query.data.error === "access_denied" ? "已取消授权" : "Spotify 没有完成授权");
      await account.complete(query.data.code);
      back.searchParams.set("spotify", "connected");
    } catch (error) {
      request.log.warn({ err: error }, "Spotify sign-in failed");
      back.searchParams.set("spotify", "error");
      back.searchParams.set("reason", error instanceof SourceError ? error.message : "授权失败");
    }
    return reply.redirect(back.toString());
  });

  app.delete("/api/admin/spotify/account", admin, async (_request, reply) => {
    await account.disconnect();
    return reply.code(204).send();
  });

  app.get("/api/admin/spotify/playlists", admin, async (): Promise<{ playlists: SpotifyOwnPlaylist[] }> => {
    try {
      return { playlists: await account.playlists() };
    } catch (error) {
      return sourceFailure(error);
    }
  });
}
