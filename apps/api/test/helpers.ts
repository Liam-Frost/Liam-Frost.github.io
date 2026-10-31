import { ADMIN_REQUEST_HEADER } from "@liam-frost/shared";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { hashPassword } from "../src/auth/password";
import { loadConfig } from "../src/config/env";
import type { PhotoRepository } from "../src/photos/types";
import { buildServer } from "../src/server";

export const USERNAME = "liam";
export const PASSWORD = "correct horse battery staple";
export const SESSION_SECRET = "s".repeat(40);

let cachedHash: Promise<string> | undefined;

export function passwordHash() {
  cachedHash ??= hashPassword(PASSWORD);
  return cachedHash;
}

export type TestServerOptions = {
  adminDistDir?: string;
  /** Defaults to none (seed mode). */
  photos?: PhotoRepository | null;
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
    photos: options.photos ?? null
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
