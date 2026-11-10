/**
 * A queue of uploads and imports that runs a few at a time. It knows nothing about React or the API, so
 * it can be tested on its own; the page passes each item's work in as a function.
 */
export type QueueStatus = "queued" | "uploading" | "processing" | "done" | "error" | "cancelled";

export type QueueItem = {
  key: string;
  name: string;
  /** Upload progress, 0 to 1. */
  progress: number;
  status: QueueStatus;
  error?: string;
  /** Sending the file can be stopped; once the server has it (or for an import), it cannot. */
  cancellable: boolean;
};

export type QueueWork = {
  name: string;
  /** "upload" sends a file and reports progress; "import" only waits for the server. */
  kind: "upload" | "import";
  run: (context: { onProgress: (fraction: number) => void; signal: AbortSignal }) => Promise<void>;
};

type Entry = { item: QueueItem; work: QueueWork; abort: AbortController | null };

const RUNNING: QueueStatus[] = ["uploading", "processing"];
export const isActive = (status: QueueStatus) => status === "queued" || RUNNING.includes(status);

export class UploadQueue {
  private entries: Entry[] = [];
  private snapshot: QueueItem[] = [];
  private counter = 0;

  constructor(
    private readonly concurrency: number,
    private readonly onChange: (items: QueueItem[]) => void,
    private readonly failureText: (error: unknown, kind: QueueWork["kind"]) => string
  ) {}

  get items() {
    return this.snapshot;
  }

  /** Newest batch first, in the order given. */
  add(works: QueueWork[]) {
    const added = works.map((work): Entry => {
      this.counter += 1;
      return {
        work,
        abort: null,
        item: {
          key: `${this.counter}-${work.name}`,
          name: work.name,
          progress: 0,
          status: "queued",
          cancellable: true
        }
      };
    });
    this.entries = [...added, ...this.entries];
    this.pump();
  }

  retry(key: string) {
    const entry = this.entries.find((e) => e.item.key === key);
    if (!entry || (entry.item.status !== "error" && entry.item.status !== "cancelled")) return;
    this.patch(entry, { status: "queued", progress: 0, error: undefined, cancellable: true });
    this.pump();
  }

  retryFailed() {
    for (const entry of this.entries)
      if (entry.item.status === "error")
        entry.item = {
          ...entry.item,
          status: "queued",
          progress: 0,
          error: undefined,
          cancellable: true
        };
    this.pump();
  }

  cancel(key: string) {
    const entry = this.entries.find((e) => e.item.key === key);
    if (!entry || !entry.item.cancellable || !isActive(entry.item.status)) return;
    this.stop(entry);
    this.pump();
  }

  /** Stops everything that still can be stopped; items the server is already working on finish. */
  cancelAll() {
    for (const entry of this.entries)
      if (entry.item.cancellable && isActive(entry.item.status)) this.stop(entry);
    this.pump();
  }

  /** Forgets finished items. */
  clear() {
    this.entries = this.entries.filter((entry) => isActive(entry.item.status));
    this.publish();
  }

  private stop(entry: Entry) {
    entry.item = { ...entry.item, status: "cancelled", cancellable: false };
    entry.abort?.abort();
    entry.abort = null;
  }

  private patch(entry: Entry, patch: Partial<QueueItem>) {
    entry.item = { ...entry.item, ...patch };
    this.publish();
  }

  private publish() {
    this.snapshot = this.entries.map((entry) => entry.item);
    this.onChange(this.snapshot);
  }

  private pump() {
    let running = this.entries.filter((entry) => RUNNING.includes(entry.item.status)).length;
    // Oldest first within a batch: entries are stored newest batch first, each batch in order.
    for (const entry of this.entries) {
      if (running >= this.concurrency) break;
      if (entry.item.status !== "queued") continue;
      running += 1;
      void this.run(entry);
    }
    this.publish();
  }

  private async run(entry: Entry) {
    const { work } = entry;
    const abort = new AbortController();
    entry.abort = abort;
    const upload = work.kind === "upload";
    entry.item = {
      ...entry.item,
      status: upload ? "uploading" : "processing",
      cancellable: upload,
      progress: upload ? 0 : 1
    };
    // The item may be cancelled and retried while this run is still settling: only the run that owns
    // the entry may change it.
    const mine = () => entry.abort === abort;
    try {
      await work.run({
        signal: abort.signal,
        onProgress: (fraction) => {
          if (!mine() || entry.item.status !== "uploading") return;
          this.patch(
            entry,
            fraction >= 1
              ? { progress: 1, status: "processing", cancellable: false }
              : { progress: fraction }
          );
        }
      });
      if (mine()) entry.item = { ...entry.item, status: "done", progress: 1, cancellable: false };
    } catch (error) {
      if (mine())
        entry.item = {
          ...entry.item,
          status: "error",
          cancellable: false,
          error: this.failureText(error, work.kind)
        };
    }
    if (mine()) entry.abort = null;
    this.pump();
  }
}

/** Counts for the queue's header. */
export function queueSummary(items: QueueItem[]) {
  const count = (status: QueueStatus) => items.filter((item) => item.status === status).length;
  const active = items.filter((item) => isActive(item.status)).length;
  return {
    total: items.length,
    done: count("done"),
    failed: count("error"),
    cancelled: count("cancelled"),
    active,
    /** Whether anything could still be stopped. */
    cancellable: items.some((item) => item.cancellable && isActive(item.status))
  };
}
