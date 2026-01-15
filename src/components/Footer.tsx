import { useMemo } from "react";

import { site } from "../data/site";
import { pickLocalized, useI18n } from "../lib/i18n";

export default function Footer() {
  const { lang, t } = useI18n();
  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <div className="footerGrid">
      <p style={{ margin: 0 }}>
        © {year} {site.nameLatin} · {pickLocalized(site.role, lang)}
      </p>

      <button
        className="btn btnGhost btnSmall"
        type="button"
        onClick={() => {
          const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
          window.scrollTo({ top: 0, left: 0, behavior: prefersReduced ? "auto" : "smooth" });
        }}
      >
        {t("common.backToTop")}
      </button>
    </div>
  );
}
