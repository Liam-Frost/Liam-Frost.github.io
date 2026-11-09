import type { FooterPage } from "@liam-frost/shared";
import { useSiteSettings } from "../data/useSiteSettings";
import { useMemo } from "react";
import { Link, useLocation } from "react-router";

import { site } from "../data/site";
import { pickLocalized, useI18n } from "../lib/i18n";
import { scrollToTop } from "../lib/smoothScroll";

/** A project's page counts as 项目; pages outside the tab bar use the home page's statement. */
const pageOf = (pathname: string): FooterPage =>
  pathname.startsWith("/projects")
    ? "projects"
    : pathname.startsWith("/collection")
      ? "collection"
      : pathname.startsWith("/portfolio")
        ? "portfolio"
        : "home";

export default function Footer() {
  const { lang, t } = useI18n();
  const settings = useSiteSettings();
  const { pathname } = useLocation();
  // An emergency snapshot taken before statements were per page has no `copyright`.
  const copyright = settings?.footer.copyright?.[pageOf(pathname)];
  const owner =
    pickLocalized(copyright?.owner ?? {}, lang) ||
    pickLocalized(settings?.identity.name ?? {}, lang) ||
    site.nameLatin;
  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <div className="footerGrid">
      <p style={{ margin: 0 }}>
        ©{" "}
        {copyright?.startYear && copyright.startYear < year
          ? `${copyright.startYear}–${year}`
          : year}{" "}
        {owner}
        {copyright?.showRole !== false ? ` · ${pickLocalized(site.role, lang)}` : ""} ·{" "}
        <Link to="/privacy">{t("footer.privacy")}</Link>
        {(settings?.footer.links ?? []).map((link) => {
          const label = pickLocalized(link.label, lang);
          if (!label) return null;
          return (
            <span key={link.url}>
              {" · "}
              {link.url.startsWith("/") ? (
                <Link to={link.url}>{label}</Link>
              ) : (
                <a href={link.url} target="_blank" rel="noreferrer">
                  {label}
                </a>
              )}
            </span>
          );
        })}
      </p>

      <button className="btn btnGhost btnSmall" type="button" onClick={() => scrollToTop(true)}>
        {t("common.backToTop")}
      </button>
    </div>
  );
}
