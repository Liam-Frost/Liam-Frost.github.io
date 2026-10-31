import { ADMIN_REQUEST_HEADER } from "@liam-frost/shared";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { hashPassword } from "../src/auth/password";
import { loadConfig } from "../src/config/env";
import type { MusicSource } from "../src/media/itunes";
import { SourceError, type MediaSources } from "../src/media/sources";
import type { MediaRepository } from "../src/media/types";
import type { PhotoRepository } from "../src/photos/types";
import type { ProjectRepository } from "../src/projects/types";
import { buildServer } from "../src/server";
import type { SettingsRepository } from "../src/settings/types";
import type { PlaylistFetcher } from "../src/spotify/playlist";

export const USERNAME = "liam";
export const PASSWORD = "correct horse battery staple";
export const SESSION_SECRET = "s".repeat(40);

let cachedHash: Promise<string> | undefined;

export function passwordHash() {
  cachedHash ??= hashPassword(PASSWORD);
  return cachedHash;
}

const offline = () => Promise.reject(new SourceError("no network in tests"));
const offlineMediaSources: MediaSources = {
  available: () => ({ tmdb: false, bangumi: false }),
  search: offline,
  details: offline,
  download: offline,
  romaji: async () => null
};

export type TestServerOptions = {
  adminDistDir?: string;
  webDistDir?: string;
  /** Defaults to none (seed mode). */
  photos?: PhotoRepository | null;
  /** Defaults to none. */
  projects?: ProjectRepository | null;
  /** Defaults to none. */
  media?: MediaRepository | null;
  /** Defaults to sources that fail, so tests never reach TMDB or Bangumi. */
  mediaSources?: MediaSources;
  /** Defaults to none (in-memory defaults). */
  settings?: SettingsRepository | null;
  /** Defaults to one that fails, so tests never reach Spotify. */
  fetchPlaylist?: PlaylistFetcher;
  /** Defaults to one that fails, so tests never reach iTunes. */
  musicSource?: MusicSource;
};

/**
 * Builds a server from env-style overrides, with admin auth configured unless overridden.
 * Uploads go to a fresh temp directory unless UPLOAD_DIR is given.
 */
export async function buildTestServer(env: Record<string, string | undefined> = {}, options: TestServerOptions = {}) {
  const config = loadConfig({
    ADMIN_USERNAME: USERNAME,
    ADMIN_PASSWORD_HASH: await passwordHash(),
    ADMIN_SESSION_SECRET: SESSION_SECRET,
    UPLOAD_DIR: mkdtempSync(join(tmpdir(), "lf-uploads-")),
    ...env
  });
  return buildServer({
    config,
    logger: false,
    adminDistDir: options.adminDistDir ?? "/nonexistent-admin-dist",
    webDistDir: options.webDistDir ?? "/nonexistent-web-dist",
    photos: options.photos ?? null,
    projects: options.projects ?? null,
    media: options.media ?? null,
    mediaSources: options.mediaSources ?? offlineMediaSources,
    settings: options.settings ?? null,
    fetchPlaylist: options.fetchPlaylist ?? (() => Promise.reject(new Error("no network in tests"))),
    musicSource: options.musicSource ?? { search: offline, lookup: offline, findPreview: async () => null }
  });
}

/** A multipart/form-data body with one file field. Multipart needs CRLF line endings. */
export function multipartFile(fileName: string, data: Buffer, contentType = "application/octet-stream") {
  const boundary = "----lf-test-boundary";
  const CRLF = "\r\n";
  const head = Buffer.from(
    [`--${boundary}`, `Content-Disposition: form-data; name="file"; filename="${fileName}"`, `Content-Type: ${contentType}`, "", ""].join(CRLF)
  );
  const tail = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);
  return {
    payload: Buffer.concat([head, data, tail]),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` }
  };
}

export const csrf = { [ADMIN_REQUEST_HEADER]: "1" };

/** Logs in and returns the `name=value` cookie header for the session. */
export async function login(app: Awaited<ReturnType<typeof buildTestServer>>) {
  const response = await app.inject({
    method: "POST",
    url: "/api/admin/login",
    headers: csrf,
    payload: { username: USERNAME, password: PASSWORD }
  });
  if (response.statusCode !== 200) {
    throw new Error(`login failed: ${response.statusCode} ${response.body}`);
  }
  const cookie = response.cookies[0];
  return `${cookie.name}=${cookie.value}`;
}
