import type { AdminUploadConflict } from "@liam-frost/shared";

/** What to do with a file that matches an existing photo, like a file copy dialog. */
export type ConflictDecision = "skip" | "replace" | "keep";

export type PlannedUpload<F> =
  { file: F; action: "new" } | { file: F; action: "replace"; photoId: string };

/** SHA-256 of a file, hex; null where the browser offers no Web Crypto (plain http). */
export async function sha256Hex(file: Blob): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Turns the chosen files into uploads. Identical files within the batch are sent once; each conflict
 * with an existing photo is put to `ask`, until an answer is given for all remaining conflicts.
 * Replacing a photo with the very same file would change nothing, so that counts as skipping.
 */
export async function planUploads<F extends { name: string }>(
  files: F[],
  hashes: (string | null)[],
  conflicts: AdminUploadConflict[],
  ask: (
    file: F,
    conflict: AdminUploadConflict,
    remaining: number
  ) => Promise<{ decision: ConflictDecision; all: boolean }>
): Promise<{ uploads: PlannedUpload<F>[]; skipped: string[] }> {
  const uploads: PlannedUpload<F>[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  const byIndex = new Map(conflicts.map((conflict) => [conflict.index, conflict]));
  let remaining = conflicts.length;
  let forAll: ConflictDecision | null = null;

  for (const [index, file] of files.entries()) {
    const hash = hashes[index];
    const conflict = byIndex.get(index);
    if (conflict) remaining -= 1;
    if (hash) {
      if (seen.has(hash)) {
        skipped.push(file.name);
        continue;
      }
      seen.add(hash);
    }
    if (!conflict) {
      uploads.push({ file, action: "new" });
      continue;
    }
    let decision: ConflictDecision | null = forAll;
    if (!decision) {
      const answer = await ask(file, conflict, remaining);
      decision = answer.decision;
      if (answer.all) forAll = decision;
    }
    if (decision === "replace" && conflict.reason === "content") decision = "skip";
    if (decision === "skip") skipped.push(file.name);
    else if (decision === "keep") uploads.push({ file, action: "new" });
    else uploads.push({ file, action: "replace", photoId: conflict.photo.id });
  }
  return { uploads, skipped };
}
