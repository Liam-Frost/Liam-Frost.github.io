import { describe, expect, it } from "vitest";

import {
  queueSummary,
  UploadQueue,
  type QueueItem,
  type QueueWork
} from "../../admin/src/lib/upload-queue";

/** Work whose progress and outcome the test controls. */
function controlled(name: string, kind: QueueWork["kind"] = "upload") {
  const state = {
    runs: 0,
    progress: (_fraction: number) => {},
    finish: () => {},
    fail: (_error: Error) => {},
    aborted: false
  };
  const work: QueueWork = {
    name,
    kind,
    run: ({ onProgress, signal }) =>
      new Promise<void>((resolve, reject) => {
        state.runs += 1;
        state.progress = onProgress;
        state.finish = resolve;
        state.fail = reject;
        signal.addEventListener("abort", () => {
          state.aborted = true;
          reject(new Error("aborted"));
        });
      })
  };
  return { work, state };
}

function setup(concurrency = 2) {
  let items: QueueItem[] = [];
  const queue = new UploadQueue(
    concurrency,
    (next) => (items = next),
    (error) => (error instanceof Error ? error.message : "failed")
  );
  const statuses = () => items.map((item) => item.status);
  return { queue, statuses, items: () => items };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("upload queue", () => {
  it("runs a few at a time and says which are waiting", async () => {
    const { queue, statuses } = setup(2);
    const [a, b, c] = [controlled("a"), controlled("b"), controlled("c")];
    queue.add([a.work, b.work, c.work]);
    expect(statuses()).toEqual(["uploading", "uploading", "queued"]);

    a.state.progress(0.5);
    a.state.progress(1);
    expect(statuses()).toEqual(["processing", "uploading", "queued"]);

    a.state.finish();
    await settle();
    expect(statuses()).toEqual(["done", "uploading", "uploading"]);
    expect(c.state.runs).toBe(1);
  });

  it("keeps going after a failure and retries the failed item", async () => {
    const { queue, statuses, items } = setup(1);
    const [a, b] = [controlled("a"), controlled("b")];
    queue.add([a.work, b.work]);
    a.state.fail(new Error("too large"));
    await settle();
    expect(statuses()).toEqual(["error", "uploading"]);
    expect(items()[0]!.error).toBe("too large");

    b.state.finish();
    await settle();
    queue.retryFailed();
    expect(statuses()).toEqual(["uploading", "done"]);
    a.state.finish();
    await settle();
    expect(statuses()).toEqual(["done", "done"]);
    expect(a.state.runs).toBe(2);
  });

  it("cancels waiting and sending items, but not ones the server is processing", async () => {
    const { queue, statuses, items } = setup(2);
    const [a, b, c] = [controlled("a"), controlled("b"), controlled("c")];
    queue.add([a.work, b.work, c.work]);
    a.state.progress(1);
    expect(items()[0]!.cancellable).toBe(false);

    queue.cancelAll();
    await settle();
    expect(statuses()).toEqual(["processing", "cancelled", "cancelled"]);
    expect(b.state.aborted).toBe(true);
    expect(c.state.runs).toBe(0);

    a.state.finish();
    await settle();
    expect(statuses()).toEqual(["done", "cancelled", "cancelled"]);
  });

  it("lets a cancelled item be retried without the old run interfering", async () => {
    const { queue, statuses, items } = setup(1);
    const a = controlled("a");
    queue.add([a.work]);
    queue.cancel(items()[0]!.key);
    queue.retry(items()[0]!.key);
    await settle();
    expect(statuses()).toEqual(["uploading"]);
    a.state.finish();
    await settle();
    expect(statuses()).toEqual(["done"]);
  });

  it("shows imports as processing and forgets finished items on clear", async () => {
    const { queue, statuses, items } = setup(1);
    const [a, b] = [controlled("a", "import"), controlled("b", "import")];
    queue.add([a.work, b.work]);
    expect(statuses()).toEqual(["processing", "queued"]);
    expect(items()[0]!.cancellable).toBe(false);
    a.state.finish();
    await settle();
    queue.clear();
    expect(statuses()).toEqual(["processing"]);
    expect(queueSummary(items())).toMatchObject({ total: 1, active: 1, done: 0 });
  });
});
