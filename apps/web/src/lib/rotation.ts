import type { RotationMode } from "@liam-frost/shared";

const TIME_ZONE = "America/Vancouver";

function read(storage: () => Storage, key: string) {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function write(storage: () => Storage, key: string, value: string) {
  try {
    storage().setItem(key, value);
  } catch {
    // Private windows or blocked storage: the choice just is not remembered.
  }
}

/** Days since 1970-01-01 in the site's time zone, so a day starts at the same moment for everyone. */
export function dayNumber(now: Date) {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE })
    .format(now)
    .split("-")
    .map(Number);
  return Math.floor(Date.UTC(y!, m! - 1, d!) / 86_400_000);
}

/**
 * Which of `ids` leads now under a rotating mode (see RotationMode), as an index: daily by the
 * site's day, visit drawn anew each call (never the last one shown), session kept for the tab.
 * `scope` keeps the choices of different rotations apart in storage. Call it once per visit.
 */
export function rotationTurn(
  ids: string[],
  mode: Exclude<RotationMode, "fixed">,
  scope: string,
  now = new Date()
): number {
  if (!ids.length) return 0;
  if (mode === "daily") return dayNumber(now) % ids.length;
  const lastKey = `${scope}:last`;
  const sessionKey = `${scope}:session`;
  if (mode === "session") {
    const kept = ids.indexOf(read(() => sessionStorage, sessionKey) ?? "");
    if (kept >= 0) return kept;
  }
  const last = read(() => localStorage, lastKey);
  const pool = ids.map((_, i) => i).filter((i) => ids.length === 1 || ids[i] !== last);
  const turn = pool[Math.floor(Math.random() * pool.length)]!;
  write(() => localStorage, lastKey, ids[turn]!);
  if (mode === "session") write(() => sessionStorage, sessionKey, ids[turn]!);
  return turn;
}
