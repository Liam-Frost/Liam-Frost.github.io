import type { AdminUploadConflict } from "@liam-frost/shared";
import { describe, expect, it } from "vitest";

import { planUploads, type ConflictDecision } from "../../admin/src/lib/upload-plan";
import { interruptedBatch } from "../../admin/src/lib/upload-queue";

const file = (name: string) => ({ name });
const conflict = (index: number, reason: "content" | "name", id = `photo-${index}`) =>
  ({ index, reason, photo: { id, title: {}, thumbnail: "" } }) satisfies AdminUploadConflict;

/** Answers conflicts from a script and records what was asked. */
function answers(script: { decision: ConflictDecision; all?: boolean }[]) {
  const asked: { name: string; remaining: number }[] = [];
  const ask = async (f: { name: string }, _c: AdminUploadConflict, remaining: number) => {
    asked.push({ name: f.name, remaining });
    const next = script.shift()!;
    return { decision: next.decision, all: next.all ?? false };
  };
  return { ask, asked };
}

describe("upload plan", () => {
  it("uploads files without conflicts as new photos, sending identical files once", async () => {
    const { ask, asked } = answers([]);
    const plan = await planUploads(
      [file("a.jpg"), file("copy-of-a.jpg"), file("b.jpg")],
      ["h1", "h1", "h2"],
      [],
      ask
    );
    expect(plan.uploads.map((u) => [u.file.name, u.action])).toEqual([
      ["a.jpg", "new"],
      ["b.jpg", "new"]
    ]);
    expect(plan.skipped).toEqual(["copy-of-a.jpg"]);
    expect(asked).toEqual([]);
  });

  it("asks about each conflict and applies the answer", async () => {
    const { ask, asked } = answers([
      { decision: "skip" },
      { decision: "replace" },
      { decision: "keep" }
    ]);
    const plan = await planUploads(
      [file("a.jpg"), file("b.jpg"), file("c.jpg"), file("d.jpg")],
      ["h1", "h2", "h3", "h4"],
      [conflict(0, "name"), conflict(1, "name"), conflict(3, "content")],
      ask
    );
    expect(asked).toEqual([
      { name: "a.jpg", remaining: 2 },
      { name: "b.jpg", remaining: 1 },
      { name: "d.jpg", remaining: 0 }
    ]);
    expect(plan.skipped).toEqual(["a.jpg"]);
    expect(plan.uploads).toEqual([
      { file: file("b.jpg"), action: "replace", photoId: "photo-1" },
      { file: file("c.jpg"), action: "new" },
      { file: file("d.jpg"), action: "new" }
    ]);
  });

  it("stops asking once an answer is given for all, and never replaces with the same file", async () => {
    const { ask, asked } = answers([{ decision: "replace", all: true }]);
    const plan = await planUploads(
      [file("a.jpg"), file("b.jpg"), file("c.jpg")],
      ["h1", "h2", "h3"],
      [conflict(0, "name"), conflict(1, "content"), conflict(2, "name")],
      ask
    );
    expect(asked).toHaveLength(1);
    expect(plan.uploads.map((u) => u.action)).toEqual(["replace", "replace"]);
    expect(plan.skipped).toEqual(["b.jpg"]);
  });

  it("works without hashes (no Web Crypto): nothing is merged or asked", async () => {
    const { ask } = answers([]);
    const plan = await planUploads([file("a.jpg"), file("a.jpg")], [null, null], [], ask);
    expect(plan.uploads).toHaveLength(2);
  });
});

describe("interrupted batch", () => {
  it("lists what still has to be chosen again, counting uploads the server completed", () => {
    const batch = interruptedBatch(
      [
        { name: "done.jpg", status: "done", uploadId: "u1" },
        { name: "arrived.jpg", status: "processing", uploadId: "u2" },
        { name: "lost.jpg", status: "uploading", uploadId: "u3" },
        { name: "waiting.jpg", status: "queued", uploadId: "u4" },
        { name: "failed.jpg", status: "error", uploadId: "u5" },
        { name: "skipped.jpg", status: "skipped" }
      ],
      { u2: "photo-2" }
    );
    expect(batch).toEqual({ done: 2, unfinished: ["lost.jpg", "waiting.jpg", "failed.jpg"] });
  });
});
