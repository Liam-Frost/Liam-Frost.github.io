import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "lg";
};

/**
 * Modal on the native <dialog>: the browser provides focus trapping, Esc to close and top-layer rendering.
 * Mark the field that should receive focus on open with `data-autofocus`.
 */
export function Dialog({ open, title, onClose, children, footer, size = "lg" }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // showModal focuses the first focusable element (the close button); React's autoFocus does not
      // reach the native dialog, so fields that should get focus are marked with data-autofocus.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Rendered into <body>: dialogs often open from inside an editor's <form>, and a form nested in it would
  // submit the editor (or reload the page). React still bubbles events along the component tree, so a
  // submit inside the dialog stops here.
  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onSubmit={(e) => e.stopPropagation()}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={`m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-24px)] overflow-hidden rounded-[20px] border border-line bg-surface p-0 text-ink shadow-[0_24px_70px_rgba(27,60,83,0.28)] backdrop:bg-brand-dark/40 ${
        size === "lg" ? "max-w-[860px]" : "max-w-[420px]"
      }`}
    >
      {open ? (
        <div className="flex max-h-[calc(100dvh-32px)] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
            <h2 id={titleId} className="text-[17px] font-semibold text-brand-dark">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              className="rounded-full p-1.5 text-faint hover:bg-brand-secondary/12 hover:text-brand"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer ? (
            <div className="flex flex-wrap justify-end gap-2 border-t border-line-soft px-5 py-3.5">
              {footer}
            </div>
          ) : null}
        </div>
      ) : null}
    </dialog>,
    document.body
  );
}
