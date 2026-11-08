import {
  ADMIN_LOCALES,
  ADMIN_LOCALE_LABELS,
  changesLocale,
  setLocale,
  tr,
  useLocalePreference,
  type AdminLocalePreference
} from "../../lib/messages";
import { hasUnsaved } from "../../lib/unsaved";
import { useConfirm } from "./Confirm";
import { Select } from "./Select";

const OPTIONS = [
  { value: "system" as const, label: tr("跟随系统") },
  ...ADMIN_LOCALES.map((value) => ({ value, label: ADMIN_LOCALE_LABELS[value] }))
];

/** The admin's own language. A change that needs a reload settles unsaved work first. */
export function LanguageSwitch({
  className = "",
  surface = "light"
}: {
  className?: string;
  surface?: "light" | "dark";
}) {
  const confirm = useConfirm();
  const preference = useLocalePreference();
  const change = async (next: AdminLocalePreference) => {
    if (
      changesLocale(next) &&
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
    <Select<AdminLocalePreference>
      aria-label={tr("界面语言")}
      size="sm"
      surface={surface}
      className={className}
      value={preference}
      options={OPTIONS}
      onChange={(next) => void change(next)}
    />
  );
}
