import type { FastifyInstance } from "fastify";
import { createRequire } from "node:module";
import type { SpotifyUrlInfoModule } from "spotify-url-info";

const require = createRequire(import.meta.url);
const spotifyUrlInfo = require("spotify-url-info") as SpotifyUrlInfoModule;

const spotify = spotifyUrlInfo(fetch);

function isAllowedSpotifyUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "open.spotify.com";
  } catch {
    return false;
  }
}

export function registerSpotifyRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { url?: string } }>("/api/spotify", async (request, reply) => {
    const url = request.query.url?.trim();
    if (!url) {
      return reply.code(400).send({ message: "Missing Spotify URL" });
    }

    if (!isAllowedSpotifyUrl(url)) {
      return reply.code(400).send({ message: "Invalid Spotify URL" });
    }

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
      return reply.code(502).send({ message: "Failed to fetch Spotify metadata" });
    }
  });
}
