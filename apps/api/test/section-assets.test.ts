import { existsSync, mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";

import { backfillSectionAssets } from "../src/assets/backfill";
import { LocalImageStore } from "../src/storage/local";
import { buildTestServer, csrf, login, multipartFile } from "./helpers";
import { MemoryAssetRepository } from "./memory-asset-repository";
import { MemoryPhotoRepository } from "./memory-photo-repository";
import { MemoryProjectRepository } from "./memory-project-repository";

let first: Buffer;
let second: Buffer;

beforeAll(async () => {
  const make = (background: string) =>
    sharp({ create: { width: 1600, height: 900, channels: 3, background } })
      .png()
      .toBuffer();
  [first, second] = await Promise.all([make("#3a6"), make("#63a")]);
});

async function setup({ withAssets = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "lf-sections-"));
  const projects = new MemoryProjectRepository();
  const assets = new MemoryAssetRepository();
  const app = await buildTestServer(
    { UPLOAD_DIR: dir },
    { projects, photos: new MemoryPhotoRepository(), assets: withAssets ? assets : null }
  );
  const cookie = await login(app);
  const headers = { ...csrf, cookie };
  const project = (
    await app.inject({
      method: "POST",
      url: "/api/admin/projects",
      headers,
      payload: { title: { zh: "网站" }, slug: "site" }
    })
  ).json().project as { id: string };
  const upload = async (data: Buffer, slot: "cover" | "gallery" = "cover") => {
    const body = multipartFile("shot.png", data, "image/png");
    const response = await app.inject({
      method: "POST",
      url: `/api/admin/projects/${project.id}/images?slot=${slot}`,
      headers: { ...headers, ...body.headers },
      payload: body.payload
    });
    return response.json().project as { cover: { id: string }; gallery: { id: string }[] };
  };
  const call = (method: "GET" | "POST" | "DELETE", url: string, payload?: object) =>
    app.inject({ method, url, headers, ...(payload ? { payload } : {}) });
  const folder = (imageId: string) => join(dir, "projects", project.id, imageId);
  return { app, dir, projects, assets, cookie, project, upload, call, folder };
}

describe("images of other sections", () => {
  it("registers a project cover and moves the replaced one to the trash", async () => {
    const { upload, call, assets, folder, project, app, cookie } = await setup();
    const before = await upload(first);
    expect([...assets.rows.values()]).toMatchObject([
      {
        ownerType: "project",
        ownerId: project.id,
        format: "png",
        bytes: first.length,
        status: "ready"
      }
    ]);

    const after = await upload(second);
    expect(after.cover.id).not.toBe(before.cover.id);
    // The replaced cover's files are kept, in the trash.
    expect(existsSync(folder(before.cover.id))).toBe(true);
    const { items } = (await call("GET", "/api/admin/trash")).json();
    expect(items).toMatchObject([
      {
        kind: "image",
        ownerType: "project",
        photoId: project.id,
        restorable: false,
        title: { zh: "网站" },
        width: 1600
      }
    ]);
    expect((await app.inject({ url: items[0].thumbnail, headers: { cookie } })).statusCode).toBe(
      200
    );
    expect(
      (await call("POST", `/api/admin/trash/image/${items[0].id}/restore`)).json().error.code
    ).toBe("NOT_RESTORABLE");

    const original = await app.inject({
      url: `/api/admin/trash/image/${items[0].id}/original`,
      headers: { cookie }
    });
    expect(original.statusCode).toBe(200);
    expect(original.rawPayload.equals(first)).toBe(true);

    expect((await call("DELETE", `/api/admin/trash/image/${items[0].id}`)).json().items).toEqual(
      []
    );
    expect(existsSync(folder(before.cover.id))).toBe(false);
    expect(existsSync(folder(after.cover.id))).toBe(true);
    expect(assets.rows.size).toBe(1);
  });

  it("moves every image of a deleted project to the trash, and removes them when it is emptied", async () => {
    const { upload, call, assets, folder, project } = await setup();
    const { cover } = await upload(first);
    const { gallery } = await upload(second, "gallery");
    expect((await call("DELETE", `/api/admin/projects/${project.id}`)).statusCode).toBe(204);
    expect([...assets.rows.values()].map((asset) => asset.status)).toEqual(["trashed", "trashed"]);
    const { items } = (await call("GET", "/api/admin/trash")).json();
    // The project is gone: the items show where the files are instead of a title.
    expect(items.map((item: { title: object; label: string }) => [item.title, item.label])).toEqual(
      expect.arrayContaining([[{}, expect.stringContaining(`projects/${project.id}/`)]])
    );
    expect((await call("DELETE", "/api/admin/trash")).json().items).toEqual([]);
    expect(existsSync(folder(cover.id))).toBe(false);
    expect(existsSync(folder(gallery[0]!.id))).toBe(false);
    expect(assets.rows.size).toBe(0);
  });

  it("removes files at once where there is no register, as before", async () => {
    const { upload, folder } = await setup({ withAssets: false });
    const before = await upload(first);
    await upload(second);
    expect(existsSync(folder(before.cover.id))).toBe(false);
  });

  it("backfills images saved before the register, once", async () => {
    const { upload, projects, dir } = await setup({ withAssets: false });
    await upload(first);
    await upload(second, "gallery");
    const assets = new MemoryAssetRepository();
    const store = new LocalImageStore(dir);
    const sections = { projects, media: null, people: null, stack: null, branding: null };
    expect(await backfillSectionAssets(sections, assets, store)).toBe(2);
    expect([...assets.rows.values()].map((asset) => [asset.ownerType, asset.format])).toEqual([
      ["project", "png"],
      ["project", "png"]
    ]);
    expect(await backfillSectionAssets(sections, assets, store)).toBe(0);
  });

  it("scans the other sections: known images are fine, a stray folder is an orphan", async () => {
    const { upload, call, dir, project } = await setup();
    const { cover } = await upload(first);
    const stray = join(dir, "projects", project.id, "bbbbbbbbbbbb");
    mkdirSync(stray, { recursive: true });
    writeFileSync(join(stray, "640.webp"), "x");
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    utimesSync(stray, old, old);

    const { scan } = (await call("POST", "/api/admin/storage/scan")).json();
    expect(scan.missing).toEqual([]);
    expect(scan.incomplete).toEqual([]);
    expect(scan.orphans).toMatchObject([
      { key: `projects/${project.id}/bbbbbbbbbbbb`, adoptable: false }
    ]);
    // The cover in use cannot be deleted as an orphan.
    expect(
      (
        await call("POST", "/api/admin/storage/orphans/delete", {
          key: `projects/${project.id}/${cover.id}`
        })
      ).statusCode
    ).toBe(404);
    const after = await call("POST", "/api/admin/storage/orphans/delete", {
      key: `projects/${project.id}/bbbbbbbbbbbb`
    });
    expect(after.json().scan.orphans).toEqual([]);
    expect(existsSync(stray)).toBe(false);

    const overview = (await call("GET", "/api/admin/storage")).json();
    expect(overview.byOwner).toMatchObject([{ ownerType: "project", images: 1 }]);
  });

  it("without a register, does not look at other sections' folders at all", async () => {
    const { upload, call } = await setup({ withAssets: false });
    await upload(first);
    const { scan } = (await call("POST", "/api/admin/storage/scan")).json();
    expect(scan.orphans).toEqual([]);
  });
});
