/**
 * How the site chooses among several candidates (the about section's manifestos, the home page's
 * featured collection entries):
 * - fixed: the admin's choice or order;
 * - daily: changes once a day, the same for every visitor;
 * - visit: changes on each visit to the page (never the same start twice in a row);
 * - session: one per browsing session (tab), another in the next session.
 * The last two are chosen in the browser, since only it knows visits and sessions.
 */
export const ROTATION_MODES = ["fixed", "daily", "visit", "session"] as const;
export type RotationMode = (typeof ROTATION_MODES)[number];

const isMusic = (kind: string) => kind === "track" || kind === "album";

/**
 * The featured wall's order for one turn of the rotation (a day number, or the visit's or session's
 * draw): the candidates (oldest first) start `turn` places further on, then music and other entries
 * are mixed proportionally, keeping each one's order; the turn's first candidate stays first, so
 * every entry leads once every n turns.
 */
export function orderHomeWall<T extends { id: string; kind: string }>(
  base: T[],
  turn: number
): T[] {
  if (!base.length) return [];
  const offset = ((turn % base.length) + base.length) % base.length;
  const ordered = [...base.slice(offset), ...base.slice(0, offset)];
  const music = ordered.filter((row) => isMusic(row.kind));
  const other = ordered.filter((row) => !isMusic(row.kind));
  // Merge normalized positions: predictable proportional mixing, preserving each queue's order.
  const out: T[] = [];
  let m = 0,
    o = 0;
  while (m < music.length || o < other.length) {
    if (
      o === other.length ||
      (m < music.length && (m + 0.5) / music.length <= (o + 0.5) / other.length)
    )
      out.push(music[m++]!);
    else out.push(other[o++]!);
  }
  const first = out.findIndex((row) => row.id === ordered[0]!.id);
  return [...out.slice(first), ...out.slice(0, first)];
}
