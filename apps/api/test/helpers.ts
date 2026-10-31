import { ADMIN_REQUEST_HEADER } from "@liam-frost/shared";

import { hashPassword } from "../src/auth/password";
import { loadConfig } from "../src/config/env";
import { buildServer } from "../src/server";

export const USERNAME = "liam";
export const PASSWORD = "correct horse battery staple";
export const SESSION_SECRET = "s".repeat(40);

let cachedHash: Promise<string> | undefined;

export function passwordHash() {
  cachedHash ??= hashPassword(PASSWORD);
  return cachedHash;
}

/** Builds a server from env-style overrides, with admin auth configured unless overridden. */
export async function buildTestServer(env: Record<string, string | undefined> = {}) {
  const config = loadConfig({
    ADMIN_USERNAME: USERNAME,
    ADMIN_PASSWORD_HASH: await passwordHash(),
    ADMIN_SESSION_SECRET: SESSION_SECRET,
    ...env
  });
  return buildServer({ config, logger: false });
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
