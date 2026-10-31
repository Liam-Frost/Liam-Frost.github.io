import type { FastifyInstance } from "fastify";
import { createRequire } from "node:module";
import type { SpotifyUrlInfoModule } from "spotify-url-info";

import { HttpError } from "../lib/errors";
import { parseInput, spotifyQuerySchema } from "../lib/validation";

const require = createRequire(import.meta.url);
const spotifyUrlInfo = require("spotify-url-info") as SpotifyUrlInfoModule;

const spotify = spotifyUrlInfo(fetch);

export function registerSpotifyRoutes(app: FastifyInstance) {
  app.get("/api/spotify", async (request) => {
    const { url } = parseInput(spotifyQuerySchema, request.query);

    try {
      const preview = await spotify.getPreview(url);

      return {
        title: preview.track || preview.title,
        artist: preview.artist,
        image: preview.image ?? "",
        link: preview.link,
        audio: preview.audio
      };
    } catch (error) {
      request.log.warn({ error }, "Failed to fetch Spotify metadata");
      throw new HttpError(502, "UPSTREAM_ERROR", "Failed to fetch Spotify metadata");
    }
  });
}
