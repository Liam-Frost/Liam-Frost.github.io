import type { ReactNode } from "react";

/** Form field: label + control + optional hint. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
  className = ""
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[12.5px] font-medium text-brand-dark">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[11.5px] leading-relaxed text-faint">{hint}</p> : null}
    </div>
  );
}
