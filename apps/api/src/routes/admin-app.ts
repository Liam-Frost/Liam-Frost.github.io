import { ADMIN_PATH_META } from "@liam-frost/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

import type { AdminAuthService } from "../auth/service";
import { notFound } from "../lib/errors";

const CONTENT_TYPES: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8"
};

const ADMIN_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "font-src 'self' data:",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join("; ");

/**
 * Only files the admin build actually produces: Vite's hashed assets and the favicon.
 * File names cannot contain "/" or start with ".", so a request can never leave the dist directory.
 */
function assetPath(rest: string): string | null {
  if (rest === "favicon.svg") return rest;
  const match = /^assets\/([A-Za-z0-9_-][A-Za-z0-9._-]*)$/.exec(rest);
  return match ? `assets/${match[1]}` : null;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Writes the mount path into the page: `<base>` so ./assets resolve under nested routes, `<meta>` for the router. */
export function injectAdminPath(html: string, adminPath: string) {
  const value = escapeHtml(adminPath);
  return html.replace("<head>", `<head>\n    <base href="${value}/" />\n    <meta name="${ADMIN_PATH_META}" content="${value}" />`);
}

/**
 * Serves the admin app build (apps/admin/dist) at ADMIN_PATH. Other paths never get the admin page, and
 * IPs outside ADMIN_ALLOWED_IPS get the same 404 as an unknown route. Without a build (development, where
 * Vite serves the admin app) nothing is registered.
 */
export function registerAdminApp(app: FastifyInstance, auth: AdminAuthService, distDir: string) {
  const indexFile = join(distDir, "index.html");
  if (!existsSync(indexFile)) {
    app.log.info({ distDir }, "Admin app build not found; run `npm run build:admin` to serve it from the API");
    return;
  }

  const adminPath = auth.config.path;

  const handler = async (request: FastifyRequest, reply: FastifyReply) => {
    auth.assertIpAllowed(request);
    const rest = (request.params as { "*"?: string })["*"] ?? "";

    const asset = assetPath(rest);
    if (asset) {
      let data: Buffer;
      try {
        data = await readFile(join(distDir, asset));
      } catch {
        throw notFound();
      }
      reply.header("content-type", CONTENT_TYPES[extname(asset)] ?? "application/octet-stream");
      // Hashed file names change on every build, so they can be cached forever.
      reply.header("cache-control", asset.startsWith("assets/") ? "public, max-age=31536000, immutable" : "public, max-age=3600");
      return reply.send(data);
    }

    // Anything that looks like a file, or is under assets/, but is not a known asset is a 404, not the app shell.
    if (extname(rest) || rest.startsWith("assets/") || rest.split("/").some((segment) => segment.startsWith("."))) {
      throw notFound();
    }

    const html = injectAdminPath(await readFile(indexFile, "utf8"), adminPath);
    reply.header("content-type", "text/html; charset=utf-8");
    reply.header("cache-control", "no-store");
    reply.header("content-security-policy", ADMIN_CSP);
    return reply.send(html);
  };

  app.get(adminPath, handler);
  app.get(`${adminPath}/*`, handler);
}
