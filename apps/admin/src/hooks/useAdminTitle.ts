import { useEffect } from "react";

import { useSiteSettings } from "../../../web/src/data/useSiteSettings";
import { pickText } from "../lib/i18n";
import { locale, tr } from "../lib/messages";

const DEFAULT_TITLE = tr("管理后台");

/** The admin's name as set in the website settings. */
export function useAdminTitle() {
  const settings = useSiteSettings();
  const title = settings?.identity.adminTitle;
  return title?.[locale] || pickText(title) || DEFAULT_TITLE;
}

/** Keeps the browser tab title in step with the setting, on the login page too. */
export function AdminDocumentTitle() {
  const title = useAdminTitle();
  useEffect(() => {
    document.title = title;
  }, [title]);
  return null;
}
