import type { AdminServerFile, PhotoImportMode, PhotoSource } from "@liam-frost/shared";
import { randomBytes } from "node:crypto";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { basename, extname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { fetchPublic, UnsafeUrlError } from "../lib/safe-fetch";
import type { LocalImageStore } from "../storage/local";
import type { ExifSuggestions } from "./exif";
import { inspectImage, processImage, saveImage, type ProcessedImage } from "./images";
import type { PhotoPatch, StoredVariant } from "./types";

/** A source that cannot provide the image (bad link, missing file, not an image). */
export class PhotoSourceError extends Error {}

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".tif", ".tiff"]);
const FLICKR_PAGE = /^https:\/\/(?:www\.)?flickr\.com\/photos\/[^/]+\/\d+/i;
const FLICKR_SHORT = /^https:\/\/flic\.kr\/p\/[A-Za-z0-9]+/i;
const FLICKR_STATIC =
  /^https:\/\/live\.staticflickr\.com\/\d+\/\d+_[a-z0-9]+(?:_[a-z0-9]{1,2})?\.(jpe?g|png)$/i;

/** An image ready to be put on a photo: its new image fields, and suggestions for the details. */
export type PhotoImage = {
  fields: Required<
    Pick<PhotoPatch, "src" | "storage" | "storageKey" | "variants" | "source" | "width" | "height">
  >;
  exif: ExifSuggestions;
  /** A title suggestion (file name, Flickr title). */
  title: string | null;
};

/** "photos/<id-ish>/<imageId>": a fresh folder per image, so a replaced image gets new URLs. */
export function photoImageKey(photoId: string) {
  const folder =
    photoId
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "photo";
  return `photos/${folder}/${randomBytes(6).toString("hex")}`;
}

const source = (type: PhotoSource["type"], ref: string | null, now: Date): PhotoSource => ({
  type,
  ref,
  importedAt: now.toISOString()
});

/** Stores a processed image under a new key; callers remove the key if saving the photo fails. */
export async function hostImage(
  store: LocalImageStore,
  photoId: string,
  image: ProcessedImage,
  from: PhotoSource,
  title: string | null
): Promise<PhotoImage> {
  const storageKey = photoImageKey(photoId);
  await saveImage(store, storageKey, image);
  return {
    fields: {
      src: "",
      storage: "local",
      storageKey,
      variants: image.variants.map(({ width, height }): StoredVariant => ({ width, height })),
      source: from,
      width: image.width,
      height: image.height
    },
    exif: image.exif,
    title
  };
}

export type PhotoSourceDeps = {
  store: LocalImageStore;
  maxBytes: number;
  importRoots: string[];
  fetchImpl?: typeof fetch;
  lookup?: (host: string) => Promise<string[]>;
  now?: () => Date;
};

/**
 * Gets images for photos from links, Flickr pages and server import folders, either processed and
 * hosted by the site or (links only) shown from their own address.
 */
export class PhotoSources {
  constructor(private readonly deps: PhotoSourceDeps) {}

  private now() {
    return this.deps.now?.() ?? new Date();
  }

  private async download(url: string) {
    try {
      return await fetchPublic(url, {
        maxBytes: this.deps.maxBytes,
        fetchImpl: this.deps.fetchImpl,
        lookup: this.deps.lookup
      });
    } catch (error) {
      if (error instanceof UnsafeUrlError) throw new PhotoSourceError(error.message);
      throw error;
    }
  }

  /** An image link: hosted (downloaded and processed) or referenced (checked, then shown from the link). */
  async fromUrl(
    photoId: string,
    url: string,
    mode: PhotoImportMode,
    type: "url" | "flickr" = "url",
    title: string | null = null
  ): Promise<PhotoImage> {
    const { data } = await this.download(url);
    const from = source(type, url, this.now());
    if (mode === "import")
      return hostImage(this.deps.store, photoId, await processImage(data), from, title);
    const { width, height, exif } = await inspectImage(data);
    return {
      fields: {
        src: url,
        storage: "remote-url",
        storageKey: null,
        variants: null,
        source: from,
        width,
        height
      },
      exif,
      title
    };
  }

