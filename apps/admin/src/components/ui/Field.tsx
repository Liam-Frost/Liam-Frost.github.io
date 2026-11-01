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

/** On/off switch with a visible label. */
export function Switch({
  id,
  checked,
  onChange,
  label
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  label: ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      className="inline-flex cursor-pointer items-center gap-2.5 text-[13px] text-ink"
    >
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200 ${checked ? "bg-brand" : "bg-line-strong"}`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-[3px] left-0 size-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-[19px]" : "translate-x-[3px]"}`}
        />
      </button>
      {label}
    </label>
  );
}
