import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";

import { isBlockedAddress } from "../src/lib/safe-fetch";
import { buildTestServer, csrf, login, multipartFile } from "./helpers";
import { MemoryPhotoRepository, remotePhoto } from "./memory-photo-repository";

let jpeg: Buffer;
let other: Buffer;

beforeAll(async () => {
  jpeg = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: "#468" } })
    .jpeg()
    .withExif({
      IFD0: { Make: "Fujifilm", Model: "X-T5" },
      IFD2: { DateTimeOriginal: "2024:08:01 10:00:00" }
    })
    .toBuffer();
  other = await sharp({ create: { width: 800, height: 1000, channels: 3, background: "#a63" } })
    .png()
    .toBuffer();
});

/** Serves `routes` by URL; anything else is a 404. */
function fakeFetch(routes: Record<string, () => Response>) {
  const calls: string[] = [];
  const impl = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push(url);
    const route = routes[url];
    return route ? route() : new Response("missing", { status: 404 });
  }) as typeof fetch;
  return { impl, calls };
}

const image =
  (data: Buffer, type = "image/jpeg") =>
  () =>
    new Response(new Uint8Array(data), { headers: { "content-type": type } });

async function setup(
  options: {
    routes?: Record<string, () => Response>;
    lookup?: (host: string) => Promise<string[]>;
    env?: Record<string, string>;
  } = {}
) {
  const photos = new MemoryPhotoRepository();
  const uploadDir = mkdtempSync(join(tmpdir(), "lf-src-"));
  const fetcher = fakeFetch(options.routes ?? {});
  const app = await buildTestServer(
    { UPLOAD_DIR: uploadDir, ...options.env },
    { photos, photoFetch: fetcher.impl, photoLookup: options.lookup }
  );
  const cookie = await login(app);
  const post = (url: string, payload: unknown, method: "POST" | "PUT" = "POST") =>
    app.inject({ method, url, headers: { ...csrf, cookie }, payload: payload as object });
  return { app, photos, uploadDir, cookie, post, calls: fetcher.calls };
}

