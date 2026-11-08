import { STACK_PROVIDER_LABELS, type StackCatalogIcon } from "@liam-frost/shared";
import { Plus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { api } from "../../lib/api";
import { TechIcon } from "./TechIcon";
import { tr } from "../../lib/messages";

/**
 * A text field that searches the icon libraries as you type (ARIA combobox with a listbox): ↑ ↓ move,
 * Enter picks, Esc closes. With `onCreate`, the last option keeps the typed text as a technology
 * without a library icon (a custom one).
 */
export function IconCombobox({
  id,
  value,
  onChange,
  onPick,
  onCreate,
  placeholder,
  autoFocus
}: {
  id: string;
  value: string;
  onChange: (text: string) => void;
  onPick: (icon: StackCatalogIcon) => void;
  onCreate?: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [icons, setIcons] = useState<StackCatalogIcon[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [active, setActive] = useState(0);
  const typed = useRef(false);

  const text = value.trim();
  useEffect(() => {
    if (!typed.current || !text) {
      setIcons([]);
      setStatus("idle");
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    const timer = window.setTimeout(() => {
      api
        .searchStackIcons(text, controller.signal)
        .then(({ icons }) => {
          setIcons(icons);
          setActive(0);
          setStatus("idle");
        })
        .catch(() => {
          if (!controller.signal.aborted) setStatus("error");
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [text]);

  const creatable = Boolean(onCreate && text);
  const count = icons.length + (creatable ? 1 : 0);
  const shown = open && text.length > 0;
  const optionId = (index: number) => `${listId}-${index}`;

  const choose = (index: number) => {
    if (index < icons.length) onPick(icons[index]!);
    else if (creatable) onCreate!(text);
    setOpen(false);
    typed.current = false;
  };

  return (
    <div className="relative">
      <input
        id={id}
        className="field"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={listId}
        aria-activedescendant={shown && count ? optionId(active) : undefined}
        autoComplete="off"
        value={value}
        maxLength={60}
        placeholder={placeholder}
        data-autofocus={autoFocus ? true : undefined}
        onChange={(event) => {
          typed.current = true;
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => text && typed.current && setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!shown) {
              typed.current = true;
              setOpen(true);
              return;
            }
            if (count) setActive((i) => (i + (event.key === "ArrowDown" ? 1 : -1) + count) % count);
          } else if (event.key === "Enter" && shown && count) {
            event.preventDefault();
            choose(active);
          } else if (event.key === "Escape" && shown) {
            // Closes the list, not the dialog around it.
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }
        }}
      />
      {shown ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={tr("图标库搜索结果")}
          className="absolute top-full right-0 left-0 z-40 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-card-hover"
        >
          {icons.map((icon, index) => (
            <li
              key={`${icon.provider}/${icon.key}`}
              id={optionId(index)}
              role="option"
              aria-selected={index === active}
              // Before blur, so the click lands.
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
              onPointerMove={() => setActive(index)}
              className={`flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-[13px] ${
                index === active ? "bg-brand-secondary/10" : ""
              }`}
            >
              <TechIcon name={icon.title} url={icon.url} size="sm" />
              <span className="min-w-0 flex-1 truncate text-ink">{icon.title}</span>
              <span className="shrink-0 text-[11.5px] text-faint">
                {tr(STACK_PROVIDER_LABELS[icon.provider])}
              </span>
            </li>
          ))}
          {status === "loading" && !icons.length ? (
            <li className="px-3 py-2 text-[12.5px] text-faint">{tr("搜索中…")}</li>
          ) : null}
          {status === "error" ? (
            <li className="px-3 py-2 text-[12.5px] text-status-error">{tr("图标库搜索失败")}</li>
          ) : null}
          {status === "idle" && !icons.length ? (
            <li className="px-3 py-2 text-[12.5px] text-faint">{tr("图标库里没有匹配的图标")}</li>
          ) : null}
          {creatable ? (
            <li
              id={optionId(icons.length)}
              role="option"
              aria-selected={active === icons.length}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(icons.length)}
              onPointerMove={() => setActive(icons.length)}
              className={`flex cursor-pointer items-center gap-2.5 border-t border-line-soft px-3 py-2 text-[13px] text-brand ${
                active === icons.length ? "bg-brand-secondary/10" : ""
              }`}
            >
              <Plus aria-hidden="true" className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                {tr("使用“{0}”（自定义，可上传图标）", text)}
              </span>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
