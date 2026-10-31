import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { buildTestServer } from "./helpers";

let dist: string;

beforeAll(() => {
  dist = mkdtempSync(join(tmpdir(), "lf-web-dist-"));
  mkdirSync(join(dist, "assets"));
  writeFileSync(join(dist, "index.html"), "<!doctype html><title>site</title>");
  writeFileSync(join(dist, "assets", "index-abc123.js"), "console.log('site');");
  writeFileSync(join(dist, "favicon.svg"), "<svg/>");
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
    expect((await app.inject({ method: "HEAD", url: "/" })).statusCode).toBe(200);
  });

  it("serves only files in the build", async () => {
    const app = await buildTestServer({}, { webDistDir: dist });
    for (const url of ["/.env", "/assets/../.env", "/%2e%2e/package.json", "/projects", "/nope.js"]) {
      expect((await app.inject(url)).statusCode, url).toBe(404);
    }
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
