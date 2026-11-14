import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";

import { buildTestServer, csrf, login, multipartFile } from "./helpers";
import { MemoryAssetRepository } from "./memory-asset-repository";
import { MemoryPhotoRepository, remotePhoto } from "./memory-photo-repository";
import { MemoryPhotoVersionRepository } from "./memory-photo-version-repository";

let jpeg: Buffer;
let png: Buffer;

beforeAll(async () => {
  jpeg = await sharp({ create: { width: 900, height: 600, channels: 3, background: "#246" } })
    .jpeg({ quality: 60 })
    .toBuffer();
  png = await sharp({ create: { width: 1800, height: 1200, channels: 3, background: "#246" } })
    .png()
    .toBuffer();
});

class Settings {
  values = new Map<string, unknown>();
  async get(key: string) {
    return this.values.get(key) ?? null;
  }
  async set(key: string, value: unknown) {
    this.values.set(key, value);
  }
}

async function setup() {
  const dir = mkdtempSync(join(tmpdir(), "lf-versions-"));
  const photos = new MemoryPhotoRepository();
  const photoVersions = new MemoryPhotoVersionRepository();
  const settings = new Settings();
  const app = await buildTestServer(
    { UPLOAD_DIR: dir },
    { photos, photoVersions, assets: new MemoryAssetRepository(), settings }
  );
  const cookie = await login(app);
  const headers = { ...csrf, cookie };
  const upload = (url: string, name: string, data: Buffer, type = "image/jpeg") => {
    const body = multipartFile(name, data, type);
    return app.inject({
      method: "POST",
      url,
      headers: { ...headers, ...body.headers },
      payload: body.payload
    });
  };
  const call = (method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: object) =>
    app.inject({ method, url, headers, ...(payload ? { payload } : {}) });
  return { app, dir, photos, photoVersions, settings, cookie, upload, call };
}

