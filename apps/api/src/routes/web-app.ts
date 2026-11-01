import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import { notFound } from "../lib/errors";
import { contentTypeFor } from "./content-types";

/** Every file in the build, keyed by URL path ("/assets/index-abc.js"). Dotfiles are skipped. */
function listFiles(root: string) {
  const files = new Map<string, string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) files.set(`/${relative(root, path).split(sep).join("/")}`, path);
    }
  };
  walk(root);
  return files;
}

/**
 * The site's CSP. Inline scripts in index.html (the theme/language bootstrap) are allowed by hash.
 * Photos and Spotify covers come from other HTTPS hosts, previews play from Spotify's and iTunes' CDNs,
 * the music player may embed Spotify's player, and fonts come from Google Fonts.
 */
export function siteCsp(indexHtml: string) {
  const inlineHashes = [...indexHtml.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .filter(([, body]) => body.trim())
    .map(([, body]) => `'sha256-${createHash("sha256").update(body).digest("base64")}'`);
  return [
    "default-src 'self'",
    ["script-src 'self'", ...inlineHashes].join(" "),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' https:",
    "connect-src 'self'",
    "object-src 'none'",
    // The music player can be Spotify's embedded player.
    "frame-src https://open.spotify.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join("; ");
}

function cacheControl(urlPath: string) {
  // Vite's hashed assets change name on every build; everything else may change in place.
  if (urlPath.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  if (urlPath === "/index.html") return "no-cache";
  return "public, max-age=3600";
}

/**
 * Serves the public site build (apps/web/dist) at "/". Only files that exist in the build at startup
 * are served, looked up by exact path, so requests cannot reach anything else. The site uses hash
 * routes, so "/" is its only page; other paths are 404s like any unknown route.
 * Without a build (development, where Vite serves the site) nothing is registered.
 */
export function registerWebApp(app: FastifyInstance, distDir: string) {
  const indexFile = join(distDir, "index.html");
  if (!existsSync(indexFile)) {
    app.log.info({ distDir }, "Site build not found; run `npm run build:web` to serve it from the API");
    return;
  }
  const files = listFiles(distDir);
  const csp = siteCsp(readFileSync(indexFile, "utf8"));

  const handler = async (request: FastifyRequest, reply: FastifyReply) => {
    let pathname: string;
    try {
      pathname = decodeURIComponent(request.url.split("?")[0]);
    } catch {
      throw notFound();
    }
    const urlPath = pathname === "/" ? "/index.html" : pathname;
    const file = files.get(urlPath);
    if (!file) throw notFound();

    reply.header("content-type", contentTypeFor(file));
    reply.header("cache-control", cacheControl(urlPath));
    if (urlPath === "/index.html") reply.header("content-security-policy", csp);
    return reply.send(await readFile(file));
  };

  app.get("/", handler);
  app.get("/*", handler);
}
