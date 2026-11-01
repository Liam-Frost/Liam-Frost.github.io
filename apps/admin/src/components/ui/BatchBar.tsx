import type { AdminBatchResult } from "@liam-frost/shared";
import { CheckSquare, X } from "lucide-react";
import type { ReactNode } from "react";

import type { Selection } from "../../hooks/useSelection";

/** Bar along the bottom of the page while selecting: count, select all / none, the actions, and exit. */
export function BatchBar({
  selection,
  total,
  children
}: {
  selection: Selection;
  total: number;
  children: ReactNode;
}) {
  if (!selection.active) return null;
  const count = selection.selected.length;
  return (
    <div
      role="toolbar"
      aria-label="批量操作"
      className="sticky bottom-3 z-20 mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-[0_12px_40px_rgba(27,60,83,0.22)] backdrop-blur"
    >
      <span className="mr-1 text-[13px] font-semibold text-brand-dark" role="status">
        已选 {count} / {total}
      </span>
      <button
        type="button"
        className="btn-secondary"
        onClick={count === total ? selection.clear : selection.selectAll}
      >
        <CheckSquare aria-hidden="true" className="size-4" /> {count === total ? "全不选" : "全选"}
      </button>
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
      <button
        type="button"
        className="rounded-full p-1.5 text-subtle hover:bg-brand-secondary/12 hover:text-brand"
        aria-label="退出选择"
        onClick={selection.stop}
      >
        <X aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}

/** A short summary of a bulk action for a toast: how many changed, and the first reasons for the rest. */
export function describeBatch(result: AdminBatchResult, verb: string) {
  if (!result.failed.length) return { text: `已${verb} ${result.done.length} 项`, ok: true };
  const reasons = [...new Set(result.failed.map((f) => f.message))].slice(0, 2).join("；");
  return {
    text: `已${verb} ${result.done.length} 项，${result.failed.length} 项未处理：${reasons}`,
    ok: result.done.length > 0
  };
}

/** Checkbox drawn over a card or at the start of a row while selecting. */
export function SelectMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${checked ? "border-brand bg-brand text-white" : "border-line-strong bg-surface/90"}`}
    >
      {checked ? (
        <svg
          viewBox="0 0 16 16"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
        </svg>
      ) : null}
    </span>
  );
}
