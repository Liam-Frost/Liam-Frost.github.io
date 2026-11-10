import { useEffect, useRef, useState } from "react";

import { api } from "../lib/api";
import { tr } from "../lib/messages";
import { useUnsaved } from "../lib/unsaved";
import {
  interruptedBatch,
  isActive,
  isUnfinished,
  UploadQueue,
  type QueueItem,
  type SavedUpload
} from "../lib/upload-queue";

/** Files sent at once. The server limits how many images it processes at a time. */
const CONCURRENCY = 3;
const STORAGE_KEY = "lf-admin-upload-batch";

function readSaved(): SavedUpload[] {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]") as SavedUpload[];
    sessionStorage.removeItem(STORAGE_KEY);
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function writeSaved(items: QueueItem[]) {
  try {
    if (items.some((item) => isUnfinished(item.status)))
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          items.map(({ name, status, uploadId }): SavedUpload => ({ name, status, uploadId }))
        )
      );
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Blocked storage: an interrupted batch is simply not reported after a reload.
  }
}

export type InterruptedUploads = { done: number; unfinished: string[] };

/**
 * The page's upload queue. Unfinished work counts as unsaved, so leaving or reloading asks first. If the
 * page is reloaded anyway, `interrupted` says afterwards which files of that batch still need to be
 * chosen again; the server is asked which uploads it did complete.
 */
export function useUploadQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [interrupted, setInterrupted] = useState<InterruptedUploads | null>(null);
  const ref = useRef<UploadQueue | null>(null);
  ref.current ??= new UploadQueue(CONCURRENCY, setItems, (error, kind) =>
    error instanceof Error ? error.message : kind === "upload" ? tr("上传失败") : tr("添加失败")
  );
  useUnsaved(
    items.some((item) => isActive(item.status)),
    "page"
  );

  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const saved = readSaved();
    if (!saved.some((item) => isUnfinished(item.status))) return;
    const ids = saved.flatMap((item) =>
      item.uploadId && isUnfinished(item.status) ? [item.uploadId] : []
    );
    void (ids.length ? api.uploadStatus(ids) : Promise.resolve({ photos: {} }))
      .catch(() => ({ photos: {} }))
      .then(({ photos }) => {
        const batch = interruptedBatch(saved, photos);
        if (batch.unfinished.length) setInterrupted(batch);
      });
  }, []);

  useEffect(() => {
    if (restored.current) writeSaved(items);
  }, [items]);

  return {
    items,
    queue: ref.current,
    interrupted,
    dismissInterrupted: () => setInterrupted(null)
  };
}
