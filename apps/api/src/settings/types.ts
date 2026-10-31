/** Stores one JSON document per key. Callers validate what they read back. */
export interface SettingsRepository {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

/** Keeps settings in memory, for running without a database (and for tests). */
export class MemorySettingsRepository implements SettingsRepository {
  private readonly values = new Map<string, unknown>();

  async get(key: string) {
    return structuredClone(this.values.get(key) ?? null);
  }

  async set(key: string, value: unknown) {
    this.values.set(key, structuredClone(value));
  }
}
