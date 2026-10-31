import { isAdminPagePath, normalizeAdminPath } from "@liam-frost/shared";
import { describe, expect, it } from "vitest";

import { ConfigError, loadConfig } from "../src/config/env";
import { IpList } from "../src/lib/ip-list";

const secret = "x".repeat(32);
const hash = "scrypt:v1:salt:hash";

function issuesFor(env: Record<string, string>) {
  try {
    loadConfig(env);
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError);
    return (error as ConfigError).issues.join("\n");
  }
  throw new Error("expected loadConfig to throw");
}

describe("loadConfig", () => {
  it("uses safe defaults for an empty environment", () => {
    const config = loadConfig({});
    expect(config.port).toBe(8787);
    expect(config.trustProxy).toBe(false);
    expect(config.admin.configured).toBe(false);
    expect(config.admin.path).toBe("/admin");
    expect(config.admin.cookieSecure).toBe(false);
    expect(config.corsOrigins).toContain("http://localhost:5173");
  });

  it("defaults to secure cookies and no CORS origins in production", () => {
    const config = loadConfig({ NODE_ENV: "production" });
    expect(config.admin.cookieSecure).toBe(true);
    expect(config.corsOrigins).toEqual([]);
  });

  it("enables admin auth when hash and secret are both set", () => {
    const config = loadConfig({ ADMIN_PASSWORD_HASH: hash, ADMIN_SESSION_SECRET: secret });
    expect(config.admin.configured).toBe(true);
    expect(config.admin.username).toBe("admin");
  });

  it("rejects a half-configured admin", () => {
    expect(issuesFor({ ADMIN_PASSWORD_HASH: hash })).toMatch(/must be set together/);
    expect(issuesFor({ ADMIN_SESSION_SECRET: secret })).toMatch(/must be set together/);
  });

  it("rejects a short session secret and a malformed hash", () => {
    expect(issuesFor({ ADMIN_PASSWORD_HASH: hash, ADMIN_SESSION_SECRET: "short" })).toMatch(/at least 32/);
    expect(issuesFor({ ADMIN_PASSWORD_HASH: "plaintext", ADMIN_SESSION_SECRET: secret })).toMatch(/auth:hash/);
  });

  it("rejects invalid numbers, flags, admin paths and IP entries", () => {
    expect(issuesFor({ PORT: "99999" })).toMatch(/PORT/);
    expect(issuesFor({ TRUST_PROXY: "yes" })).toMatch(/TRUST_PROXY/);
    expect(issuesFor({ ADMIN_PATH: "/api/admin" })).toMatch(/cannot start with \/api/);
    expect(issuesFor({ ADMIN_ALLOWED_IPS: "10.0.0.1,not-an-ip" })).toMatch(/not-an-ip/);
  });
});

describe("normalizeAdminPath", () => {
  it("normalizes slashes and falls back to /admin", () => {
    expect(normalizeAdminPath(undefined)).toBe("/admin");
    expect(normalizeAdminPath("  ")).toBe("/admin");
    expect(normalizeAdminPath("studio/")).toBe("/studio");
    expect(normalizeAdminPath("//my-panel/x_1//")).toBe("/my-panel/x_1");
  });

  it("rejects root, reserved prefixes and unsafe characters", () => {
    expect(() => normalizeAdminPath("/")).toThrow(/root/);
    expect(() => normalizeAdminPath("/uploads")).toThrow(/\/uploads/);
    expect(() => normalizeAdminPath("/Assets/x")).toThrow(/\/assets/);
    expect(() => normalizeAdminPath("/a b")).toThrow(/may only contain/);
    expect(() => normalizeAdminPath("/a/../b")).toThrow(/may only contain/);
    expect(() => normalizeAdminPath('/x"><script>')).toThrow(/may only contain/);
  });

  it("matches the admin path and everything below it only", () => {
    expect(isAdminPagePath("/studio", "/studio")).toBe(true);
    expect(isAdminPagePath("/studio/photos", "/studio")).toBe(true);
    expect(isAdminPagePath("/studios", "/studio")).toBe(false);
    expect(isAdminPagePath("/", "/studio")).toBe(false);
  });
});

describe("IpList", () => {
  it("matches addresses and CIDR ranges for IPv4 and IPv6", () => {
    const list = new IpList(["127.0.0.1", "192.168.1.0/24", "::1", "fd00::/8"]);
    expect(list.has("127.0.0.1")).toBe(true);
    expect(list.has("::ffff:127.0.0.1")).toBe(true);
    expect(list.has("192.168.1.200")).toBe(true);
    expect(list.has("192.168.2.1")).toBe(false);
    expect(list.has("::1")).toBe(true);
    expect(list.has("fd12::1")).toBe(true);
    expect(list.has("garbage")).toBe(false);
  });

  it("rejects invalid entries", () => {
    expect(() => new IpList(["10.0.0.0/33"])).toThrow(/prefix/);
    expect(() => new IpList(["10.0.0.0/8/1"])).toThrow();
    expect(() => new IpList(["example.com"])).toThrow();
  });
});
