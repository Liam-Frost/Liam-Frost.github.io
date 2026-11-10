import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";

import { backfillPhotoAssets } from "../src/assets/backfill";
import { LocalImageStore } from "../src/storage/local";
import { buildTestServer, csrf, login, multipartFile } from "./helpers";
import { MemoryAssetRepository } from "./memory-asset-repository";
import { MemoryPhotoRepository } from "./memory-photo-repository";

let first: Buffer;
let second: Buffer;
const sha = (data: Buffer) => createHash("sha256").update(data).digest("hex");

beforeAll(async () => {
  const make = (background: string) =>
    sharp({ create: { width: 900, height: 600, channels: 3, background } })
      .jpeg()
      .toBuffer();
  [first, second] = await Promise.all([make("#246"), make("#a63")]);
});

async function setup({ withAssets = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "lf-assets-"));
  const photos = new MemoryPhotoRepository();
  const assets = new MemoryAssetRepository();
  const app = await buildTestServer(
    { UPLOAD_DIR: dir },
    { photos, assets: withAssets ? assets : null }
  );
  const cookie = await login(app);
  const headers = { ...csrf, cookie };
  const upload = (
    name: string,
    data: Buffer,
    extra: Record<string, string> = {},
    url = "/api/admin/photos"
  ) => {
    const body = multipartFile(name, data, "image/jpeg");
    return app.inject({
      method: "POST",
      url,
      headers: { ...headers, ...extra, ...body.headers },
      payload: body.payload
    });
  };
  const post = (url: string, payload: object) =>
    app.inject({ method: "POST", url, headers, payload });
  return { app, dir, photos, assets, headers, upload, post };
}

describe("image register", () => {
  it("registers an uploaded photo's files with the original's hash and sizes", async () => {
    const { upload, assets } = await setup();
    const { photo } = (await upload("IMG_1.jpg", first)).json();
    const [asset] = [...assets.rows.values()];
    expect(asset).toMatchObject({
      ownerType: "photo",
      ownerId: photo.id,
      originalName: "IMG_1.jpg",
      format: "jpg",
      bytes: first.length,
      sha256: sha(first),
      width: 900,
      height: 600,
      status: "ready"
    });
    expect(asset!.totalBytes).toBeGreaterThan(first.length);
  });

  it("drops the entry when the photo is deleted and re-registers a replaced image", async () => {
    const { app, upload, assets, headers } = await setup();
    const { photo } = (await upload("a.jpg", first)).json();
    const oldKey = [...assets.rows.keys()][0]!;

    const replaced = await upload("b.jpg", second, {}, `/api/admin/photos/${photo.id}/image`);
    expect(replaced.statusCode).toBe(200);
    expect([...assets.rows.keys()]).toHaveLength(1);
    expect(assets.rows.has(oldKey)).toBe(false);
    expect([...assets.rows.values()][0]).toMatchObject({ sha256: sha(second), ownerId: photo.id });

    await app.inject({ method: "DELETE", url: `/api/admin/photos/${photo.id}`, headers });
    expect(assets.rows.size).toBe(0);
  });

  it("reports files that match an existing photo by content or by name", async () => {
    const { upload, post } = await setup();
    const { photo } = (await upload("IMG_1.jpg", first)).json();
    const response = await post("/api/admin/photos/check", {
      files: [
        { name: "renamed.jpg", sha256: sha(first) },
        { name: "IMG_1.jpg", sha256: sha(second) },
        { name: "new.jpg", sha256: sha(second) }
      ]
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().conflicts).toEqual([
      { index: 0, reason: "content", photo: expect.objectContaining({ id: photo.id }) },
      { index: 1, reason: "name", photo: expect.objectContaining({ id: photo.id }) }
    ]);
  });

  it("still finds name matches without a register", async () => {
    const { upload, post } = await setup({ withAssets: false });
    await upload("IMG_1.jpg", first);
    const { conflicts } = (
      await post("/api/admin/photos/check", { files: [{ name: "IMG_1.jpg", sha256: sha(first) }] })
    ).json();
    expect(conflicts).toMatchObject([{ index: 0, reason: "name" }]);
  });

  it("answers a retried upload with the photo it already made", async () => {
    const { upload, photos, post } = await setup();
    const id = { "x-upload-id": "retry-0001-abcdef" };
    const created = await upload("a.jpg", first, id);
    expect(created.statusCode).toBe(201);
    const again = await upload("a.jpg", first, id);
    expect(again.statusCode).toBe(200);
    expect(again.json().photo.id).toBe(created.json().photo.id);
    expect(photos.rows.size).toBe(1);

    // Without an id (or with another one) the same file is a new photo.
    expect((await upload("a.jpg", first, { "x-upload-id": "other-0002-abcdef" })).statusCode).toBe(
      201
    );
    expect(photos.rows.size).toBe(2);

    const status = await post("/api/admin/photos/uploads/status", {
      ids: ["retry-0001-abcdef", "never-0003-abcdef"]
    });
    expect(status.json()).toEqual({ photos: { "retry-0001-abcdef": created.json().photo.id } });
    expect((await upload("a.jpg", first, { "x-upload-id": "bad id" })).statusCode).toBe(400);
  });

  it("backfills photos uploaded before the register, once", async () => {
    const { upload, photos, dir } = await setup({ withAssets: false });
    await upload("old.jpg", first);
    const assets = new MemoryAssetRepository();
    const store = new LocalImageStore(dir);
    expect(await backfillPhotoAssets(photos, assets, store)).toBe(1);
    expect([...assets.rows.values()][0]).toMatchObject({
      originalName: "old.jpg",
      format: "jpg",
      bytes: first.length,
      sha256: sha(first)
    });
    expect(await backfillPhotoAssets(photos, assets, store)).toBe(0);
  });
});
