import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import { HttpError, notFound } from "../lib/errors";
import { slugSchema } from "../lib/validation";
import type { ProjectRepository } from "../projects/types";
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

// Keep these in sync with the public pages in apps/web/src/app/App.tsx.
const PUBLIC_PAGES = new Set(["/portfolio", "/projects", "/collection", "/privacy"]);

async function isPublicPage(
  pathname: string,
  projects: ProjectRepository | null,
  request: FastifyRequest
) {
  const path = pathname.replace(/\/+$/, "");
  if (PUBLIC_PAGES.has(path.toLowerCase())) return true;

  const match = /^\/projects\/([^/]+)$/i.exec(path);
  if (!match || !projects) return false;
  const slug = slugSchema.safeParse(match[1]);
  if (!slug.success) return false;

  try {
    return (await projects.getBySlug(slug.data))?.visibility === "public";
  } catch (error) {
    request.log.warn({ error }, "Project database unavailable");
    throw new HttpError(503, "UNAVAILABLE", "Projects are temporarily unavailable");
  }
}

/** Serves build files by exact path and the public app shell for browser page navigations. */
export function registerWebApp(
  app: FastifyInstance,
  distDir: string,
  projects: ProjectRepository | null
) {
  const indexFile = join(distDir, "index.html");
  if (!existsSync(indexFile)) {
    app.log.info(
      { distDir },
      "Site build not found; run `npm run build:web` to serve it from the API"
    );
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
    if (!file) {
      const pageRequest =
        request.headers.accept?.includes("text/html") &&
        !/^\/(api|uploads|assets)(?:\/|$)/.test(pathname) &&
        !pathname.split("/").some((part) => part.startsWith(".")) &&
        !/\.[a-z0-9]+$/i.test(pathname);
      if (!pageRequest) throw notFound();
      const exists = await isPublicPage(pathname, projects, request);
      // The Vite build uses relative asset URLs, including on nested project pages.
      const head = exists
        ? '<head><base href="/">'
        : '<head><base href="/"><meta name="robots" content="noindex">';
      const html = (await readFile(indexFile, "utf8")).replace("<head>", head);
      return reply
        .code(exists ? 200 : 404)
        .header("content-type", "text/html; charset=utf-8")
        .header("cache-control", exists ? "no-cache" : "no-store")
        .header("vary", "Accept")
        .header("content-security-policy", csp)
        .send(html);
    }

    reply.header("content-type", contentTypeFor(file));
    reply.header("cache-control", cacheControl(urlPath));
    if (urlPath === "/index.html") reply.header("content-security-policy", csp);
    return reply.send(await readFile(file));
  };

  app.get("/", handler);
  app.get("/*", handler);
}
