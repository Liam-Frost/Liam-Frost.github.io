import { useEffect } from "react";

import { useSiteSettings } from "../../../web/src/data/useSiteSettings";
import { pickText } from "../lib/i18n";

const DEFAULT_TITLE = "管理后台";

/** The admin's name as set in the website settings. */
export function useAdminTitle() {
  const settings = useSiteSettings();
  return pickText(settings?.identity.adminTitle) || DEFAULT_TITLE;
}

/** Keeps the browser tab title in step with the setting, on the login page too. */
export function AdminDocumentTitle() {
  const title = useAdminTitle();
  useEffect(() => {
    document.title = title;
  }, [title]);
  return null;
}
