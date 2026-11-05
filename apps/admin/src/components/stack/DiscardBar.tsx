/** Shown in a dialog's footer when it is closed with unsaved changes. */
export function DiscardBar({ onDiscard, onKeep }: { onDiscard: () => void; onKeep: () => void }) {
  return (
    <div role="alert" className="flex w-full flex-wrap items-center justify-end gap-2">
      <span className="mr-auto text-[12.5px] text-status-warn">有未保存的修改，确定放弃吗？</span>
      <button type="button" className="btn-secondary" onClick={onKeep} data-autofocus>
        继续编辑
      </button>
      <button type="button" className="btn-danger" onClick={onDiscard}>
        放弃修改
      </button>
    </div>
  );
}
