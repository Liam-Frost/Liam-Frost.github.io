import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { buildTestServer } from "./helpers";

let dist: string;

beforeAll(() => {
  dist = mkdtempSync(join(tmpdir(), "lf-admin-dist-"));
  mkdirSync(join(dist, "assets"));
  writeFileSync(
    join(dist, "index.html"),
    '<!doctype html>\n<html>\n  <head>\n    <script type="module" src="./assets/index-abc123.js"></script>\n  </head>\n  <body></body>\n</html>\n'
  );
  writeFileSync(join(dist, "assets", "index-abc123.js"), "console.log('admin');");
  writeFileSync(join(dist, "favicon.svg"), "<svg/>");
  // Must never be served.
  writeFileSync(join(dist, "secret.txt"), "nope");
});

describe("admin app hosting", () => {
  it("serves the app shell at ADMIN_PATH and below with the mount path injected", async () => {
    const app = await buildTestServer({ ADMIN_PATH: "/studio" }, { adminDistDir: dist });
    for (const url of ["/studio", "/studio/", "/studio/photos/123"]) {
      const response = await app.inject(url);
      expect(response.statusCode, url).toBe(200);
      expect(response.headers["content-type"]).toMatch(/text\/html/);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.headers["content-security-policy"]).toMatch(/frame-ancestors 'none'/);
      expect(response.body).toContain('<base href="/studio/" />');
      expect(response.body).toContain('<meta name="lf-admin-path" content="/studio" />');
    }
  });

  it("serves hashed assets and the favicon, and nothing else", async () => {
    const app = await buildTestServer({ ADMIN_PATH: "/studio" }, { adminDistDir: dist });

    const js = await app.inject("/studio/assets/index-abc123.js");
    expect(js.statusCode).toBe(200);
    expect(js.headers["content-type"]).toMatch(/javascript/);
    expect(js.headers["cache-control"]).toMatch(/immutable/);

    expect((await app.inject("/studio/favicon.svg")).statusCode).toBe(200);

    for (const url of ["/studio/secret.txt", "/studio/assets/missing.js", "/studio/assets/..%2Fsecret.txt", "/studio/assets/.hidden", "/studio/index.html"]) {
      const response = await app.inject(url);
      expect(response.statusCode, url).toBe(404);
      expect(response.body, url).not.toContain("nope");
    }
  });

  it("does not serve the admin app at any other path", async () => {
    const app = await buildTestServer({ ADMIN_PATH: "/studio" }, { adminDistDir: dist });
    expect((await app.inject("/admin")).statusCode).toBe(404);
    expect((await app.inject("/studios")).statusCode).toBe(404);
  });

  it("hides the admin app from IPs outside ADMIN_ALLOWED_IPS with the unknown-route 404", async () => {
    const app = await buildTestServer({ ADMIN_PATH: "/studio", ADMIN_ALLOWED_IPS: "10.0.0.5" }, { adminDistDir: dist });
    const unknown = await app.inject("/nope");
    for (const url of ["/studio", "/studio/assets/index-abc123.js"]) {
      const response = await app.inject({ url, remoteAddress: "127.0.0.1" });
      expect(response.statusCode, url).toBe(404);
      expect(response.body, url).toBe(unknown.body);
    }
    expect((await app.inject({ url: "/studio", remoteAddress: "10.0.0.5" })).statusCode).toBe(200);
  });

  it("registers nothing when there is no build", async () => {
    const app = await buildTestServer({ ADMIN_PATH: "/studio" });
    expect((await app.inject("/studio")).statusCode).toBe(404);
  });
});
