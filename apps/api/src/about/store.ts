import { DEFAULT_ABOUT, type AboutContent } from "@liam-frost/shared";
import { createHash } from "node:crypto";

import { aboutContentSchema } from "../lib/validation";
import type { SettingsRepository } from "../settings/types";

const KEY = "about";
const CACHE_MS = 30_000;

export type LoadedAbout = { about: AboutContent; revision: string; saved: boolean };

/** Identifies saved content by the hash of its JSON; "default" before the first save. */
const revisionOf = (about: AboutContent) =>
  createHash("sha256").update(JSON.stringify(about)).digest("base64url").slice(0, 22);

/**
 * The about section's content (manifestos, rotation, gear) as one validated document in the
 * settings table. Missing or unreadable content reads as the defaults. Saves are serialized and
 * checked against the revision they started from, so a stale admin page cannot overwrite a newer
 * save; they update the short cache at once.
 */
export class AboutStore {
  private cached: { value: LoadedAbout; at: number } | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly repo: SettingsRepository,
    private readonly now: () => number = Date.now
  ) {}

  async get(): Promise<LoadedAbout> {
    if (this.cached && this.now() - this.cached.at < CACHE_MS) return this.cached.value;
    const stored = await this.repo.get(KEY);
    const parsed = stored === null ? null : aboutContentSchema.safeParse(stored);
    const value: LoadedAbout = parsed?.success
      ? { about: parsed.data, revision: revisionOf(parsed.data), saved: true }
      : { about: DEFAULT_ABOUT, revision: "default", saved: false };
    this.cached = { value, at: this.now() };
    return value;
  }

  /** Saves unless the saved revision is no longer `revision`; answers with the new state. */
  save(about: AboutContent, revision: string): Promise<LoadedAbout | "conflict"> {
    const run = this.queue.then(async () => {
      this.cached = null;
      const current = await this.get();
      if (current.revision !== revision) return "conflict" as const;
      await this.repo.set(KEY, about);
      const value: LoadedAbout = { about, revision: revisionOf(about), saved: true };
      this.cached = { value, at: this.now() };
      return value;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}
