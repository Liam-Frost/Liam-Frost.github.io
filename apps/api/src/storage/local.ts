import { mkdir, readdir, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

/** Public URL prefix for files under UPLOAD_DIR. */
export const UPLOADS_PREFIX = "/uploads";

/**
 * Keys: "photos|projects|media|people|stack/<id>" or "branding/<slot>" (an entry's folder) or "<same>/<imageId>" (one image of it).
 * Lowercase letters, digits and '-' only, so they can never escape the root.
 */
const KEY =
  /^(photos|projects|media|people|stack|branding)\/[a-z0-9][a-z0-9-]{0,80}(\/[a-z0-9][a-z0-9-]{0,40})?$/;
/** Served file names: generated sizes only ("1280.webp"). Originals are stored but never served. */
const PUBLIC_FILE = /^\d{1,5}\.webp$/;

export function isStorageKey(value: string) {
  return KEY.test(value);
}

/** Stores uploaded images on the local disk under UPLOAD_DIR. */
export class LocalImageStore {
  readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private path(key: string, name?: string) {
    if (!isStorageKey(key)) throw new Error(`Invalid storage key: ${key}`);
    const dir = join(this.root, ...key.split("/"));
    // Defense in depth: the key pattern already rules this out.
    if (!dir.startsWith(this.root + sep))
      throw new Error(`Storage key escapes the upload root: ${key}`);
    return name ? join(dir, name) : dir;
  }

  async write(key: string, name: string, data: Buffer) {
    await mkdir(this.path(key), { recursive: true });
    await writeFile(this.path(key, name), data);
  }

  /** Removes every file of a photo. Missing folders are fine. */
  async remove(key: string) {
    await rm(this.path(key), { recursive: true, force: true });
  }

  /** Removes a key's folder if nothing is left in it (e.g. a photo's folder after its last image). */
  async removeIfEmpty(key: string) {
    await rmdir(this.path(key)).catch(() => undefined);
  }

  /** Removes the files directly in a key's folder, keeping its sub-folders (an older photo's own images). */
  async removeFiles(key: string) {
    const entries = await readdir(this.path(key), { withFileTypes: true }).catch(() => []);
    for (const entry of entries)
      if (entry.isFile()) await rm(this.path(key, entry.name), { force: true });
  }

  /** Reads a public file, or returns null for anything that is not a generated size. */
  async readPublic(key: string, name: string): Promise<Buffer | null> {
    if (!isStorageKey(key) || !PUBLIC_FILE.test(name)) return null;
    try {
      return await readFile(this.path(key, name));
    } catch {
      return null;
    }
  }

  publicUrl(key: string, name: string) {
    return `${UPLOADS_PREFIX}/${key}/${name}`;
  }
}
