/** `<meta>` name the server uses to tell the admin app where it is mounted. */
export const ADMIN_PATH_META = "lf-admin-path";

export const DEFAULT_ADMIN_PATH = "/admin";

/** Path prefixes owned by the API or static assets; the admin path must not collide with them. */
const RESERVED_PREFIXES = ["/api", "/uploads", "/assets"];

const SEGMENT = /^[A-Za-z0-9_-]+$/;

/**
 * Normalizes an ADMIN_PATH value: adds a leading slash, drops trailing slashes.
 * Throws with a readable message when the value is unusable.
 */
export function normalizeAdminPath(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return DEFAULT_ADMIN_PATH;

  const path = `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
  if (path === "/") {
    throw new Error("ADMIN_PATH cannot be the site root");
  }

  const segments = path.slice(1).split("/");
  if (!segments.every((segment) => SEGMENT.test(segment))) {
    throw new Error("ADMIN_PATH may only contain letters, digits, '-', '_' and '/' between segments");
  }

  const lower = path.toLowerCase();
  const reserved = RESERVED_PREFIXES.find((prefix) => lower === prefix || lower.startsWith(`${prefix}/`));
  if (reserved) {
    throw new Error(`ADMIN_PATH cannot start with ${reserved}`);
  }

  return path;
}

/** True for the admin path itself and anything below it (`/admin`, `/admin/`, `/admin/photos`). */
export function isAdminPagePath(pathname: string, adminPath: string): boolean {
  return pathname === adminPath || pathname.startsWith(`${adminPath}/`);
}
