import type { IntegrationProvider, IntegrationValues } from "@liam-frost/shared";
import { useCallback, useState } from "react";

export type IntegrationDrafts = Partial<Record<IntegrationProvider, IntegrationValues>>;

/**
 * Unsaved API 配置 input, kept outside the page: the admin's router has no navigation blocker, so a
 * link elsewhere unmounts the page without asking, and the drafts would be lost. They live only in
 * memory and are dropped on save, 取消修改, sign-out and reload.
 */
let stored: IntegrationDrafts = {};

export function clearIntegrationDrafts() {
  stored = {};
}

export function useIntegrationDrafts() {
  const [drafts, setDrafts] = useState<IntegrationDrafts>(() => stored);
  const setDraft = useCallback((provider: IntegrationProvider, values: IntegrationValues) => {
    setDrafts((current) => {
      const next = { ...current, [provider]: values };
      stored = next;
      return next;
    });
  }, []);
  return { drafts, setDraft };
}
