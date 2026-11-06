import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { buildTestServer } from "./helpers";

let dist: string;

beforeAll(() => {
  dist = mkdtempSync(join(tmpdir(), "lf-web-dist-"));
  mkdirSync(join(dist, "assets"));
  writeFileSync(
    join(dist, "index.html"),
    '<!doctype html><title>site</title><script>document.documentElement.dataset.ok = "1";</script><script type="module" src="./assets/index-abc123.js"></script>'
  );
  writeFileSync(join(dist, "my photo.svg"), "<svg/>");
  writeFileSync(join(dist, "assets", "index-abc123.js"), "console.log('site');");
  writeFileSync(join(dist, "favicon.svg"), "<svg/>");
  writeFileSync(join(dist, "spotify-bridge.html"), "<!doctype html><title>bridge</title>");
  writeFileSync(join(dist, ".env"), "SECRET=1");
});

describe("public site hosting", () => {
  it("serves the site build with fitting cache headers", async () => {
    const app = await buildTestServer({}, { webDistDir: dist });

    const index = await app.inject("/");
    expect(index.statusCode).toBe(200);
    expect(index.headers["content-type"]).toContain("text/html");
    expect(index.headers["cache-control"]).toBe("no-cache");
    expect(index.body).toContain("<title>site</title>");

    const asset = await app.inject("/assets/index-abc123.js?v=1");
    expect(asset.headers["content-type"]).toContain("text/javascript");
    expect(asset.headers["cache-control"]).toContain("immutable");

    expect((await app.inject("/favicon.svg")).headers["content-type"]).toBe("image/svg+xml");
    expect((await app.inject("/my%20photo.svg")).statusCode).toBe(200);
    expect((await app.inject({ method: "HEAD", url: "/" })).statusCode).toBe(200);
  });

  it("sends a CSP that allows the inline bootstrap script by hash only", async () => {
    const app = await buildTestServer({}, { webDistDir: dist });
    const csp = String((await app.inject("/")).headers["content-security-policy"]);
    const hash = createHash("sha256")
      .update('document.documentElement.dataset.ok = "1";')
      .digest("base64");
    expect(csp).toContain(`'sha256-${hash}'`);
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("frame-src 'self' data: https://open.spotify.com");
    expect(csp.match(/'sha256-/g)).toHaveLength(1);
  });

  it("limits the Spotify bridge policy and permits only same-origin framing", async () => {
    const app = await buildTestServer({}, { webDistDir: dist });
    const bridge = await app.inject("/spotify-bridge.html");
    expect(bridge.statusCode).toBe(200);
    expect(bridge.headers["cache-control"]).toBe("no-cache");
    expect(bridge.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(bridge.headers["content-security-policy"]).toContain("'unsafe-eval'");
    const main = await app.inject("/");
    expect(main.headers["x-frame-options"]).toBe("DENY");
    expect(main.headers["content-security-policy"]).not.toContain("'unsafe-eval'");
  });

  it("serves only files in the build", async () => {
    const app = await buildTestServer({}, { webDistDir: dist });
    for (const url of [
      "/.env",
      "/assets/../.env",
      "/%2e%2e/package.json",
      "/projects",
      "/nope.js"
    ]) {
      expect((await app.inject(url)).statusCode, url).toBe(404);
    }
    // Malformed percent-encoding is rejected by Fastify before routing.
    expect((await app.inject("/%E0%A4%A")).statusCode).toBe(400);
  });

  it("keeps API routes and their 404s as before", async () => {
    const app = await buildTestServer({}, { webDistDir: dist });
    expect((await app.inject("/api/health")).json().ok).toBe(true);
    const missing = await app.inject("/api/nope");
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: { code: "NOT_FOUND", message: "Not found" } });
  });

  it("registers nothing without a build", async () => {
    const app = await buildTestServer();
    expect((await app.inject("/")).statusCode).toBe(404);
  });
});
