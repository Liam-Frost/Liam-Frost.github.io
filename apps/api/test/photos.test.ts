import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";

import { photoIdFromFileName } from "../src/routes/admin-photos";
import { buildTestServer, csrf, login, multipartFile } from "./helpers";
import { MemoryPhotoRepository, remotePhoto } from "./memory-photo-repository";

/** 4000x3000 JPEG stored sideways (EXIF orientation 6) with camera EXIF, like a phone/camera portrait shot. */
let cameraJpeg: Buffer;

beforeAll(async () => {
  cameraJpeg = await sharp({
    create: { width: 4000, height: 3000, channels: 3, background: { r: 40, g: 90, b: 140 } }
  })
    .jpeg({ quality: 70 })
    .withExif({
      IFD0: { Make: "Canon", Model: "Canon EOS R5" },
      IFD2: {
        ExposureTime: "1/200",
        FNumber: "2.8",
        ISOSpeedRatings: "400",
        DateTimeOriginal: "2025:05:04 18:30:00",
        LensModel: "RF24mm F1.4 L VCM"
      }
    })
    // sharp ignores Orientation inside withExif; withMetadata sets it.
    .withMetadata({ orientation: 6 })
    .toBuffer();
});

async function setup(env: Record<string, string> = {}) {
  const photos = new MemoryPhotoRepository();
  const app = await buildTestServer(env, { photos });
  const cookie = await login(app);
  return { app, photos, cookie };
}

async function upload(
  app: Awaited<ReturnType<typeof setup>>["app"],
  cookie: string,
  fileName: string,
  data: Buffer
) {
  const body = multipartFile(fileName, data, "image/jpeg");
  return app.inject({
    method: "POST",
    url: "/api/admin/photos",
    headers: { ...csrf, cookie, ...body.headers },
    payload: body.payload
  });
}

describe("public photo routes with a database", () => {
  it("lists only public photos and never mixes in seed data", async () => {
    const photos = new MemoryPhotoRepository();
    const app = await buildTestServer({}, { photos });
    expect((await app.inject("/api/photos")).json()).toEqual([]);

    await photos.create(remotePhoto({ id: "a", visibility: "public", featured: true }));
    await photos.create(remotePhoto({ id: "b", visibility: "private" }));
    const list = (await app.inject("/api/photos")).json();
    expect(list.map((p: { id: string }) => p.id)).toEqual(["a"]);
    expect(list[0]).toMatchObject({
      featured: true,
      src: "https://live.staticflickr.com/1/2_abc_b.jpg"
    });
    expect(list[0].variants).toBeUndefined();
  });

  it("hides private photos from the single-photo route", async () => {
    const photos = new MemoryPhotoRepository();
    await photos.create(remotePhoto({ id: "hidden", visibility: "private" }));
    const app = await buildTestServer({}, { photos });
    const response = await app.inject("/api/photos/hidden");
    expect(response.statusCode).toBe(404);
  });

  it("falls back to seed data when the database is unreachable", async () => {
    const photos = new MemoryPhotoRepository();
    photos.failing = true;
    const app = await buildTestServer({}, { photos });
    const list = (await app.inject("/api/photos")).json();
    expect(list.length).toBeGreaterThan(0);
    expect((await app.inject(`/api/photos/${list[0].id}`)).statusCode).toBe(200);
  });
});

