import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  rmdir,
  stat,
  statfs,
  writeFile
} from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

/** Files being received or assembled; never served, and outside every storage key. */
const STAGING = ".staging";

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

export type StoredFolder = {
  key: string;
  files: { name: string; bytes: number }[];
  modifiedAt: Date;
};

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

  /** A path under the staging folder for a file that is still arriving (an upload being received). */
  async tempFile() {
    const dir = join(this.root, STAGING);
    await mkdir(dir, { recursive: true });
    return join(dir, `incoming-${randomUUID()}`);
  }

  /**
   * Writes every file of a new image folder, then moves the folder into place in one step: `key` either
   * holds all of its files or does not exist. A string is the path of a temporary file to move in.
   */
  async writeAll(key: string, files: { name: string; data: Buffer | string }[]) {
    const target = this.path(key);
    const staged = join(this.root, STAGING, `folder-${randomUUID()}`);
    try {
      await mkdir(staged, { recursive: true });
      for (const { name, data } of files) {
        if (typeof data === "string") await rename(data, join(staged, name));
        else await writeFile(join(staged, name), data);
      }
      await mkdir(dirname(target), { recursive: true });
      await rename(staged, target);
    } catch (error) {
      await rm(staged, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    }
  }

  /** Removes what interrupted uploads left in the staging folder. Recent entries may still be in use. */
  async clearStaging(olderThanMs = 60 * 60 * 1000, now = Date.now()) {
    const dir = join(this.root, STAGING);
    const entries = await readdir(dir).catch(() => []);
    let removed = 0;
    for (const entry of entries) {
      const path = join(dir, entry);
      const age = await stat(path).then(
        (info) => now - info.mtimeMs,
        () => null
      );
      if (age === null || age < olderThanMs) continue;
      await rm(path, { recursive: true, force: true }).catch(() => undefined);
      removed += 1;
    }
    return removed;
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

  /** The files directly in a key's folder with their sizes; empty when the folder is missing. */
  async files(key: string): Promise<{ name: string; bytes: number }[]> {
    const entries = await readdir(this.path(key), { withFileTypes: true }).catch(() => []);
    const files = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const info = await stat(this.path(key, entry.name)).catch(() => null);
      if (info) files.push({ name: entry.name, bytes: info.size });
    }
    return files;
  }

  /** SHA-256 of one stored file, hex. */
  async hash(key: string, name: string) {
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(this.path(key, name))) hash.update(chunk as Buffer);
    return hash.digest("hex");
  }

  /**
   * Every image folder under an area ("photos"): "<area>/<name>" where files lie directly in it (older
   * uploads), and each "<area>/<name>/<image>" sub-folder. Names that are not storage keys are skipped.
   */
  async tree(area: "photos"): Promise<StoredFolder[]> {
    const base = join(this.root, area);
    const folders: StoredFolder[] = [];
    const add = async (key: string) => {
      if (!isStorageKey(key)) return;
      const files = await this.files(key);
      const info = await stat(this.path(key)).catch(() => null);
      if (info && files.length) folders.push({ key, files, modifiedAt: info.mtime });
    };
    for (const entry of await readdir(base, { withFileTypes: true }).catch(() => [])) {
      if (!entry.isDirectory()) continue;
      const outer = `${area}/${entry.name}`;
      await add(outer);
      const inner = await readdir(join(base, entry.name), { withFileTypes: true }).catch(() => []);
      for (const child of inner) if (child.isDirectory()) await add(`${outer}/${child.name}`);
    }
    return folders;
  }

  /** Removes the named files of a folder, then the folder (and its parent) if nothing is left. */
  async removeFolder(key: string, names: string[]) {
    for (const name of names) await rm(this.path(key, name), { force: true });
    await this.removeIfEmpty(key);
    const parts = key.split("/");
    if (parts.length === 3) await this.removeIfEmpty(parts.slice(0, 2).join("/"));
  }

  /** Reads any stored file, including private originals. Admin-only callers. */
  async readStored(key: string, name: string): Promise<Buffer | null> {
    if (!isStorageKey(key) || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(name)) return null;
    return readFile(this.path(key, name)).catch(() => null);
  }

  /** Free and total space of the disk the uploads are on; null where the system cannot say. */
  async diskSpace() {
    try {
      await mkdir(this.root, { recursive: true });
      const info = await statfs(this.root);
      return { freeBytes: info.bavail * info.bsize, totalBytes: info.blocks * info.bsize };
    } catch {
      return null;
    }
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
