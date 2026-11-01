import type { ReactNode } from "react";

/** Small round icon button; the label is both the accessible name and the tooltip. */
export function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full p-1.5 text-faint transition-colors disabled:opacity-30 ${
        danger
          ? "hover:bg-status-error/10 hover:text-status-error"
          : "hover:bg-brand-secondary/12 hover:text-brand"
      }`}
    >
      {children}
    </button>
  );
}
