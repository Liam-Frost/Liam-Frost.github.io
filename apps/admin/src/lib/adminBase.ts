import { ADMIN_PATH_META } from "@liam-frost/shared";

/**
 * The admin mount path, written into the page by the server only when the admin path itself is requested.
 * Without it (a guessed URL, or the page opened some other way) the app shows "not found" and never calls the API.
 */
export function readAdminBase(doc: Pick<Document, "querySelector"> = document): string | undefined {
  const value = doc
    .querySelector<HTMLMetaElement>(`meta[name="${ADMIN_PATH_META}"]`)
    ?.content.trim();
  return value && /^\/[A-Za-z0-9_/-]+$/.test(value) ? value.replace(/\/+$/, "") : undefined;
}

export const ADMIN_BASE = readAdminBase();
