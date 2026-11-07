/// <reference lib="dom" />
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
// The API tsconfig does not compile JSX; Vitest transforms the component under test.
const componentPath = new URL("../../web/src/components/ResponsiveFlickrImage.tsx", import.meta.url)
  .href;
const { default: ResponsiveFlickrImage } = await import(componentPath);

vi.mock("../../web/src/perf/useQuality", () => ({
  useQuality: () => ({
    tier: 0,
    reducedMotion: true,
    config: { images: { maxThumbSuffix: "b", placeholderStrategy: "none" } }
  })
}));

describe("reduced-motion image resolution", () => {
  it("renders high-resolution Flickr candidates even with animation tier zero", () => {
    const html = renderToStaticMarkup(
      createElement(ResponsiveFlickrImage, {
        baseUrl: "https://live.staticflickr.com/1/123_secret.jpg",
        originalWidth: 2400,
        originalHeight: 1600,
        variant: "grid",
        alt: "Test photo"
      })
    );
    expect(html).toContain('src="https://live.staticflickr.com/1/123_secret_b.jpg"');
    expect(html).toContain("_b.jpg 1024w");
  });
  it("renders uploaded image candidates using the image cap rather than animation tier", () => {
    const html = renderToStaticMarkup(
      createElement(ResponsiveFlickrImage, {
        baseUrl: "/uploads/original.jpg",
        originalWidth: 2400,
        originalHeight: 1600,
        variant: "grid",
        alt: "Test upload",
        variants: [
          { url: "/uploads/small.jpg", width: 320, height: 213 },
          { url: "/uploads/medium.jpg", width: 960, height: 640 }
        ]
      })
    );
    expect(html).toContain('src="/uploads/medium.jpg"');
    expect(html).toContain("/uploads/medium.jpg 960w");
  });
});
