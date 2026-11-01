import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";

export type UploadItem = {
  key: string;
  name: string;
  progress: number;
  status: "uploading" | "processing" | "done" | "error";
  error?: string;
};

const STATUS_TEXT: Record<UploadItem["status"], string> = {
  uploading: "上传中",
  processing: "处理中",
  done: "已完成",
  error: "失败"
};

/** Per-file upload progress; the server's processing time shows as "处理中" after the bytes are sent. */
export function UploadQueue({ items, onClear }: { items: UploadItem[]; onClear: () => void }) {
  if (!items.length) return null;
  const active = items.some((item) => item.status === "uploading" || item.status === "processing");

  return (
    <section aria-label="上传进度" className="card mb-5 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-brand-dark">上传</h2>
        {!active ? (
          <button
            type="button"
            className="text-[12px] text-subtle hover:text-brand"
            onClick={onClear}
          >
            清除记录
          </button>
        ) : null}
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.key} className="text-[12.5px]">
            <div className="flex items-center gap-2">
              {item.status === "done" ? (
                <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-status-ok" />
              ) : item.status === "error" ? (
                <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-status-error" />
              ) : (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 shrink-0 animate-spin text-brand-secondary"
                />
              )}
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span className={item.status === "error" ? "text-status-error" : "text-subtle"}>
                {item.status === "error" ? item.error : STATUS_TEXT[item.status]}
              </span>
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
