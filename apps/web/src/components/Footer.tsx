import { useSiteSettings } from "../data/useSiteSettings";
import { useMemo } from "react";
import { Link } from "react-router";

import { site } from "../data/site";
import { pickLocalized, useI18n } from "../lib/i18n";
import { scrollToTop } from "../lib/smoothScroll";

export default function Footer() {
  const { lang, t } = useI18n();
  const settings = useSiteSettings();
  const owner =
    pickLocalized(settings?.footer.owner ?? {}, lang) ||
    pickLocalized(settings?.identity.name ?? {}, lang) ||
    site.nameLatin;
  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <div className="footerGrid">
      <p style={{ margin: 0 }}>
        ©{" "}
        {settings?.footer.startYear && settings.footer.startYear < year
          ? `${settings.footer.startYear}–${year}`
          : year}{" "}
        {owner}
        {settings?.footer.showRole !== false ? ` · ${pickLocalized(site.role, lang)}` : ""} ·{" "}
        <Link to="/privacy">{t("footer.privacy")}</Link>
      </p>

      <button className="btn btnGhost btnSmall" type="button" onClick={() => scrollToTop(true)}>
        {t("common.backToTop")}
      </button>
    </div>
  );
}
