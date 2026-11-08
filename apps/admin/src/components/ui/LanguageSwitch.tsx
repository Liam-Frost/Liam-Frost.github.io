import {
  ADMIN_LOCALES,
  ADMIN_LOCALE_LABELS,
  locale,
  setLocale,
  tr,
  type AdminLocale
} from "../../lib/messages";
import { hasUnsaved } from "../../lib/unsaved";
import { useConfirm } from "./Confirm";
import { Select } from "./Select";

const OPTIONS = ADMIN_LOCALES.map((value) => ({ value, label: ADMIN_LOCALE_LABELS[value] }));

/** The admin's own language. Switching reloads the page, so unsaved work is settled first. */
export function LanguageSwitch({
  className = "",
  surface = "light"
}: {
  className?: string;
  surface?: "light" | "dark";
}) {
  const confirm = useConfirm();
  const change = async (next: AdminLocale) => {
    if (
      hasUnsaved() &&
      !(await confirm({
        title: tr("切换后台语言？"),
        message: tr("切换语言需要重新加载页面，未保存的修改会丢失。"),
        confirmLabel: tr("仍然切换"),
        cancelLabel: tr("继续编辑")
      }))
    )
      return;
    setLocale(next);
  };
  return (
    <Select<AdminLocale>
      aria-label={tr("界面语言")}
      size="sm"
      surface={surface}
      className={className}
      value={locale}
      options={OPTIONS}
      onChange={(next) => void change(next)}
    />
  );
}
