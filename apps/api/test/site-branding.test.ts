import { DEFAULT_PRESENTATION } from "@liam-frost/shared";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { MemorySettingsRepository } from "../src/settings/types";
import { buildTestServer, csrf, login, multipartFile } from "./helpers";

const png = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 4, background: "#345" } })
    .png()
    .toBuffer();

async function setup(withSettings = true) {
  const settings = withSettings ? new MemorySettingsRepository() : null;
  const app = await buildTestServer(
    { UPLOAD_DIR: mkdtempSync(join(tmpdir(), "branding-")) },
    { settings }
  );
  const headers = { ...csrf, cookie: await login(app) };
  const upload = async (slot: string, data: Buffer, filename = "a.png", type = "image/png") => {
    const form = multipartFile(filename, data, type);
    return app.inject({
      method: "POST",
      url: `/api/admin/branding/${slot}`,
      headers: { ...headers, ...form.headers },
      payload: form.payload
    });
  };
  return { app, settings, headers, upload };
}

describe("uploaded logos and site icon", () => {
  it("stores a logo, publishes it, and retires the old file on replacement", async () => {
    const { app, upload } = await setup();
    const first = await upload("publicLogo", await png(800, 200));
    expect(first.statusCode).toBe(201);
    const url = first.json().publicLogo as string;
    expect(url).toMatch(/^\/uploads\/branding\/public-logo\/[a-z0-9]+\/512\.webp$/);
    expect(await sharp((await app.inject(url)).rawPayload).metadata()).toMatchObject({
      format: "webp",
      width: 512,
      height: 128
    });
    const shown = (await app.inject("/api/presentation")).json();
    expect(shown.logoUrls).toEqual({ publicLogo: url, adminLogo: null });

    const second = (await upload("publicLogo", await png(300, 300))).json().publicLogo;
    expect(second).not.toBe(url);
    expect((await app.inject(url)).statusCode).toBe(404);
    expect((await app.inject(second)).headers["cache-control"]).toContain("immutable");
  });

  it("generates every icon size from an upload, square with the whole image kept", async () => {
    const { app, headers, upload } = await setup();
    await upload("favicon", await png(1000, 500));
    const pub = (await app.inject("/api/site-settings")).json();
    expect(pub.faviconUrl).toMatch(/^\/api\/site-favicon\/[a-f0-9]{24}\/32\.png$/);
    for (const [file, size] of [
      ["32.png", 32],
      ["180.png", 180],
      ["192.png", 192],
      ["512.png", 512]
    ] as const) {
      const image = await app.inject(pub.faviconUrl.replace("32.png", file));
      expect(await sharp(image.rawPayload).metadata()).toMatchObject({
        format: "png",
        width: size,
        height: size
      });
    }
    const ico = await app.inject(pub.faviconUrl.replace("32.png", "favicon.ico"));
    expect(ico.headers["content-type"]).toContain("image/x-icon");

    const removed = await app.inject({
      method: "DELETE",
      url: "/api/admin/branding/favicon",
      headers
    });
    expect(removed.json().favicon).toBeNull();
    expect((await app.inject("/api/site-settings")).json().faviconUrl).toBeNull();
    expect((await app.inject(pub.faviconUrl)).statusCode).toBe(404);
  });

  it("accepts JPEG here, and refuses files that are not safe images", async () => {
    const { upload } = await setup();
    const jpeg = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#123" } })
      .jpeg()
      .toBuffer();
    expect((await upload("adminLogo", jpeg, "a.jpg", "image/jpeg")).statusCode).toBe(201);
    expect((await upload("adminLogo", Buffer.from("nope"), "a.png")).statusCode).toBe(400);
    expect((await upload("adminLogo", jpeg, "a.png", "image/png")).statusCode).toBe(400);
    const script = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>');
    expect((await upload("favicon", script, "a.svg", "image/svg+xml")).statusCode).toBe(400);
    expect((await upload("nothing", jpeg)).statusCode).toBe(400);
  });

  it("needs an admin session and the CSRF header, and a database to write", async () => {
    const { app, headers } = await setup();
    const form = multipartFile("a.png", await png(10, 10), "image/png");
    const post = (extra: Record<string, string>) =>
      app.inject({
        method: "POST",
        url: "/api/admin/branding/favicon",
        headers: { ...form.headers, ...extra },
        payload: form.payload
      });
    expect((await post(csrf)).statusCode).toBe(401);
    expect((await post({ cookie: headers.cookie })).statusCode).toBe(403);

    const none = await setup(false);
    expect((await none.upload("favicon", await png(10, 10))).statusCode).toBe(503);
  });

  it("drops the gallery choice saved before logos were uploaded", async () => {
    const { app, settings, headers } = await setup();
    await settings!.set("presentation.v1", {
      ...DEFAULT_PRESENTATION,
      publicLogo: { text: "LF", photoId: "old-photo" }
    });
    const { settings: read } = (
      await app.inject({ url: "/api/admin/presentation", headers })
    ).json();
    expect(read.publicLogo).toEqual({ text: "LF" });
    expect((await app.inject("/api/presentation")).statusCode).toBe(200);
  });
});
