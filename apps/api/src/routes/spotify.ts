import type { FastifyInstance } from "fastify";
import { createRequire } from "node:module";
import type { SpotifyUrlInfoModule } from "spotify-url-info";

const require = createRequire(import.meta.url);
const spotifyUrlInfo = require("spotify-url-info") as SpotifyUrlInfoModule;

const spotify = spotifyUrlInfo(fetch);

export function registerSpotifyRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { url?: string } }>("/api/spotify", async (request, reply) => {
    const url = request.query.url?.trim();
    if (!url) {
      return reply.code(400).send({ message: "Missing Spotify URL" });
    }

    const preview = await spotify.getPreview(url);

    return {
      title: preview.track || preview.title,
      artist: preview.artist,
      image: preview.image ?? "",
      link: preview.link,
      audio: preview.audio
    };
  });
}
