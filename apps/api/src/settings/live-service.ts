/** Stable dependency reference; replace the entire client/cache only when its credentials change.
 * Bound methods keep each in-flight call on its original client rather than mixing old/new secrets.
 */
export function liveService<C, T extends object>(
  configuration: () => C,
  create: (config: C) => T
): T {
  let key: string | undefined;
  let current: T;
  return new Proxy({} as T, {
    get(_target, property) {
      const config = configuration();
      const next = JSON.stringify(config);
      if (!current || next !== key) {
        current = create(config);
        key = next;
      }
      const value: unknown = Reflect.get(current, property);
      return typeof value === "function" ? value.bind(current) : value;
    }
  });
}
