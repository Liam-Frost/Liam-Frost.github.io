import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";

import { buildTestServer, csrf, login, multipartFile } from "./helpers";
import { MemoryAssetRepository } from "./memory-asset-repository";
import { MemoryPhotoRepository } from "./memory-photo-repository";

let jpeg: Buffer;

beforeAll(async () => {
  jpeg = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: "#375" } })
    .jpeg()
    .toBuffer();
});

async function setup() {
  const dir = mkdtempSync(join(tmpdir(), "lf-scan-"));
  const photos = new MemoryPhotoRepository();
  const assets = new MemoryAssetRepository();
  const app = await buildTestServer({ UPLOAD_DIR: dir }, { photos, assets });
  const cookie = await login(app);
  const headers = { ...csrf, cookie };
  const upload = async (name: string) => {
    const body = multipartFile(name, jpeg, "image/jpeg");
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/photos",
      headers: { ...headers, ...body.headers },
      payload: body.payload
    });
    const photo = response.json().photo as { id: string; thumbnail: string };
    return { photo, folder: join(dir, ...photo.thumbnail.split("/").slice(2, 5)) };
  };
  const call = (method: "GET" | "POST" | "DELETE", url: string, payload?: object) =>
    app.inject({ method, url, headers, ...(payload ? { payload } : {}) });
  const scan = async () => (await call("POST", "/api/admin/storage/scan")).json().scan;
  /** A folder the database does not know, made to look old enough to be reported. */
  const orphan = (name: string, files: Record<string, Buffer | string>) => {
    const folder = join(dir, "photos", name, "aaaaaaaaaaaa");
    mkdirSync(folder, { recursive: true });
    for (const [file, data] of Object.entries(files)) writeFileSync(join(folder, file), data);
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    utimesSync(folder, old, old);
    return { folder, key: `photos/${name}/aaaaaaaaaaaa` };
  };
  return { app, dir, photos, assets, cookie, upload, call, scan, orphan };
}

