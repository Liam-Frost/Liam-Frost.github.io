import { Check, X } from "lucide-react";
import { useId, useMemo, useRef, useState, type ReactNode } from "react";

export type MultiOption = {
  id: string;
  label: string;
  /** Second line in the list (and the chip's title), e.g. "隐藏" or a category. */
  detail?: string;
  /** Small leading visual (a logo or a cover). */
  icon?: ReactNode;
  /** Extra words that find it, besides the label. */
  keywords?: string;
};

/** Options shown at once; typing narrows the rest. Keeps long lists light. */
const LIMIT = 50;

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Picks several existing items: chosen ones are removable chips, the text field searches the rest
 * (ARIA combobox with a multi-select listbox). ↑ ↓ move, Enter adds or removes the highlighted
 * option, Backspace in an empty field removes the last chip, Esc closes the list. Nothing can be
 * created here: only `options` can be chosen.
 */
export function MultiCombobox({
  id,
  options,
  value,
  onChange,
  placeholder,
  listLabel,
  emptyText = "没有匹配的选项",
  max
}: {
  id: string;
  options: MultiOption[];
  /** Chosen ids, in order. */
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  /** Accessible name of the list of options. */
  listLabel: string;
  emptyText?: string;
  max?: number;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const chosen = new Set(value);
  const matches = useMemo(() => {
    const q = normalize(query);
    const found = q
      ? options.filter((o) => normalize(`${o.label} ${o.keywords ?? ""}`).includes(q))
      : options;
    return found;
  }, [options, query]);
  const shown = matches.slice(0, LIMIT);
  const optionId = (index: number) => `${listId}-${index}`;
  const full = max !== undefined && value.length >= max;

  const toggle = (option: MultiOption) => {
    if (chosen.has(option.id)) onChange(value.filter((v) => v !== option.id));
    else if (!full) onChange([...value, option.id]);
  };
  const remove = (target: string) => {
    onChange(value.filter((v) => v !== target));
    input.current?.focus();
  };

  return (
    <div>
      {value.length ? (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="已选择">
          {value.map((v) => {
            const option = byId.get(v);
            const label = option?.label ?? "（已删除）";
            return (
              <li
                key={v}
                className="chip inline-flex max-w-full items-center gap-1.5 !pr-1"
                title={option?.detail}
              >
                {option?.icon}
                <span className="min-w-0 truncate">{label}</span>
                <button
                  type="button"
                  aria-label={`移除 ${label}`}
                  onClick={() => remove(v)}
                  className="rounded-full p-0.5 hover:bg-brand-secondary/15 hover:text-status-error focus-visible:outline-2 focus-visible:outline-brand-secondary"
                >
                  <X aria-hidden="true" className="size-3" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="relative">
        <input
          ref={input}
          id={id}
          className="field"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && shown.length ? optionId(active) : undefined}
          autoComplete="off"
          value={query}
          placeholder={full ? `最多 ${max} 项` : placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => {
            // A half-typed search is not a value: start fresh next time.
            setOpen(false);
            setQuery("");
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              if (!open) return setOpen(true);
              if (shown.length)
                setActive(
                  (i) => (i + (event.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length
                );
            } else if (event.key === "Enter") {
              // Never submits the form around it.
              event.preventDefault();
              if (open && shown[active]) toggle(shown[active]);
            } else if (event.key === "Escape" && open) {
              // Closes the list, not the dialog around it.
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            } else if (event.key === "Backspace" && !query && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
        />
        {open ? (
          <ul
            id={listId}
            role="listbox"
            aria-multiselectable="true"
            aria-label={listLabel}
            className="absolute top-full right-0 left-0 z-40 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-card-hover"
          >
            {shown.map((option, index) => {
              const selected = chosen.has(option.id);
              return (
                <li
                  key={option.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={selected}
                  aria-disabled={!selected && full ? true : undefined}
                  // Before blur, so the click lands and the list stays open for more picks.
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => toggle(option)}
                  onPointerMove={() => setActive(index)}
                  className={`flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-[13px] ${
                    index === active ? "bg-brand-secondary/10" : ""
                  } ${!selected && full ? "opacity-50" : ""}`}
                >
                  {option.icon}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ink">{option.label}</span>
                    {option.detail ? (
                      <span className="block truncate text-[11.5px] text-faint">
                        {option.detail}
                      </span>
                    ) : null}
                  </span>
                  <Check
                    aria-hidden="true"
                    className={`size-4 shrink-0 text-brand ${selected ? "" : "invisible"}`}
                  />
                </li>
              );
            })}
            {!shown.length ? (
              <li className="px-3 py-2 text-[12.5px] text-faint">{emptyText}</li>
            ) : null}
            {matches.length > shown.length ? (
              <li className="px-3 py-2 text-[12px] text-faint">
                还有 {matches.length - shown.length} 项，输入名称缩小范围
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
