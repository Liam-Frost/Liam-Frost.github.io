import { useCallback, useSyncExternalStore } from "react";

// Session-memory only: back/forward and page changes preserve drafts, never credentials in storage.
const values = new Map<string, unknown>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export function clearSettingsDrafts() {
  values.clear();
  emit();
}
export function clearSettingsDraftIfUnchanged(key: string, submitted: unknown) {
  if (values.get(key) !== submitted) return;
  values.delete(key);
  emit();
}
export function useSettingsDraft<T>(key: string) {
  const value = useSyncExternalStore(subscribe, () => (values.get(key) as T | undefined) ?? null);
  const set = useCallback(
    (next: T | null) => {
      if (next === null) values.delete(key);
      else values.set(key, next);
      emit();
    },
    [key]
  );
  return [value, set] as const;
}
export function useSettingsDraftCount() {
  return useSyncExternalStore(subscribe, () => values.size);
}
