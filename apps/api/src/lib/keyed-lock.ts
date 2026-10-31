/**
 * Runs async work one at a time per key (in this process). Used for read-modify-write updates of a
 * project's JSON image lists, which would otherwise lose concurrent changes. Single-instance only,
 * like the rest of the admin state.
 */
export class KeyedLock {
  private readonly tails = new Map<string, Promise<unknown>>();

  run<T>(key: string, work: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const result = previous.then(work, work);
    const tail = result.catch(() => undefined);
    this.tails.set(key, tail);
    void tail.then(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key);
    });
    return result;
  }
}