describe("admin photo management", () => {
  it("requires a database, a session and the CSRF header", async () => {
    const noDb = await buildTestServer();
    const cookie = await login(noDb);
    const response = await noDb.inject({ url: "/api/admin/photos", headers: { cookie } });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe("DATABASE_NOT_CONFIGURED");

    const { app } = await setup();
    expect((await app.inject("/api/admin/photos")).statusCode).toBe(401);
    const noCsrf = multipartFile("x.jpg", cameraJpeg);
    const anonymous = await app.inject({
      method: "POST",
      url: "/api/admin/photos",
      headers: noCsrf.headers,
      payload: noCsrf.payload
    });
    expect(anonymous.statusCode).toBe(403);
  });

  it("turns an upload into a hidden photo with oriented sizes and EXIF suggestions", async () => {
    const uploadDir = (await import("node:fs")).mkdtempSync(
      join((await import("node:os")).tmpdir(), "lf-up-")
    );
    const { app, cookie } = await setup({ UPLOAD_DIR: uploadDir });

    const response = await upload(app, cookie, "IMG_1234 (2).JPG", cameraJpeg);
    expect(response.statusCode).toBe(201);
    const { photo } = response.json();

    expect(photo.id).toMatch(/^img-1234-2-[0-9a-f]{6}$/);
    expect(photo).toMatchObject({
      visibility: "private",
      storage: "local",
      // Orientation 6 turns the 4000x3000 sensor image into a 3000x4000 portrait.
      width: 3000,
      height: 4000,
      title: { zh: "IMG_1234 (2)" },
      camera: "Canon EOS R5",
      lens: "RF24mm F1.4 L VCM",
      settings: "1/200 · f/2.8 · ISO 400",
      date: "2025-05-04"
    });
    expect(photo.variants.map((v: { height: number }) => v.height)).toEqual([
      640, 1280, 2048, 3072
    ]);
    expect(photo.variants.every((v: { width: number; height: number }) => v.width < v.height)).toBe(
      true
    );
    expect(photo.thumbnail).toBe(photo.variants[0].url);
    expect(photo.src).toBe(photo.variants[3].url);

    // Generated sizes are served (to the admin while hidden); the original is stored but never served.
    const files = readdirSync(join(uploadDir, "photos", photo.id));
    expect(files).toContain("original.jpg");
    expect((await app.inject(photo.thumbnail)).statusCode).toBe(404);
    const served = await app.inject({ url: photo.thumbnail, headers: { cookie } });
    expect(served.statusCode).toBe(200);
    expect(served.headers["content-type"]).toBe("image/webp");
    expect(served.headers["cache-control"]).toBe("private, no-store");
    const servedMeta = await sharp(served.rawPayload).metadata();
    expect(servedMeta.exif).toBeUndefined();
    expect(
      (await app.inject({ url: `/uploads/photos/${photo.id}/original.jpg`, headers: { cookie } }))
        .statusCode
    ).toBe(404);

    // Hidden until published.
    expect((await app.inject("/api/photos")).json()).toEqual([]);
  });

  it("does not upscale small images", async () => {
    const small = await sharp({
      create: { width: 900, height: 600, channels: 3, background: "#888" }
    })
      .png()
      .toBuffer();
    const { app, cookie } = await setup();
    const { photo } = (await upload(app, cookie, "small.png", small)).json();
    expect(photo.variants.map((v: { width: number }) => v.width)).toEqual([640, 900]);
  });

  it("rejects files that are not images and leaves nothing behind", async () => {
    const uploadDir = (await import("node:fs")).mkdtempSync(
      join((await import("node:os")).tmpdir(), "lf-up-")
    );
    const { app, cookie, photos } = await setup({ UPLOAD_DIR: uploadDir });
    const response = await upload(app, cookie, "notes.jpg", Buffer.from("definitely not an image"));
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("INVALID_IMAGE");
    expect(photos.rows.size).toBe(0);
    expect(existsSync(join(uploadDir, "photos"))).toBe(false);
  });

  it("rejects files over UPLOAD_MAX_MB", async () => {
    const { app, cookie } = await setup({ UPLOAD_MAX_MB: "1" });
    const response = await upload(app, cookie, "big.jpg", Buffer.alloc(1024 * 1024 + 10, 1));
    expect(response.statusCode).toBe(413);
  });

  it("edits, publishes and deletes a photo", async () => {
    const uploadDir = (await import("node:fs")).mkdtempSync(
      join((await import("node:os")).tmpdir(), "lf-up-")
    );
    const { app, cookie } = await setup({ UPLOAD_DIR: uploadDir });
    const { photo } = (await upload(app, cookie, "street.jpg", cameraJpeg)).json();
    const url = `/api/admin/photos/${photo.id}`;

    const invalid = await app.inject({
      method: "PATCH",
      url,
      headers: { ...csrf, cookie },
      payload: { title: { zh: "  " } }
    });
    expect(invalid.statusCode).toBe(400);

    const patched = await app.inject({
      method: "PATCH",
      url,
      headers: { ...csrf, cookie },
      payload: {
        title: { zh: "街头", en: "Street", fr: "" },
        category: { zh: "街头", en: "Street" },
        tags: [{ zh: "夜", en: "Night" }],
        location: null,
        lens: "",
        visibility: "public",
        featured: true
      }
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().photo).toMatchObject({
      title: { zh: "街头", en: "Street" },
      lens: null,
      visibility: "public",
      featured: true
    });
    expect(patched.json().photo.title.fr).toBeUndefined();

    const publicList = (await app.inject("/api/photos")).json();
    expect(publicList).toHaveLength(1);
    expect(publicList[0]).toMatchObject({ id: photo.id, featured: true, src: photo.src });
    expect(publicList[0].variants).toHaveLength(4);

    // Published: anyone can load the images, and they cache forever.
    const image = await app.inject(photo.src);
    expect(image.statusCode).toBe(200);
    expect(image.headers["cache-control"]).toMatch(/immutable/);

    const removed = await app.inject({ method: "DELETE", url, headers: { ...csrf, cookie } });
    expect(removed.statusCode).toBe(204);
    expect(existsSync(join(uploadDir, "photos", photo.id))).toBe(false);
    expect((await app.inject(`/api/photos/${photo.id}`)).statusCode).toBe(404);
    expect((await app.inject(photo.src)).statusCode).toBe(404);
    expect(
      (await app.inject({ method: "DELETE", url, headers: { ...csrf, cookie } })).statusCode
    ).toBe(404);
  });

  it("reorders photos only with the complete, current list", async () => {
    const { app, cookie, photos } = await setup();
    for (const id of ["a", "b", "c"]) await photos.create(remotePhoto({ id }));

    const stale = await app.inject({
      method: "PUT",
      url: "/api/admin/photos/order",
      headers: { ...csrf, cookie },
      payload: { ids: ["a", "b"] }
    });
    expect(stale.statusCode).toBe(409);

    const ok = await app.inject({
      method: "PUT",
      url: "/api/admin/photos/order",
      headers: { ...csrf, cookie },
      payload: { ids: ["c", "a", "b"] }
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().photos.map((p: { id: string }) => p.id)).toEqual(["c", "a", "b"]);
  });

  it("serves only generated sizes from /uploads", async () => {
    const { app } = await setup();
    for (const url of [
      "/uploads/photos/x/../../secret",
      "/uploads/photos/x/original.jpg",
      "/uploads/photos/X%2F../640.webp",
      "/uploads/photos/missing/640.webp"
    ]) {
      expect((await app.inject(url)).statusCode, url).toBe(404);
    }
  });
});

describe("photoIdFromFileName", () => {
  it("builds readable, URL-safe ids", () => {
    expect(photoIdFromFileName("DSC_0001.JPG")).toMatch(/^dsc-0001-[0-9a-f]{6}$/);
    expect(photoIdFromFileName("东京夜景.jpg")).toMatch(/^photo-[0-9a-f]{6}$/);
    expect(photoIdFromFileName("Café au lait.png")).toMatch(/^cafe-au-lait-[0-9a-f]{6}$/);
  });
});
