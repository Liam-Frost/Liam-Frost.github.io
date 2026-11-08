import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

import { tr } from "../../lib/messages";
import { Dialog } from "./Dialog";

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
};

const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(() =>
  Promise.resolve(false)
);

/** Asks before something that cannot be taken back; resolves to the answer. */
export const useConfirm = () => useContext(ConfirmContext);

/** The dialog body of a confirmation, also used by the navigation guard. */
export function ConfirmDialog({
  open,
  options,
  onAnswer
}: {
  open: boolean;
  options: ConfirmOptions | null;
  onAnswer: (answer: boolean) => void;
}) {
  return (
    <Dialog
      open={open}
      size="sm"
      title={options?.title ?? ""}
      onClose={() => onAnswer(false)}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={() => onAnswer(false)}>
            {options?.cancelLabel ?? tr("取消")}
          </button>
          <button
            type="button"
            className={options?.danger ? "btn-danger" : "btn-primary"}
            onClick={() => onAnswer(true)}
          >
            {options?.confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-[13.5px] leading-relaxed text-muted">{options?.message}</p>
    </Dialog>
  );
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((answer: boolean) => void) | null>(null);
  const confirm = useCallback((next: ConfirmOptions) => {
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);
  const answer = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  };
  return (
    <ConfirmContext value={confirm}>
      {children}
      <ConfirmDialog open={options !== null} options={options} onAnswer={answer} />
    </ConfirmContext>
  );
}
