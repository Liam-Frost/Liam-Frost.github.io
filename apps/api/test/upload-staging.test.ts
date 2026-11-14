import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  utimesSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { LocalImageStore } from "../src/storage/local";
import { buildTestServer, csrf, login, multipartFile } from "./helpers";
import { MemoryPhotoRepository } from "./memory-photo-repository";

const uploadDir = () => mkdtempSync(join(tmpdir(), "lf-staging-"));
const staged = (dir: string) =>
  existsSync(join(dir, ".staging")) ? readdirSync(join(dir, ".staging")) : [];

async function setup(dir: string, env: Record<string, string> = {}) {
  const app = await buildTestServer(
    { UPLOAD_DIR: dir, ...env },
    { photos: new MemoryPhotoRepository() }
  );
  const cookie = await login(app);
  const upload = (name: string, data: Buffer) => {
    const body = multipartFile(name, data, "image/jpeg");
    return app.inject({
      method: "POST",
      url: "/api/admin/photos",
      headers: { ...csrf, cookie, ...body.headers },
      payload: body.payload
    });
  };
  return { app, upload };
}

const jpeg = (width = 800, height = 600) =>
  sharp({ create: { width, height, channels: 3, background: "#357" } })
    .jpeg()
    .toBuffer();

describe("upload staging", () => {
  it("leaves nothing in the staging folder after an upload, and keeps the original bytes", async () => {
    const dir = uploadDir();
    const { upload } = await setup(dir);
    const data = await jpeg();
    const response = await upload("a.jpg", data);
    expect(response.statusCode).toBe(201);
    expect(staged(dir)).toEqual([]);

    const [photoFolder] = readdirSync(join(dir, "photos"));
    const [imageFolder] = readdirSync(join(dir, "photos", photoFolder!));
    const files = readdirSync(join(dir, "photos", photoFolder!, imageFolder!));
    expect(files).toContain("original.jpg");
    const { readFileSync } = await import("node:fs");
    expect(
      readFileSync(join(dir, "photos", photoFolder!, imageFolder!, "original.jpg")).equals(data)
    ).toBe(true);
  });

  it("removes the received file when the upload is rejected", async () => {
    const dir = uploadDir();
    const { upload } = await setup(dir, { UPLOAD_MAX_MB: "1" });
    expect((await upload("notes.jpg", Buffer.from("not an image"))).statusCode).toBe(400);
    expect((await upload("big.jpg", Buffer.alloc(2 * 1024 * 1024, 1))).statusCode).toBe(413);
    // The files are removed once the response is sent.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(staged(dir)).toEqual([]);
    expect(existsSync(join(dir, "photos"))).toBe(false);
  });

  it("handles several uploads at once", async () => {
    const dir = uploadDir();
    const { upload } = await setup(dir);
    const data = await jpeg(1600, 1200);
    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, i) => upload(`batch-${i}.jpg`, data))
    );
    expect(responses.map((r) => r.statusCode)).toEqual(Array(6).fill(201));
    expect(readdirSync(join(dir, "photos"))).toHaveLength(6);
    expect(staged(dir)).toEqual([]);
  });

  it("writes an image folder all at once and never over an existing one", async () => {
    const dir = uploadDir();
    const store = new LocalImageStore(dir);
    await store.writeAll("photos/a/one", [{ name: "640.webp", data: Buffer.from("x") }]);
    expect(readdirSync(join(dir, "photos", "a", "one"))).toEqual(["640.webp"]);

    // A missing source file fails the whole write: no partial folder appears.
    await expect(
      store.writeAll("photos/a/two", [
        { name: "640.webp", data: Buffer.from("x") },
        { name: "original.jpg", data: join(dir, "missing-file") }
      ])
    ).rejects.toThrow();
    expect(existsSync(join(dir, "photos", "a", "two"))).toBe(false);
    expect(staged(dir)).toEqual([]);
  });

  it("clears old staging leftovers at startup and keeps recent ones", async () => {
    const dir = uploadDir();
    mkdirSync(join(dir, ".staging", "folder-old"), { recursive: true });
    writeFileSync(join(dir, ".staging", "folder-old", "640.webp"), "x");
    writeFileSync(join(dir, ".staging", "incoming-old"), "x");
    writeFileSync(join(dir, ".staging", "incoming-new"), "x");
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    utimesSync(join(dir, ".staging", "folder-old"), old, old);
    utimesSync(join(dir, ".staging", "incoming-old"), old, old);

    await setup(dir);
    expect(staged(dir)).toEqual(["incoming-new"]);
  });
});
