import { afterEach, expect, it, vi } from "vitest";
import { prefetchImage, setMaxConcurrentImagePrefetch } from "../../web/src/images/prefetch";

afterEach(() => {
  vi.unstubAllGlobals();
  setMaxConcurrentImagePrefetch(2);
});

it("fetches an image after upgrading even if it was requested while prefetching was paused", async () => {
  const requested: string[] = [];
  vi.stubGlobal("window", {});
  vi.stubGlobal(
    "Image",
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(url: string) {
        requested.push(url);
        queueMicrotask(() => this.onload?.());
      }
    }
  );
  setMaxConcurrentImagePrefetch(0);
  await prefetchImage("https://example.com/photo.jpg");
  expect(requested).toEqual([]);
  setMaxConcurrentImagePrefetch(1);
  await prefetchImage("https://example.com/photo.jpg");
  expect(requested).toEqual(["https://example.com/photo.jpg"]);
  await prefetchImage("https://example.com/photo.jpg");
  expect(requested).toHaveLength(1);
});
