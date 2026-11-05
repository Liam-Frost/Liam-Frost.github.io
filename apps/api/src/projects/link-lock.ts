import { KeyedLock } from "../lib/keyed-lock";

const lock = new KeyedLock();

/**
 * Project ↔ technology links are written from two places (a technology's projects, a project's
 * technologies), each under its own lock. The per-project and per-technology limits are counted
 * across both, so every link write checks its limits and writes under this one shared lock: two
 * requests can no longer both pass the check and then both write. Always taken last (innermost),
 * so it cannot deadlock with the stack or project locks.
 */
export function withLinkWrites<T>(needed: boolean, work: () => Promise<T>): Promise<T> {
  return needed ? lock.run("project-technology-links", work) : work();
}
