import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";

import { PhotoTrash } from "../src/photos/trash";
import { LocalImageStore } from "../src/storage/local";
import { buildTestServer, csrf, login, multipartFile } from "./helpers";
import { MemoryAssetRepository } from "./memory-asset-repository";
import { MemoryPhotoRepository, remotePhoto } from "./memory-photo-repository";
import { MemoryPhotoVersionRepository } from "./memory-photo-version-repository";

let jpeg: Buffer;
let png: Buffer;

beforeAll(async () => {
  jpeg = await sharp({ create: { width: 900, height: 600, channels: 3, background: "#246" } })
    .jpeg()
    .toBuffer();
  png = await sharp({ create: { width: 1800, height: 1200, channels: 3, background: "#642" } })
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
  const dir = mkdtempSync(join(tmpdir(), "lf-trash-"));
  const photos = new MemoryPhotoRepository();
  const photoVersions = new MemoryPhotoVersionRepository();
  const assets = new MemoryAssetRepository();
  const settings = new Settings();
  let clock = new Date("2026-03-01T00:00:00Z");
  const app = await buildTestServer(
    { UPLOAD_DIR: dir },
    { photos, photoVersions, assets, settings, now: () => clock }
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
  const trash = new PhotoTrash({
    photos,
    versions: photoVersions,
    assets,
    store: new LocalImageStore(dir),
    settings: async () => ({ trashRetentionDays: 30, maxPhotoVersions: 10 }),
    now: () => clock
  });
  return {
    app,
    dir,
    photos,
    photoVersions,
    assets,
    settings,
    cookie,
    upload,
    call,
    trash,
    advance: (days: number) => (clock = new Date(clock.getTime() + days * 86_400_000))
  };
}

describe("image trash", () => {
  it("lists a deleted photo with its versions and size, hides it everywhere else", async () => {
    const { app, upload, call, cookie } = await setup();
    const { photo } = (await upload("/api/admin/photos", "a.jpg", jpeg)).json();
    await call("PATCH", `/api/admin/photos/${photo.id}`, { visibility: "public" });
    await upload(`/api/admin/photos/${photo.id}/image`, "a.png", png, "image/png");
    const shown = (await call("GET", `/api/admin/photos/${photo.id}`)).json().photo;

    expect((await call("DELETE", `/api/admin/photos/${photo.id}`)).statusCode).toBe(204);
    expect((await call("GET", "/api/admin/photos")).json().photos).toEqual([]);
    expect((await app.inject("/api/photos")).json()).toEqual([]);
    expect((await app.inject({ url: shown.src, headers: { cookie } })).statusCode).toBe(404);
    expect((await call("GET", `/api/admin/photos/${photo.id}/versions`)).statusCode).toBe(404);

    const { items, retentionDays, totalBytes } = (await call("GET", "/api/admin/trash")).json();
    expect(retentionDays).toBe(30);
    expect(items).toMatchObject([
      {
        kind: "photo",
        id: photo.id,
        versions: 2,
        width: 1800,
        deletedAt: "2026-03-01T00:00:00.000Z",
        expiresAt: "2026-03-31T00:00:00.000Z"
      }
    ]);
    expect(items[0].bytes).toBeGreaterThan(jpeg.length + png.length);
    expect(totalBytes).toBe(items[0].bytes);
    const thumbnail = await app.inject({ url: items[0].thumbnail, headers: { cookie } });
    expect(thumbnail.statusCode).toBe(200);
    expect(thumbnail.headers["content-type"]).toBe("image/webp");
    expect((await app.inject(items[0].thumbnail)).statusCode).toBe(401);
  });

  it("restores a photo with every version, as it was", async () => {
    const { app, upload, call, assets } = await setup();
    const { photo } = (await upload("/api/admin/photos", "a.jpg", jpeg)).json();
    await call("PATCH", `/api/admin/photos/${photo.id}`, {
      visibility: "public",
      title: { zh: "标题" }
    });
    await upload(`/api/admin/photos/${photo.id}/image`, "a.png", png, "image/png");
    await call("DELETE", `/api/admin/photos/${photo.id}`);

    const restored = await call("POST", `/api/admin/trash/photo/${photo.id}/restore`);
    expect(restored.json().items).toEqual([]);
    const back = (await call("GET", `/api/admin/photos/${photo.id}/versions`)).json();
    expect(back.photo).toMatchObject({ title: { zh: "标题" }, visibility: "public", width: 1800 });
    expect(back.versions).toHaveLength(2);
    expect((await app.inject(back.photo.src)).statusCode).toBe(200);
    expect([...assets.rows.values()].every((asset) => asset.status === "ready")).toBe(true);
    expect((await call("POST", `/api/admin/trash/photo/${photo.id}/restore`)).statusCode).toBe(404);
  });

  it("restores a version deleted on its own, within the version limit", async () => {
    const { upload, call, settings } = await setup();
    const { photo } = (await upload("/api/admin/photos", "a.jpg", jpeg)).json();
    await upload(`/api/admin/photos/${photo.id}/image`, "a.png", png, "image/png");
    const [old] = (await call("GET", `/api/admin/photos/${photo.id}/versions`)).json().versions;
    await call("DELETE", `/api/admin/photos/${photo.id}/versions/${old.id}`);

    const listed = (await call("GET", "/api/admin/trash")).json();
    expect(listed.items).toMatchObject([{ kind: "version", id: old.id, photoId: photo.id }]);
    // A version in the trash cannot be shown.
    expect(
      (await call("POST", `/api/admin/photos/${photo.id}/versions/${old.id}/current`)).statusCode
    ).toBe(404);

    settings.values.set("site.images", { trashRetentionDays: 30, maxPhotoVersions: 1 });
    expect(
      (await call("POST", `/api/admin/trash/version/${old.id}/restore`)).json().error.code
    ).toBe("VERSION_LIMIT");
    settings.values.set("site.images", { trashRetentionDays: 30, maxPhotoVersions: 10 });
    expect((await call("POST", `/api/admin/trash/version/${old.id}/restore`)).statusCode).toBe(200);
    expect(
      (await call("GET", `/api/admin/photos/${photo.id}/versions`)).json().versions
    ).toHaveLength(2);

    // While its photo is in the trash, a version cannot come back alone.
    await call("DELETE", `/api/admin/photos/${photo.id}/versions/${old.id}`);
    await call("DELETE", `/api/admin/photos/${photo.id}`);
    expect(
      (await call("POST", `/api/admin/trash/version/${old.id}/restore`)).json().error.code
    ).toBe("TRASH_PHOTO_FIRST");
  });

  it("removes for good what has outlived the retention period, and only that", async () => {
    const { upload, call, trash, advance, dir, photos, assets } = await setup();
    const first = (await upload("/api/admin/photos", "a.jpg", jpeg)).json().photo;
    await call("DELETE", `/api/admin/photos/${first.id}`);
    advance(20);
    const second = (await upload("/api/admin/photos", "b.png", png, "image/png")).json().photo;
    await call("DELETE", `/api/admin/photos/${second.id}`);
    advance(11);

    expect(await trash.purgeExpired()).toEqual({ removed: 1, failed: 0 });
    expect(existsSync(join(dir, "photos", first.id))).toBe(false);
    expect(existsSync(join(dir, "photos", second.id))).toBe(true);
    expect(photos.rows.has(first.id)).toBe(false);
    expect(assets.rows.size).toBe(1);
    expect((await call("GET", "/api/admin/trash")).json().items).toMatchObject([{ id: second.id }]);
  });

  it("keeps an item whose files cannot be removed, to try again later", async () => {
    const { upload, call, trash, dir, photos } = await setup();
    const { photo } = (await upload("/api/admin/photos", "a.jpg", jpeg)).json();
    await call("DELETE", `/api/admin/photos/${photo.id}`);
    const store = new LocalImageStore(dir);
    const failing = new PhotoTrash({
      photos,
      versions: (trash as unknown as { deps: { versions: MemoryPhotoVersionRepository } }).deps
        .versions,
      assets: null,
      store: Object.assign(Object.create(store), {
        remove: async () => {
          throw new Error("disk error");
        }
      }),
      settings: async () => ({ trashRetentionDays: 30, maxPhotoVersions: 10 }),
      now: () => new Date()
    });
    expect(await failing.purgeAll()).toEqual({ removed: 0, failed: 1 });
    expect(photos.rows.has(photo.id)).toBe(true);
    expect(await trash.purgeAll()).toEqual({ removed: 1, failed: 0 });
    expect(photos.rows.has(photo.id)).toBe(false);
  });

  it("puts referenced photos in the trash too, and empties it", async () => {
    const { photos, call } = await setup();
    await photos.create(remotePhoto({ id: "linked", slug: "linked" }));
    await call("DELETE", "/api/admin/photos/linked");
    const { items } = (await call("GET", "/api/admin/trash")).json();
    expect(items).toMatchObject([{ kind: "photo", id: "linked", bytes: 0 }]);
    expect(items[0].thumbnail).toMatch(/^https:/);
    expect((await call("DELETE", "/api/admin/trash")).json().items).toEqual([]);
    expect(photos.rows.size).toBe(0);
  });
});