describe("storage scan", () => {
  it("finds nothing wrong with healthy uploads, and reports totals", async () => {
    const { upload, call, scan } = await setup();
    await upload("a.jpg");
    await upload("b.jpg");
    expect(await scan()).toMatchObject({ orphans: [], missing: [], incomplete: [] });

    const overview = (await call("GET", "/api/admin/storage")).json();
    expect(overview).toMatchObject({
      registered: true,
      images: 2,
      originalBytes: jpeg.length * 2,
      byOwner: [{ ownerType: "photo", images: 2 }],
      trash: { images: 0, bytes: 0 }
    });
    expect(overview.totalBytes).toBeGreaterThan(overview.originalBytes);
    expect(overview.largest).toHaveLength(2);
    expect(overview.scan.scannedAt).toBeTruthy();
  });

  it("reports an orphan folder once it is old enough, previews it and deletes it on request", async () => {
    const { app, call, scan, orphan, cookie } = await setup();
    const { folder, key } = orphan("stray", { "640.webp": "x", "original.jpg": jpeg });
    const fresh = join(folder, "..", "bbbbbbbbbbbb");
    mkdirSync(fresh);
    writeFileSync(join(fresh, "640.webp"), "x");

    const found = await scan();
    expect(found.orphans).toMatchObject([{ key, files: 2, adoptable: true }]);
    expect(found.orphans[0].bytes).toBe(jpeg.length + 1);

    const preview = await app.inject({
      url: `/api/admin/storage/orphans/preview?key=${encodeURIComponent(key)}`,
      headers: { cookie }
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.headers["content-type"]).toBe("image/webp");

    const after = (await call("POST", "/api/admin/storage/orphans/delete", { key })).json();
    expect(after.scan.orphans).toEqual([]);
    expect(existsSync(folder)).toBe(false);
    // The newer folder beside it was left alone.
    expect(existsSync(fresh)).toBe(true);
  });

  it("refuses to delete a folder that belongs to a photo", async () => {
    const { upload, call } = await setup();
    const { photo, folder } = await upload("a.jpg");
    const key = photo.thumbnail.split("/").slice(2, 5).join("/");
    expect((await call("POST", "/api/admin/storage/orphans/delete", { key })).statusCode).toBe(404);
    expect(existsSync(folder)).toBe(true);
    expect(
      (await call("POST", "/api/admin/storage/orphans/delete", { key: "../etc" })).statusCode
    ).toBe(400);
  });

  it("adopts an orphan's original as a new hidden photo and removes the folder", async () => {
    const { call, scan, orphan, photos } = await setup();
    const { folder, key } = orphan("forgotten-trip", { "original.jpg": jpeg });
    await scan();
    const adopted = await call("POST", "/api/admin/photos/adopt", { key });
    expect(adopted.statusCode).toBe(201);
    expect(adopted.json().photo).toMatchObject({
      visibility: "private",
      width: 1600,
      height: 1000,
      title: { zh: "forgotten-trip" },
      source: { type: "server" }
    });
    expect(existsSync(folder)).toBe(false);
    expect(photos.rows.size).toBe(1);
    expect((await scan()).orphans).toEqual([]);

    const noOriginal = orphan("no-original", { "640.webp": "x" });
    expect(
      (await call("POST", "/api/admin/photos/adopt", { key: noOriginal.key })).json().error.code
    ).toBe("NO_ORIGINAL");
  });

  it("reports missing and incomplete images, and regenerates sizes from the original", async () => {
    const { upload, call, scan } = await setup();
    const gone = await upload("gone.jpg");
    const damaged = await upload("damaged.jpg");
    const hopeless = await upload("hopeless.jpg");
    rmSync(gone.folder, { recursive: true });
    rmSync(join(damaged.folder, "640.webp"));
    rmSync(join(hopeless.folder, "original.jpg"));
    rmSync(join(hopeless.folder, "1280.webp"));

    const found = await scan();
    expect(found.missing).toMatchObject([{ photoId: gone.photo.id }]);
    const byPhoto = Object.fromEntries(
      found.incomplete.map((issue: { photoId: string }) => [issue.photoId, issue])
    );
    expect(byPhoto[damaged.photo.id]).toMatchObject({ missing: ["640.webp"], repairable: true });
    expect(byPhoto[hopeless.photo.id]).toMatchObject({
      missing: ["1280.webp", "original"],
      repairable: false
    });

    const repaired = await call("POST", "/api/admin/storage/regenerate", {
      key: byPhoto[damaged.photo.id].key
    });
    expect(repaired.statusCode).toBe(200);
    expect(readdirSync(damaged.folder)).toContain("640.webp");
    expect(repaired.json().scan.incomplete).toHaveLength(1);
    expect(
      (
        await call("POST", "/api/admin/storage/regenerate", { key: byPhoto[hopeless.photo.id].key })
      ).json().error.code
    ).toBe("NO_ORIGINAL");
  });

  it("serves a version's original to the admin only, as a download", async () => {
    const { app, upload, call, cookie } = await setup();
    const { photo } = await upload("a.jpg");
    const [version] = (await call("GET", `/api/admin/photos/${photo.id}/versions`)).json().versions;
    const url = `/api/admin/photos/${photo.id}/versions/${version.id}/original`;
    const download = await app.inject({ url, headers: { cookie } });
    expect(download.statusCode).toBe(200);
    expect(download.headers["content-disposition"]).toMatch(/^attachment; filename=".+\.jpg"$/);
    expect(download.rawPayload.equals(jpeg)).toBe(true);
    expect((await app.inject(url)).statusCode).toBe(401);
  });

  it("counts what is in the trash separately", async () => {
    const { upload, call } = await setup();
    const { photo } = await upload("a.jpg");
    await upload("b.jpg");
    await call("DELETE", `/api/admin/photos/${photo.id}`);
    const overview = (await call("GET", "/api/admin/storage")).json();
    expect(overview).toMatchObject({ images: 1, trash: { images: 1 } });
    expect(overview.trash.bytes).toBeGreaterThan(jpeg.length);
    // Files of trashed photos are known, not orphans.
    expect((await call("POST", "/api/admin/storage/scan")).json().scan.orphans).toEqual([]);
  });
});
