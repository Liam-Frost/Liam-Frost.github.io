import {
  ADMIN_LOCALES,
  ADMIN_LOCALE_LABELS,
  locale,
  setLocale,
  tr,
  type AdminLocale
} from "../../lib/messages";

/** Changing the language reloads the page; the browser asks first if a page has unsaved changes. */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  return (
    <label className={`inline-flex items-center gap-1.5 text-[12px] ${className}`}>
      <span className="sr-only">{tr("界面语言")}</span>
      <select
        className="cursor-pointer rounded-md border border-current/20 bg-transparent px-1.5 py-1 text-[12px]"
        value={locale}
        onChange={(event) => setLocale(event.target.value as AdminLocale)}
      >
        {ADMIN_LOCALES.map((value) => (
          <option key={value} value={value} className="text-brand-dark">
            {ADMIN_LOCALE_LABELS[value]}
          </option>
        ))}
      </select>
    </label>
  );
}
