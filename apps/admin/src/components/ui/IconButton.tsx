import type { ReactNode } from "react";

import { Tooltip } from "./Tooltip";

/** Small round icon button; the label is both the accessible name and the tooltip. */
export function IconButton({
  label,
  onClick,
  disabled,
  danger,
  size = "sm",
  children
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  size?: "sm" | "md";
  children: ReactNode;
}) {
  return (
    <Tooltip content={label} describe={false} className="inline-flex shrink-0">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        className={`icon-btn ${size === "md" ? "icon-btn-md" : ""} ${danger ? "icon-btn-danger" : ""}`}
      >
        {children}
      </button>
    </Tooltip>
  );
}
