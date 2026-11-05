/// <reference lib="dom" />
import { afterEach, describe, expect, it, vi } from "vitest";

import { createIconPreview } from "../../admin/src/lib/icon-preview";

afterEach(() => vi.unstubAllGlobals());

function environment(
  width = 800,
  height = 400,
  output: Blob | null = new Blob(["pixels"], { type: "image/png" })
) {
  const bitmap = { width, height, close: vi.fn() };
  const decode = vi.fn().mockResolvedValue(bitmap);
  const drawImage = vi.fn();
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage }),
    toBlob: vi.fn((done: (blob: Blob | null) => void) => done(output))
  };
  const objectUrl = vi.fn().mockReturnValue("blob:raster-preview");
  vi.stubGlobal("createImageBitmap", decode);
  vi.stubGlobal("document", { createElement: vi.fn().mockReturnValue(canvas) });
  vi.stubGlobal("URL", { createObjectURL: objectUrl });
  return { bitmap, decode, drawImage, canvas, objectUrl, output };
}

describe("local technology icon preview", () => {
  it("only exposes re-encoded pixels, never the selected SVG's original markup", async () => {
    const env = environment();
    const file = new Blob(['<svg onload="alert(1)"/>'], { type: "image/svg+xml" });
    expect(await createIconPreview(file)).toBe("blob:raster-preview");
    expect(env.decode).toHaveBeenCalledWith(file);
    expect(env.canvas.width).toBe(256);
    expect(env.canvas.height).toBe(128);
    expect(env.drawImage).toHaveBeenCalledWith(env.bitmap, 0, 0, 256, 128);
    expect(env.canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/png");
    expect(env.objectUrl).toHaveBeenCalledExactlyOnceWith(env.output);
    expect(env.objectUrl).not.toHaveBeenCalledWith(file);
    expect(env.bitmap.close).toHaveBeenCalledOnce();
  });

  it("keeps small portrait icons proportional without upscaling", async () => {
    const env = environment(30, 60);
    await createIconPreview(new Blob());
    expect([env.canvas.width, env.canvas.height]).toEqual([30, 60]);
  });

  it.each([
    [0, 10],
    [10, 0],
    [6000, 6000]
  ])("rejects invalid/oversized bitmap %s x %s and releases it", async (w, h) => {
    const env = environment(w, h);
    await expect(createIconPreview(new Blob())).rejects.toThrow("Invalid icon dimensions");
    expect(env.bitmap.close).toHaveBeenCalledOnce();
    expect(env.objectUrl).not.toHaveBeenCalled();
  });

  it("releases the bitmap and never returns a raw URL when encoding fails", async () => {
    const env = environment(80, 80, null);
    await expect(createIconPreview(new Blob())).rejects.toThrow("Image preview unavailable");
    expect(env.bitmap.close).toHaveBeenCalledOnce();
    expect(env.objectUrl).not.toHaveBeenCalled();
  });
});
