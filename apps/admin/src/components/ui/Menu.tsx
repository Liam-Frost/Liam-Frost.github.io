import { MoreHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Tooltip } from "./Tooltip";

export type MenuItem = {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
};

/**
 * "More actions": a round button opening a menu of less frequent actions. Keyboard: Enter / Space /
 * ↓ open it on the first item, ↑ ↓ Home End move, Esc closes and returns focus to the button.
 */
export function Menu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const focusItem = (index: number) => {
    const buttons = [
      ...(list.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not(:disabled)") ?? [])
    ];
    if (!buttons.length) return;
    buttons[(index + buttons.length) % buttons.length]!.focus();
  };

  useEffect(() => {
    if (!open) return;
    focusItem(0);
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  return (
    <div ref={root} className="relative inline-flex shrink-0">
      <Tooltip content={label} describe={false} className="inline-flex">
        <button
          ref={button}
          type="button"
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          onClick={() => setOpen((value) => !value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
            }
          }}
          className="rounded-full p-1.5 text-faint transition-colors hover:bg-brand-secondary/12 hover:text-brand"
        >
          <MoreHorizontal aria-hidden="true" className="size-4" />
        </button>
      </Tooltip>
      {open ? (
        <div
          ref={list}
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={(event) => {
            const buttons = [
              ...(list.current?.querySelectorAll<HTMLButtonElement>(
                "[role=menuitem]:not(:disabled)"
              ) ?? [])
            ];
            const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
            if (event.key === "ArrowDown") focusItem(current + 1);
            else if (event.key === "ArrowUp") focusItem(current - 1);
            else if (event.key === "Home") focusItem(0);
            else if (event.key === "End") focusItem(-1);
            else if (event.key === "Escape" || event.key === "Tab") {
              if (event.key === "Escape") event.stopPropagation();
              close();
              return;
            } else return;
            event.preventDefault();
          }}
          className="absolute top-full right-0 z-40 mt-1 min-w-[168px] rounded-xl border border-line bg-surface py-1 shadow-card-hover"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] whitespace-nowrap transition-colors focus:outline-none disabled:opacity-40 ${
                item.danger
                  ? "text-status-error hover:bg-status-error/8 focus:bg-status-error/8"
                  : "text-ink hover:bg-brand-secondary/10 focus:bg-brand-secondary/10"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
