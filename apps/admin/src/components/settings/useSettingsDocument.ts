import {
  sameSettingsValue,
  type SettingsConflictDetails,
  type SettingsFieldPatch
} from "@liam-frost/shared";
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey
} from "@tanstack/react-query";
import { useState } from "react";

import { ApiError, request } from "../../lib/api";
import { tr } from "../../lib/messages";
import { useToast } from "../ui/Toast";
import { clearSettingsDraftIfUnchanged, useSettingsDraft } from "./drafts";

export type SettingsConflict = {
  fields: { field: string; current: unknown; draft: unknown }[];
};

type Options<Document, Value extends object> = {
  draftKey: string;
  queryKey: QueryKey;
  url: string;
  /** The editable value inside the response. */
  read: (document: Document) => Value;
  onSaved?: () => void;
};

/**
 * A settings document being edited: the server's value with this editor's changed fields on top.
 * A draft holds only the fields it changed and what they were changed from, so it stays current with
 * fields saved elsewhere, and a save can only conflict over a field both sides changed.
 */
export function useSettingsDocument<Document, Value extends object>({
  draftKey,
  queryKey,
  url,
  read,
  onSaved
}: Options<Document, Value>) {
  const qc = useQueryClient(),
    toast = useToast();
  const query = useQuery({ queryKey, queryFn: () => request<Document>(url) });
  const [draft, setDraft] = useSettingsDraft<SettingsFieldPatch>(draftKey);
  const [conflict, setConflict] = useState<SettingsConflict | null>(null);
  const busy = useIsMutating({ mutationKey: queryKey }) > 0;

  const server = query.data ? read(query.data) : undefined;
  const value = server ? ({ ...server, ...draft?.changes } as Value) : undefined;

  const save = useMutation({
    mutationKey: queryKey,
    mutationFn: (patch: SettingsFieldPatch) =>
      request<Document>(url, { method: "PATCH", json: patch }),
    onSuccess: (document, submitted) => {
      qc.setQueryData(queryKey, document);
      clearSettingsDraftIfUnchanged(draftKey, submitted);
      setConflict(null);
      toast(tr("已保存，网站上马上生效"));
      onSaved?.();
    },
    onError: (error: Error, submitted) => {
      if (error instanceof ApiError && error.code === "SETTINGS_CONFLICT") {
        const details = error.details as SettingsConflictDetails<Document>;
        qc.setQueryData(queryKey, details.current);
        const latest = read(details.current) as Record<string, unknown>;
        setConflict({
          fields: details.fields.map((field) => ({
            field,
            current: latest[field],
            draft: submitted.changes[field]
          }))
        });
        return;
      }
      toast(error.message, "error");
    }
  });

  const change = (next: Value) => {
    if (!server || busy) return;
    const stored = server as Record<string, unknown>,
      changes: Record<string, unknown> = {},
      base: Record<string, unknown> = {};
    for (const [field, item] of Object.entries(next)) {
      const from = draft && field in draft.base ? draft.base[field] : stored[field];
      if (sameSettingsValue(item, from)) continue;
      changes[field] = item;
      base[field] = from;
    }
    setDraft(Object.keys(changes).length ? { changes, base } : null);
  };

  const discard = () => {
    setDraft(null);
    setConflict(null);
    save.reset();
  };

  /** Drops this editor's version of the conflicting fields. */
  const useLatest = () => {
    if (!draft || !conflict) return;
    const changes = { ...draft.changes },
      base = { ...draft.base };
    for (const { field } of conflict.fields) {
      delete changes[field];
      delete base[field];
    }
    setDraft(Object.keys(changes).length ? { changes, base } : null);
    setConflict(null);
    save.reset();
  };

  /** Keeps this editor's version, to overwrite the other one on the next save. */
  const keepMine = () => {
    if (!draft || !conflict) return;
    const base = { ...draft.base };
    for (const { field, current } of conflict.fields) base[field] = current;
    setDraft({ changes: draft.changes, base });
    setConflict(null);
    save.reset();
  };

  return {
    query,
    value,
    dirty: draft !== null,
    busy,
    saved: save.isSuccess,
    /** Conflicts are shown by their own panel, not as a failure. */
    error: save.error && !conflict ? save.error.message : undefined,
    conflict,
    change,
    save: () => {
      if (draft) save.mutate(draft);
    },
    discard,
    useLatest,
    keepMine
  };
}
