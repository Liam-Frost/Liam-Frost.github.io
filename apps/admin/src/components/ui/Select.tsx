import { Select as Base } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

export type SelectOption<V extends string = string> = {
  value: V;
  label: string;
  disabled?: boolean;
};
export type SelectOptionGroup<V extends string = string> = {
  label: string;
  options: SelectOption<V>[];
};

const isGroup = <V extends string>(
  entry: SelectOption<V> | SelectOptionGroup<V>
): entry is SelectOptionGroup<V> => "options" in entry;

// An empty string is a real choice in several filters ("all"), but means "nothing chosen" to the primitive.
const EMPTY = "\u0000";
const toBase = (value: string) => (value === "" ? EMPTY : value);
const fromBase = (value: string) => (value === EMPTY ? "" : value);

function Item<V extends string>({ option }: { option: SelectOption<V> }) {
  return (
    <Base.Item className="select-item" value={toBase(option.value)} disabled={option.disabled}>
      <Base.ItemText>{option.label}</Base.ItemText>
      <Base.ItemIndicator>
        <Check aria-hidden="true" className="size-3.5" />
      </Base.ItemIndicator>
    </Base.Item>
  );
}

/**
 * Single choice from a list, in the admin's style on every browser. Keyboard: Enter / Space / arrows
 * open it, arrows and typing move, Enter chooses, Esc closes and returns to the trigger. The list
 * renders into the open dialog when there is one (the browser's top layer would cover it otherwise) and
 * moves to stay on screen. Pair with a `Field` by `id`, or give it an `aria-label`.
 */
export function Select<V extends string = string>({
  id,
  name,
  value,
  defaultValue,
  onChange,
  options,
  placeholder,
  disabled,
  required,
  size = "md",
  surface = "light",
  className = "",
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy
}: {
  id?: string;
  name?: string;
  /** Leave out, with `defaultValue`, to let the control keep its own state. */
  value?: V | null;
  defaultValue?: V;
  onChange?: (value: V) => void;
  options: (SelectOption<V> | SelectOptionGroup<V>)[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  size?: "sm" | "md";
  surface?: "light" | "dark";
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => setHost(trigger.current?.closest("dialog") ?? null), []);

  const items = useMemo(
    () =>
      options
        .flatMap((entry) => (isGroup(entry) ? entry.options : [entry]))
        .map((option) => ({ value: toBase(option.value), label: option.label })),
    [options]
  );
  const dark = surface === "dark";

  return (
    <Base.Root<string>
      name={name}
      required={required}
      disabled={disabled}
      modal={false}
      items={items}
      value={value === undefined ? undefined : value === null ? null : toBase(value)}
      defaultValue={defaultValue === undefined ? undefined : toBase(defaultValue)}
      onValueChange={(next) => {
        if (next !== null) onChange?.(fromBase(next) as V);
      }}
    >
      <Base.Trigger
        id={id}
        ref={trigger}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={`field select-trigger ${size === "sm" ? "field-sm" : ""} ${dark ? "select-dark" : ""} ${className}`}
      >
        <Base.Value className="min-w-0 truncate" placeholder={placeholder} />
        <Base.Icon render={<span />}>
          <ChevronDown aria-hidden="true" className="select-chevron" />
        </Base.Icon>
      </Base.Trigger>
      <Base.Portal container={host ?? undefined}>
        <Base.Positioner
          className="z-[65] outline-none"
          alignItemWithTrigger={false}
          positionMethod="fixed"
          sideOffset={4}
          collisionPadding={8}
        >
          <Base.Popup className={`surface-overlay select-popup ${dark ? "select-popup-dark" : ""}`}>
            <Base.List>
              {options.map((entry) =>
                isGroup(entry) ? (
                  <Base.Group key={entry.label}>
                    <Base.GroupLabel className="select-group-label">{entry.label}</Base.GroupLabel>
                    {entry.options.map((option) => (
                      <Item key={option.value} option={option} />
                    ))}
                  </Base.Group>
                ) : (
                  <Item key={entry.value} option={entry} />
                )
              )}
            </Base.List>
          </Base.Popup>
        </Base.Positioner>
      </Base.Portal>
    </Base.Root>
  );
}
