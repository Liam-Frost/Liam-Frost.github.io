import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";

import { notFound } from "../lib/errors";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".map": "application/json; charset=utf-8"
};

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
  if (!existsSync(join(distDir, "index.html"))) {
    app.log.info({ distDir }, "Site build not found; run `npm run build:web` to serve it from the API");
    return;
  }
  const files = listFiles(distDir);

  const handler = async (request: FastifyRequest, reply: FastifyReply) => {
    const pathname = request.url.split("?")[0];
    const urlPath = pathname === "/" ? "/index.html" : pathname;
    const file = files.get(urlPath);
    if (!file) throw notFound();

    reply.header("content-type", CONTENT_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream");
    reply.header("cache-control", cacheControl(urlPath));
    return reply.send(await readFile(file));
  };

  app.get("/", handler);
  app.get("/*", handler);
}
