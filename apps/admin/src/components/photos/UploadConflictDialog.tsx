import type { AdminUploadConflict } from "@liam-frost/shared";
import { useState } from "react";

import { pickText } from "../../lib/i18n";
import { tr } from "../../lib/messages";
import type { ConflictDecision } from "../../lib/upload-plan";
import { Dialog } from "../ui/Dialog";

export type ConflictQuestion = {
  fileName: string;
  conflict: AdminUploadConflict;
  /** Conflicts still to come after this one. */
  remaining: number;
  answer: (result: { decision: ConflictDecision; all: boolean }) => void;
};

/**
 * Asks what to do with a file that matches an existing photo, like the file copy dialog of an operating
 * system: skip it, put it on that photo, or keep both. Closing the dialog skips the file.
 */
export function UploadConflictDialog({ question }: { question: ConflictQuestion | null }) {
  const [all, setAll] = useState(false);
  if (!question) return null;
  const { fileName, conflict, remaining, answer } = question;
  const title = pickText(conflict.photo.title, conflict.photo.id);
  const sameFile = conflict.reason === "content";
  const choose = (decision: ConflictDecision) => {
    answer({ decision, all });
    setAll(false);
  };

  return (
    <Dialog
      open
      size="sm"
      title={tr("照片已存在")}
      onClose={() => choose("skip")}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={() => choose("skip")}>
            {tr("跳过")}
          </button>
          {sameFile ? null : (
            <button type="button" className="btn-secondary" onClick={() => choose("replace")}>
              {tr("替换")}
            </button>
          )}
          <button type="button" className="btn-primary" onClick={() => choose("keep")}>
            {tr("都保留")}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <img
          src={conflict.photo.thumbnail}
          alt=""
          className="size-20 shrink-0 rounded-lg bg-line-soft object-cover"
        />
        <div className="min-w-0 space-y-1.5 text-[13.5px] leading-relaxed text-muted">
          <p className="break-all font-medium text-ink">{fileName}</p>
          <p>
            {sameFile
              ? tr("这个文件已经上传过，对应照片“{0}”。", title)
              : tr("照片“{0}”来自一个同名文件。", title)}
          </p>
          <p className="text-[12.5px] text-subtle">
            {sameFile
              ? tr("跳过不上传，或者作为另一张照片保留。")
              : tr("替换会把新图片换到这张照片上，照片信息保持不变；都保留会新增一张照片。")}
          </p>
        </div>
      </div>
      {remaining > 0 ? (
        <label className="mt-4 flex items-center gap-2 text-[13px] text-ink">
          <input
            type="checkbox"
            className="size-4 accent-[var(--color-brand)]"
            checked={all}
            onChange={(event) => setAll(event.target.checked)}
          />
          {tr("对剩下的 {0} 个冲突执行相同操作", remaining)}
        </label>
      ) : null}
    </Dialog>
  );
}
