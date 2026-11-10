import {
  CircleAlert,
  CircleCheck,
  CircleSlash,
  Clock,
  LoaderCircle,
  RotateCw,
  X
} from "lucide-react";

import { tr } from "../../lib/messages";
import { isActive, queueSummary, type QueueItem, type QueueStatus } from "../../lib/upload-queue";

const STATUS_TEXT: Record<QueueStatus, string> = {
  queued: tr("等待中"),
  uploading: tr("上传中"),
  processing: tr("处理中"),
  done: tr("已完成"),
  error: tr("失败"),
  cancelled: tr("已取消")
};

const ACTION =
  "inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[12px] text-subtle hover:text-brand";

function StatusIcon({ status }: { status: QueueStatus }) {
  const size = "size-4 shrink-0";
  if (status === "done")
    return <CircleCheck aria-hidden="true" className={`${size} text-status-ok`} />;
  if (status === "error")
    return <CircleAlert aria-hidden="true" className={`${size} text-status-error`} />;
  if (status === "cancelled")
    return <CircleSlash aria-hidden="true" className={`${size} text-faint`} />;
  if (status === "queued") return <Clock aria-hidden="true" className={`${size} text-faint`} />;
  return (
    <LoaderCircle aria-hidden="true" className={`${size} animate-spin text-brand-secondary`} />
  );
}

/**
 * Progress of uploads and imports. Waiting items say so; the server's processing time shows as
 * "处理中". Failed items can be retried, and items not yet handed to the server can be cancelled.
 */
export function UploadQueue({
  items,
  onRetry,
  onRetryFailed,
  onCancel,
  onCancelAll,
  onClear
}: {
  items: QueueItem[];
  onRetry: (key: string) => void;
  onRetryFailed: () => void;
  onCancel: (key: string) => void;
  onCancelAll: () => void;
  onClear: () => void;
}) {
  if (!items.length) return null;
  const summary = queueSummary(items);
  const settled = summary.total - summary.active;

  return (
    <section aria-label={tr("添加进度")} className="card mb-5 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="text-[13px] font-semibold text-brand-dark">
          {tr("添加")}
          <span className="ml-2 font-normal text-subtle" aria-live="polite">
            {tr("{0} / {1} 已完成", summary.done, summary.total)}
            {summary.failed ? tr("，{0} 个失败", summary.failed) : ""}
          </span>
        </h2>
        <div className="flex items-center gap-1">
          {summary.failed ? (
            <button type="button" className={ACTION} onClick={onRetryFailed}>
              <RotateCw aria-hidden="true" className="size-3.5" />
              {tr("全部重试")}
            </button>
          ) : null}
          {summary.cancellable ? (
            <button type="button" className={ACTION} onClick={onCancelAll}>
              {tr("取消未开始的")}
            </button>
          ) : null}
          {settled ? (
            <button type="button" className={ACTION} onClick={onClear}>
              {tr("清除记录")}
            </button>
          ) : null}
        </div>
      </div>
      {summary.active ? (
        <div
          className="mb-3 h-1 overflow-hidden rounded-full bg-line-soft"
          role="progressbar"
          aria-valuenow={settled}
          aria-valuemin={0}
          aria-valuemax={summary.total}
          aria-label={tr("整体进度")}
        >
          <div
            className="h-full bg-brand-secondary transition-[width]"
            style={{ width: `${(settled / summary.total) * 100}%` }}
          />
        </div>
      ) : null}
      <ul className="max-h-80 space-y-2 overflow-y-auto">
        {items.map((item) => (
          <li key={item.key} className="text-[12.5px]">
            <div className="flex items-center gap-2">
              <StatusIcon status={item.status} />
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span className={item.status === "error" ? "text-status-error" : "text-subtle"}>
                {item.status === "error" ? item.error : STATUS_TEXT[item.status]}
              </span>
              {item.status === "error" || item.status === "cancelled" ? (
                <button
                  type="button"
                  className={ACTION}
                  aria-label={tr("重试 {0}", item.name)}
                  onClick={() => onRetry(item.key)}
                >
                  <RotateCw aria-hidden="true" className="size-3.5" />
                  {tr("重试")}
                </button>
              ) : null}
              {item.cancellable && isActive(item.status) ? (
                <button
                  type="button"
                  className={ACTION}
                  aria-label={tr("取消 {0}", item.name)}
                  onClick={() => onCancel(item.key)}
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              ) : null}
            </div>
            {item.status === "uploading" ? (
              <div
                className="mt-1 h-1 overflow-hidden rounded-full bg-line-soft"
                role="progressbar"
                aria-valuenow={Math.round(item.progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={item.name}
              >
                <div
                  className="h-full bg-brand-secondary transition-[width]"
                  style={{ width: `${item.progress * 100}%` }}
                />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
