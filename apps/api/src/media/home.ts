import type { CollectionSettings, LocalizedText, PublicHomeFeatured } from "@liam-frost/shared";

import type { MediaRow } from "./types";

/** Featured entries on the home page. */
export const HOME_FEATURED = 3;
/** Longest review excerpt, in characters. */
export const EXCERPT_LENGTH = 90;

const DAY_MS = 24 * 60 * 60 * 1000;
const SENTENCE_END = /[。！？!?.…]/u;

/**
 * The home page's featured entries among the shown ones.
 * - manual: the admin's fixed order (entries never ordered go last, newest first).
 * - rotate: a window that moves by `limit` each day over the featured entries (oldest first), so
 *   every visitor sees the same picks on a given day; kinds are spread before any kind repeats.
 */
export function pickHomeFeatured(
  rows: MediaRow[],
  mode: CollectionSettings["homeFeatured"],
  day: string,
  limit = HOME_FEATURED
): MediaRow[] {
  const featured = rows.filter((row) => row.featured);
  if (mode === "manual") {
    return featured
      .sort(
        (a, b) =>
          (a.featuredOrder ?? Infinity) - (b.featuredOrder ?? Infinity) ||
          b.updatedAt.getTime() - a.updatedAt.getTime() ||
          a.id.localeCompare(b.id)
      )
      .slice(0, limit);
  }

  if (featured.length <= limit) return featured;
  const base = featured.sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)
  );
  const offset = (Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS) * limit) % base.length;
  const rotated = [...base.slice(offset), ...base.slice(0, offset)];

  const picked: MediaRow[] = [];
  const kinds = new Set<string>();
  for (const row of rotated) {
    if (picked.length === limit) break;
    if (kinds.has(row.kind)) continue;
    picked.push(row);
    kinds.add(row.kind);
  }
  for (const row of rotated) {
    if (picked.length === limit) break;
    if (!picked.includes(row)) picked.push(row);
  }
  return picked;
}

/** The start of a text: whole sentences when one ends in time, otherwise cut with "…". */
export function excerpt(text: string, max = EXCERPT_LENGTH) {
  const chars = Array.from(text.replace(/\s+/g, " ").trim());
  if (chars.length <= max) return chars.join("");
  let end = -1;
  for (let i = max - 1; i >= Math.floor(max * 0.4); i--) {
    if (SENTENCE_END.test(chars[i]!)) {
      end = i;
      break;
    }
  }
  return end >= 0
    ? chars.slice(0, end + 1).join("")
    : `${chars
        .slice(0, max - 1)
        .join("")
        .trimEnd()}…`;
}

export function toHomeFeatured(row: MediaRow): PublicHomeFeatured {
  const out: LocalizedText = {};
  for (const [lang, text] of Object.entries(row.review) as [keyof LocalizedText, string][]) {
    if (text?.trim()) out[lang] = excerpt(text);
  }
  return { id: row.id, excerpt: out };
}