  /**
   * A Flickr photo: a photo page (or flic.kr short link) is looked up with Flickr's oEmbed, which needs no
   * key, for its title and image address; a live.staticflickr.com image link is used as is.
   */
  async fromFlickr(photoId: string, link: string, mode: PhotoImportMode): Promise<PhotoImage> {
    if (FLICKR_STATIC.test(link)) return this.fromUrl(photoId, link, mode, "flickr");
    if (!FLICKR_PAGE.test(link) && !FLICKR_SHORT.test(link))
      throw new PhotoSourceError("请粘贴 Flickr 照片页链接（flickr.com/photos/…）或图片链接");
    const oembed = new URL("https://www.flickr.com/services/oembed/");
    oembed.search = new URLSearchParams({ url: link, format: "json", maxwidth: "4096" }).toString();
    const { data } = await this.download(oembed.toString());
    let info: { type?: string; url?: string; title?: string };
    try {
      info = JSON.parse(data.toString("utf8")) as typeof info;
    } catch {
      throw new PhotoSourceError("Flickr 没有返回这张照片的信息");
    }
    if (info.type !== "photo" || !info.url || !FLICKR_STATIC.test(info.url))
      throw new PhotoSourceError("这个链接不是一张公开的 Flickr 照片");
    const image = await this.fromUrl(photoId, info.url, mode, "flickr", info.title?.trim() || null);
    // Keep the page as the reference; the image address is in src (or was downloaded).
    image.fields.source = source("flickr", link, this.now());
    return image;
  }

  /** The configured import folders, by index. */
  roots() {
    return this.deps.importRoots.map((path, index) => ({ index, name: basename(path) || path }));
  }

  /** Resolves a folder-relative path, refusing anything outside the folder (also through symlinks). */
  private async resolveInRoot(rootIndex: number, relPath: string) {
    const root = this.deps.importRoots[rootIndex];
    if (!root) throw new PhotoSourceError("没有这个导入目录");
    if (isAbsolute(relPath) || relPath.split(/[\\/]/).includes(".."))
      throw new PhotoSourceError("路径必须在导入目录内");
    const realRoot = await realpath(root).catch(() => {
      throw new PhotoSourceError("导入目录不存在");
    });
    const target = await realpath(resolve(realRoot, relPath || ".")).catch(() => {
      throw new PhotoSourceError("找不到这个文件或文件夹");
    });
    if (target !== realRoot && !target.startsWith(realRoot + sep))
      throw new PhotoSourceError("路径必须在导入目录内");
    return { realRoot, target };
  }

  /** Folders and images in an import folder, folders first. */
  async list(
    rootIndex: number,
    relPath: string
  ): Promise<{ path: string; entries: AdminServerFile[] }> {
    const { realRoot, target } = await this.resolveInRoot(rootIndex, relPath);
    const entries: AdminServerFile[] = [];
    for (const entry of await readdir(target, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = join(target, entry.name);
      const isDir = entry.isDirectory();
      if (!isDir && !(entry.isFile() && IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase())))
        continue;
      const info = await stat(full).catch(() => null);
      if (!info) continue;
      entries.push({
        name: entry.name,
        path: relative(realRoot, full).split(sep).join("/"),
        type: isDir ? "dir" : "image",
        size: isDir ? null : info.size,
        modifiedAt: info.mtime.toISOString()
      });
    }
    entries.sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1
    );
    return { path: relative(realRoot, target).split(sep).join("/"), entries };
  }

  /** Reads one image file from an import folder, within the upload size limit. */
  async readServerFile(rootIndex: number, relPath: string) {
    const { realRoot, target } = await this.resolveInRoot(rootIndex, relPath);
    if (!IMAGE_EXTENSIONS.has(extname(target).toLowerCase()))
      throw new PhotoSourceError("不是图片文件");
    const info = await stat(target);
    if (!info.isFile()) throw new PhotoSourceError("不是图片文件");
    if (info.size > this.deps.maxBytes)
      throw new PhotoSourceError(`图片超过 ${Math.round(this.deps.maxBytes / 1024 / 1024)} MB`);
    return { data: await readFile(target), path: relative(realRoot, target).split(sep).join("/") };
  }

  /** An image from an import folder, always hosted by the site (the folder is not served). */
  async fromServer(photoId: string, rootIndex: number, relPath: string): Promise<PhotoImage> {
    const { data, path } = await this.readServerFile(rootIndex, relPath);
    const title =
      basename(path)
        .replace(/\.[^.]*$/, "")
        .slice(0, 120) || null;
    return hostImage(
      this.deps.store,
      photoId,
      await processImage(data),
      source("server", `${rootIndex}:${path}`, this.now()),
      title
    );
  }
}
