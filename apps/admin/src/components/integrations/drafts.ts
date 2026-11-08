import type { IntegrationProvider, IntegrationValues } from "@liam-frost/shared";
import { useCallback, useSyncExternalStore } from "react";

export type IntegrationDrafts = Partial<Record<IntegrationProvider, IntegrationValues>>;

/**
 * Unsaved API 配置 input, kept outside the page: the admin's router has no navigation blocker, so a
 * link elsewhere unmounts the page without asking, and the drafts would be lost. They live only in
 * memory and are dropped on save, 取消修改, sign-out and reload.
 */
let stored: IntegrationDrafts = {};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export function clearIntegrationDrafts() {
  stored = {};
  emit();
}
export function useIntegrationDrafts() {
  const drafts = useSyncExternalStore(subscribe, () => stored);
  const setDraft = useCallback((provider: IntegrationProvider, values: IntegrationValues) => {
    stored = { ...stored, [provider]: values };
    emit();
  }, []);
  return { drafts, setDraft };
}
