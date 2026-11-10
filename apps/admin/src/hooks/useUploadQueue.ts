import { useRef, useState } from "react";

import { tr } from "../lib/messages";
import { useUnsaved } from "../lib/unsaved";
import { isActive, UploadQueue, type QueueItem } from "../lib/upload-queue";

/** Files sent at once. The server limits how many images it processes at a time. */
const CONCURRENCY = 3;

/** The page's upload queue. Unfinished work counts as unsaved, so leaving or reloading asks first. */
export function useUploadQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const ref = useRef<UploadQueue | null>(null);
  ref.current ??= new UploadQueue(CONCURRENCY, setItems, (error, kind) =>
    error instanceof Error ? error.message : kind === "upload" ? tr("上传失败") : tr("添加失败")
  );
  useUnsaved(
    items.some((item) => isActive(item.status)),
    "page"
  );
  return { items, queue: ref.current };
}