describe("photo versions", () => {
  it("gives a new photo one current version", async () => {
    const { upload, call } = await setup();
    const { photo } = (await upload("/api/admin/photos", "a.jpg", jpeg)).json();
    const { versions, limit } = (
      await call("GET", `/api/admin/photos/${photo.id}/versions`)
    ).json();
    expect(limit).toBe(10);
    expect(versions).toMatchObject([
      { current: true, storage: "local", width: 900, height: 600, format: "jpg", label: "" }
    ]);
    expect(versions[0].bytes).toBe(jpeg.length);
    expect(versions[0].thumbnail).toBe(photo.thumbnail);
  });

  it("adds a version without showing it, then switches to it and back", async () => {
    const { app, upload, call, cookie } = await setup();
    const { photo } = (await upload("/api/admin/photos", "a.jpg", jpeg)).json();
    await call("PATCH", `/api/admin/photos/${photo.id}`, {
      title: { zh: "标题" },
      visibility: "public"
    });

    const added = await upload(
      `/api/admin/photos/${photo.id}/image?current=0`,
      "a.png",
      png,
      "image/png"
    );
    expect(added.statusCode).toBe(200);
    // The photo still shows the first image.
    expect(added.json().photo).toMatchObject({ width: 900, thumbnail: photo.thumbnail });

    const listed = (await call("GET", `/api/admin/photos/${photo.id}/versions`)).json();
    expect(
      listed.versions.map((v: { current: boolean; format: string }) => [v.current, v.format])
    ).toEqual([
      [true, "jpg"],
      [false, "png"]
    ]);
    const [first, second] = listed.versions;
    // The version not being shown is for the admin only, even on a public photo.
    expect((await app.inject(second.thumbnail)).statusCode).toBe(404);
    expect((await app.inject({ url: second.thumbnail, headers: { cookie } })).statusCode).toBe(200);
    expect((await app.inject(first.thumbnail)).statusCode).toBe(200);

    const switched = (
      await call("POST", `/api/admin/photos/${photo.id}/versions/${second.id}/current`)
    ).json();
    expect(switched.photo).toMatchObject({
      id: photo.id,
      title: { zh: "标题" },
      visibility: "public",
      width: 1800,
      height: 1200,
      thumbnail: second.thumbnail
    });
    expect(switched.versions.map((v: { current: boolean }) => v.current)).toEqual([false, true]);
    expect((await app.inject(second.thumbnail)).statusCode).toBe(200);
    expect((await app.inject(first.thumbnail)).statusCode).toBe(404);
    const [publicPhoto] = (await app.inject("/api/photos")).json();
    expect(publicPhoto.width).toBe(1800);

    const back = (
      await call("POST", `/api/admin/photos/${photo.id}/versions/${first.id}/current`)
    ).json();
    expect(back.photo).toMatchObject({ width: 900, thumbnail: photo.thumbnail });
  });

  it("labels a version, and moves one that is not being shown to the trash", async () => {
    const { upload, call, dir } = await setup();
    const { photo } = (await upload("/api/admin/photos", "a.jpg", jpeg)).json();
    await upload(`/api/admin/photos/${photo.id}/image`, "a.png", png, "image/png");
    const { versions } = (await call("GET", `/api/admin/photos/${photo.id}/versions`)).json();
    const [old, current] = versions;
    expect(current.current).toBe(true);

    const labelled = (
      await call("PATCH", `/api/admin/photos/${photo.id}/versions/${old.id}`, {
        label: " JPEG 预览 "
      })
    ).json();
    expect(labelled.versions[0].label).toBe("JPEG 预览");

    expect(
      (await call("DELETE", `/api/admin/photos/${photo.id}/versions/${current.id}`)).json().error
        .code
    ).toBe("VERSION_IN_USE");
    const folder = join(dir, ...old.thumbnail.split("/").slice(2, 5));
    expect(existsSync(folder)).toBe(true);
    const removed = await call("DELETE", `/api/admin/photos/${photo.id}/versions/${old.id}`);
    expect(removed.json().versions).toHaveLength(1);
    expect(existsSync(folder)).toBe(true);
    await call("DELETE", `/api/admin/trash/version/${old.id}`);
    expect(existsSync(folder)).toBe(false);
    expect(
      (await call("DELETE", `/api/admin/photos/${photo.id}/versions/${old.id}`)).statusCode
    ).toBe(404);
  });

  it("enforces the version limit from the settings", async () => {
    const { upload, call, settings, dir } = await setup();
    settings.values.set("site.images", { trashRetentionDays: 30, maxPhotoVersions: 2 });
    const { photo } = (await upload("/api/admin/photos", "a.jpg", jpeg)).json();
    expect(
      (await upload(`/api/admin/photos/${photo.id}/image`, "b.png", png, "image/png")).statusCode
    ).toBe(200);
    const refused = await upload(`/api/admin/photos/${photo.id}/image`, "c.jpg", jpeg);
    expect(refused.statusCode).toBe(409);
    expect(refused.json().error.code).toBe("VERSION_LIMIT");
    const { versions, limit } = (
      await call("GET", `/api/admin/photos/${photo.id}/versions`)
    ).json();
    expect(limit).toBe(2);
    expect(versions).toHaveLength(2);
    expect(
      existsSync(join(dir, ".staging"))
        ? (await import("node:fs")).readdirSync(join(dir, ".staging"))
        : []
    ).toEqual([]);
  });

  it("treats the image of a photo from before versions as its first version", async () => {
    const { photos, call, photoVersions } = await setup();
    await photos.create(remotePhoto({ id: "old", slug: "old" }));
    const { versions, photo } = (await call("GET", "/api/admin/photos/old/versions")).json();
    expect(versions).toMatchObject([{ current: true, storage: "remote-url", format: null }]);
    expect(photo.id).toBe("old");
    expect(photoVersions.rows.size).toBe(1);
    // Asking again does not add another.
    await call("GET", "/api/admin/photos/old/versions");
    expect(photoVersions.rows.size).toBe(1);
  });

  it("removes every version's files when a deleted photo leaves the trash", async () => {
    const { upload, call, dir, photoVersions } = await setup();
    const { photo } = (await upload("/api/admin/photos", "a.jpg", jpeg)).json();
    await upload(`/api/admin/photos/${photo.id}/image`, "a.png", png, "image/png");
    const photoFolder = join(dir, ...photo.thumbnail.split("/").slice(2, 4));
    expect(existsSync(photoFolder)).toBe(true);
    expect((await call("DELETE", `/api/admin/photos/${photo.id}`)).statusCode).toBe(204);
    expect(existsSync(photoFolder)).toBe(true);
    await call("DELETE", `/api/admin/trash/photo/${photo.id}`);
    expect(existsSync(photoFolder)).toBe(false);
    expect(photoVersions.rows.size).toBe(0);
  });
});
