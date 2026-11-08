import { useRef, type KeyboardEvent, type ReactNode } from "react";

import { LANGS, LANG_LABELS, type Lang } from "../../lib/i18n";
import { tr } from "../../lib/messages";

const tabId = (id: string, lang: Lang) => `${id}-tab-${lang}`;
const panelId = (id: string) => `${id}-panel`;

/**
 * The language a piece of content is being edited in (not the admin's own language). Put the fields it
 * controls in a `LanguageTabPanel` with the same `id`. ← → Home End move between tabs.
 */
export function LanguageTabs({
  id,
  value,
  onChange,
  isFilled,
  mark = "missing",
  size = "md",
  className = ""
}: {
  /** Links the tabs to their panel; a `useId()` value or a fixed name. */
  id: string;
  value: Lang;
  onChange: (lang: Lang) => void;
  /** Whether a language has content. Leave out when the page does not show it. */
  isFilled?: (lang: Lang) => boolean;
  /** "missing" puts a · on empty languages, "filled" a ✓ on the others. */
  mark?: "missing" | "filled";
  size?: "sm" | "md";
  className?: string;
}) {
  const list = useRef<HTMLDivElement>(null);
  const onKeyDown = (event: KeyboardEvent) => {
    const index = LANGS.indexOf(value);
    const next =
      event.key === "ArrowRight"
        ? LANGS[(index + 1) % LANGS.length]
        : event.key === "ArrowLeft"
          ? LANGS[(index - 1 + LANGS.length) % LANGS.length]
          : event.key === "Home"
            ? LANGS[0]
            : event.key === "End"
              ? LANGS[LANGS.length - 1]
              : undefined;
    if (!next) return;
    event.preventDefault();
    onChange(next);
    list.current?.querySelector<HTMLElement>(`[data-lang="${next}"]`)?.focus();
  };

  return (
    <div
      ref={list}
      role="tablist"
      aria-label={tr("编辑语言")}
      onKeyDown={onKeyDown}
      className={`flex flex-wrap gap-1.5 ${className}`}
    >
      {LANGS.map((lang) => {
        const filled = isFilled?.(lang);
        return (
          <button
            key={lang}
            id={tabId(id, lang)}
            data-lang={lang}
            type="button"
            role="tab"
            aria-selected={value === lang}
            aria-controls={panelId(id)}
            tabIndex={value === lang ? 0 : -1}
            onClick={() => onChange(lang)}
            className={`language-tab ${size === "sm" ? "language-tab-sm" : ""}`}
          >
            {LANG_LABELS[lang]}
            {filled === undefined
              ? ""
              : mark === "missing"
                ? filled
                  ? ""
                  : " ·"
                : filled
                  ? " ✓"
                  : ""}
          </button>
        );
      })}
    </div>
  );
}

export function LanguageTabPanel({
  id,
  lang,
  className,
  children
}: {
  id: string;
  lang: Lang;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div id={panelId(id)} role="tabpanel" aria-labelledby={tabId(id, lang)} className={className}>
      {children}
    </div>
  );
}