describe("photo sources", () => {
  it("imports a linked image as a hidden, site-hosted photo with EXIF suggestions", async () => {
    const { app, post, uploadDir, cookie } = await setup({
      routes: { "https://img.example.com/trip/IMG_0042.jpg": image(jpeg) }
    });
    const response = await post("/api/admin/photos/import", {
      from: { type: "url", url: "https://img.example.com/trip/IMG_0042.jpg" }
    });
    expect(response.statusCode).toBe(201);
    const { photo } = response.json();
    expect(photo).toMatchObject({
      storage: "local",
      visibility: "private",
      camera: "Fujifilm X-T5",
      date: "2024-08-01",
      source: { type: "url", ref: "https://img.example.com/trip/IMG_0042.jpg" }
    });
    expect(photo.id).toMatch(/^img-0042-[0-9a-f]{6}$/);
    const folder = photo.thumbnail.split("/").slice(2, 5);
    expect(readdirSync(join(uploadDir, ...folder))).toContain("original.jpg");
    expect((await app.inject({ url: photo.thumbnail, headers: { cookie } })).statusCode).toBe(200);
  });

  it("references a linked image without copying it", async () => {
    const { post, uploadDir } = await setup({
      routes: { "https://cdn.example.com/a.png": image(other, "image/png") }
    });
    const { photo } = (
      await post("/api/admin/photos/import", {
        from: { type: "url", url: "https://cdn.example.com/a.png" },
        mode: "reference"
      })
    ).json();
    expect(photo).toMatchObject({
      storage: "remote-url",
      src: "https://cdn.example.com/a.png",
      width: 800,
      height: 1000,
      variants: [],
      source: { type: "url" }
    });
    expect(existsSync(join(uploadDir, "photos"))).toBe(false);
  });

  it("refuses links to private addresses, plain http and redirects into the network", async () => {
    const { post, photos } = await setup({
      lookup: async (host) => (host === "intranet.example.com" ? ["10.0.0.5"] : ["203.0.113.10"]),
      routes: {
        "https://hop.example.com/x.jpg": () =>
          new Response(null, {
            status: 302,
            headers: { location: "https://169.254.169.254/latest" }
          })
      }
    });
    for (const url of [
      "https://intranet.example.com/a.jpg",
      "http://img.example.com/a.jpg",
      "https://127.0.0.1/a.jpg",
      "https://[::1]/a.jpg",
      "https://hop.example.com/x.jpg"
    ]) {
      const response = await post("/api/admin/photos/import", { from: { type: "url", url } });
      expect(response.statusCode, url).toBe(400);
      expect(response.json().error.code).toBe("PHOTO_SOURCE");
    }
    expect(photos.rows.size).toBe(0);
    expect(isBlockedAddress("::ffff:192.168.1.1")).toBe(true);
    expect(isBlockedAddress("198.18.0.7")).toBe(false);
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
  });

  it("refuses links that are not images or too large, leaving nothing behind", async () => {
    const { post, photos, uploadDir } = await setup({
      env: { UPLOAD_MAX_MB: "1" },
      routes: {
        "https://img.example.com/page.html": () => new Response("<html></html>"),
        "https://img.example.com/huge.jpg": () => new Response(new Uint8Array(2 * 1024 * 1024))
      }
    });
    const notImage = await post("/api/admin/photos/import", {
      from: { type: "url", url: "https://img.example.com/page.html" }
    });
    expect(notImage.json().error.code).toBe("INVALID_IMAGE");
    const huge = await post("/api/admin/photos/import", {
      from: { type: "url", url: "https://img.example.com/huge.jpg" }
    });
    expect(huge.json().error.message).toContain("1 MB");
    expect(photos.rows.size).toBe(0);
    expect(existsSync(join(uploadDir, "photos"))).toBe(false);
  });

  it("adds a gallery photo (Flickr) from its page, keeping the page as the source", async () => {
    const page = "https://www.flickr.com/photos/someone/55042276542/";
    const staticUrl = "https://live.staticflickr.com/65535/55042276542_8c2b03588c_b.jpg";
    const oembed = `https://www.flickr.com/services/oembed/?url=${encodeURIComponent(page)}&format=json&maxwidth=4096`;
    const { post } = await setup({
      routes: {
        [oembed]: () =>
          Response.json({
            type: "photo",
            url: staticUrl,
            title: "Glico at night",
            width: 1024,
            height: 683
          }),
        [staticUrl]: image(jpeg)
      }
    });
    const referenced = (
      await post("/api/admin/photos/import", {
        from: { type: "gallery", url: page },
        mode: "reference"
      })
    ).json().photo;
    expect(referenced).toMatchObject({
      storage: "remote-url",
      src: staticUrl,
      title: { zh: "Glico at night" },
      source: { type: "gallery", provider: "flickr", ref: page }
    });
    const hosted = (
      await post("/api/admin/photos/import", { from: { type: "gallery", url: page } })
    ).json().photo;
    expect(hosted).toMatchObject({
      storage: "local",
      source: { type: "gallery", provider: "flickr", ref: page }
    });
    const notFlickr = await post("/api/admin/photos/import", {
      from: { type: "gallery", url: "https://example.com/p/1" }
    });
    expect(notFlickr.statusCode).toBe(400);
  });

  it("browses and imports from server folders, never outside them", async () => {
    const root = mkdtempSync(join(tmpdir(), "lf-inbox-"));
    mkdirSync(join(root, "2024 Osaka"));
    writeFileSync(join(root, "2024 Osaka", "dotonbori.jpg"), jpeg);
    writeFileSync(join(root, "notes.txt"), "not a photo");
    writeFileSync(join(root, ".hidden.jpg"), jpeg);
    const { app, cookie, post } = await setup({ env: { PHOTO_IMPORT_DIRS: root } });
    const get = (url: string) => app.inject({ url, headers: { cookie } });

    const top = (await get("/api/admin/photos/server")).json();
    expect(top.roots).toHaveLength(1);
    expect(top.entries.map((e: { name: string; type: string }) => [e.name, e.type])).toEqual([
      ["2024 Osaka", "dir"]
    ]);
    const inner = (
      await get(`/api/admin/photos/server?root=0&path=${encodeURIComponent("2024 Osaka")}`)
    ).json();
    expect(inner.entries).toMatchObject([
      { name: "dotonbori.jpg", path: "2024 Osaka/dotonbori.jpg", type: "image" }
    ]);
    const preview = await get(
      `/api/admin/photos/server/preview?root=0&path=${encodeURIComponent("2024 Osaka/dotonbori.jpg")}`
    );
    expect(preview.headers["content-type"]).toBe("image/webp");
    expect(preview.headers["cache-control"]).toBe("private, no-store");

    const { photo } = (
      await post("/api/admin/photos/import", {
        from: { type: "server", root: 0, path: "2024 Osaka/dotonbori.jpg" }
      })
    ).json();
    expect(photo).toMatchObject({
      storage: "local",
      title: { zh: "dotonbori" },
      source: { type: "server", ref: "0:2024 Osaka/dotonbori.jpg" }
    });

    for (const path of ["../outside.jpg", "2024 Osaka/../../x.jpg", "notes.txt"]) {
      const response = await post("/api/admin/photos/import", {
        from: { type: "server", root: 0, path }
      });
      expect(response.statusCode, path).toBe(400);
    }
    expect((await get("/api/admin/photos/server?root=0&path=..")).statusCode).toBe(400);
    expect((await get("/api/admin/photos/server?root=3")).statusCode).toBe(400);
    const referenceServer = await post("/api/admin/photos/import", {
      from: { type: "server", root: 0, path: "2024 Osaka/dotonbori.jpg" },
      mode: "reference"
    });
    expect(referenceServer.statusCode).toBe(400);
  });

  it("lists no server folders when none are configured", async () => {
    const { app, cookie } = await setup();
    expect(
      (await app.inject({ url: "/api/admin/photos/server", headers: { cookie } })).json()
    ).toEqual({
      roots: [],
      root: 0,
      path: "",
      entries: []
    });
  });

  it("replaces a photo's image, keeping its details and the old image as a version", async () => {
    const { app, post, cookie, uploadDir } = await setup({
      routes: { "https://img.example.com/new.png": image(other, "image/png") }
    });
    const body = multipartFile("first.jpg", jpeg, "image/jpeg");
    const { photo } = (
      await app.inject({
        method: "POST",
        url: "/api/admin/photos",
        headers: { ...csrf, cookie, ...body.headers },
        payload: body.payload
      })
    ).json();
    const oldFolder = photo.thumbnail.split("/").slice(2, 5);
    await app.inject({
      method: "PATCH",
      url: `/api/admin/photos/${photo.id}`,
      headers: { ...csrf, cookie },
      payload: { title: { zh: "保留的标题" } }
    });

    const replaced = (
      await post(
        `/api/admin/photos/${photo.id}/image`,
        { from: { type: "url", url: "https://img.example.com/new.png" } },
        "PUT"
      )
    ).json().photo;
    expect(replaced).toMatchObject({
      id: photo.id,
      title: { zh: "保留的标题" },
      width: 800,
      height: 1000,
      date: photo.date,
      source: { type: "url" }
    });
    expect(replaced.thumbnail).not.toBe(photo.thumbnail);
    // The earlier image stays on disk as a version, for the admin only.
    expect(existsSync(join(uploadDir, ...oldFolder))).toBe(true);
    expect((await app.inject({ url: photo.thumbnail, headers: { cookie } })).statusCode).toBe(200);
    expect((await app.inject({ url: photo.thumbnail })).statusCode).toBe(404);
    expect((await app.inject({ url: replaced.thumbnail, headers: { cookie } })).statusCode).toBe(
      200
    );

    // An upload, taking its EXIF date and camera this time.
    const second = multipartFile("second.jpg", jpeg, "image/jpeg");
    const withExif = (
      await app.inject({
        method: "POST",
        url: `/api/admin/photos/${photo.id}/image?exif=1`,
        headers: { ...csrf, cookie, ...second.headers },
        payload: second.payload
      })
    ).json().photo;
    expect(withExif).toMatchObject({
      camera: "Fujifilm X-T5",
      date: "2024-08-01",
      source: { type: "upload", ref: "second.jpg" }
    });

    // Deleting removes the photo's folder entirely.
    await app.inject({
      method: "DELETE",
      url: `/api/admin/photos/${photo.id}`,
      headers: { ...csrf, cookie }
    });
    expect(existsSync(join(uploadDir, "photos", oldFolder[1]!))).toBe(false);
  });

  it("hosts a referenced photo on the site, keeping where it came from", async () => {
    const staticUrl = "https://live.staticflickr.com/1/2_abc_b.jpg";
    const { photos, post } = await setup({ routes: { [staticUrl]: image(jpeg) } });
    await photos.create(remotePhoto());
    const hosted = (await post("/api/admin/photos/remote-1/host", {})).json().photo;
    expect(hosted).toMatchObject({
      storage: "local",
      source: { type: "gallery", provider: "flickr", ref: staticUrl }
    });
    expect(hosted.variants.length).toBeGreaterThan(0);
    expect((await post("/api/admin/photos/remote-1/host", {})).statusCode).toBe(409);
  });

  it("replaces the image of an older photo stored in a flat folder without touching others", async () => {
    const { app, photos, post, uploadDir, cookie } = await setup({
      routes: { "https://img.example.com/new.png": image(other, "image/png") }
    });
    // An upload from before Stage 19: files directly in photos/<id>.
    const legacy = join(uploadDir, "photos", "old-photo");
    mkdirSync(legacy, { recursive: true });
    writeFileSync(join(legacy, "640.webp"), "x");
    writeFileSync(join(legacy, "original.jpg"), "x");
    await photos.create(
      remotePhoto({
        id: "old-photo",
        slug: "old-photo",
        src: "",
        storage: "local",
        storageKey: "photos/old-photo",
        variants: [{ width: 640, height: 480 }],
        source: { type: "upload", ref: null, importedAt: null }
      })
    );
    const replaced = (
      await post(
        "/api/admin/photos/old-photo/image",
        { from: { type: "url", url: "https://img.example.com/new.png" } },
        "PUT"
      )
    ).json().photo;
    const folder = replaced.thumbnail.split("/").slice(2, 5);
    expect(folder[1]).toBe("old-photo");
    // The old flat files stay as a version; the new image is in a sub-folder of the same folder.
    expect(readdirSync(legacy).sort()).toEqual([folder[2], "640.webp", "original.jpg"].sort());
    expect((await app.inject({ url: replaced.thumbnail, headers: { cookie } })).statusCode).toBe(
      200
    );
  });
});
