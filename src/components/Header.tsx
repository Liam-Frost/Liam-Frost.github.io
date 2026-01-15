import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

import { site } from "../data/site";
import { cx } from "../lib/cx";
import { useI18n, type Lang } from "../lib/i18n";
import type { ThemeMode } from "../lib/useTheme";

type Props = {
  theme: ThemeMode;
  onCycleTheme: () => void;
};

export default function Header({ theme, onCycleTheme }: Props) {
  const { lang, setLang, t } = useI18n();

  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);

  const themeUi = useMemo(() => {
    if (theme === "light") return { icon: "☀", label: t("theme.light") };
    if (theme === "dark") return { icon: "☾", label: t("theme.dark") };
    return { icon: "◐", label: t("theme.system") };
  }, [theme, t]);

  return (
    <nav className="nav" aria-label="Primary">
      <Link className="brand" to="/" aria-label={t("nav.home")}>
        <span className="brandMark" aria-hidden="true" />
        <span>{site.nameLatin}</span>
      </Link>

      <button
        className="navToggle"
        type="button"
        aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="srOnly">{open ? t("nav.closeMenu") : t("nav.openMenu")}</span>
        <span className="hamburger" aria-hidden="true" />
      </button>

      <div className={cx("navLinks", open && "navLinksOpen")}>
        <NavLink to="/" end className={({ isActive }) => cx("navLink", isActive && "navLinkActive")}>
          {t("nav.home")}
        </NavLink>

        <NavLink to="/portfolio" className={({ isActive }) => cx("navLink", isActive && "navLinkActive")}>
          {t("nav.portfolio")}
        </NavLink>

        <Link className="navLink" to="/#about">
          {t("nav.about")}
        </Link>
        <Link className="navLink" to="/#skills">
          {t("nav.skills")}
        </Link>
        <Link className="navLink" to="/#contact">
          {t("nav.contact")}
        </Link>

        <div className="navActions">
          <label className="srOnly" htmlFor="langSelect">
            {t("common.language")}
          </label>
          <select
            id="langSelect"
            className={cx("select", "selectSmall")}
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            aria-label={t("common.language")}
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="ja">日本語</option>
          </select>

          <button
            className={cx("btn", "btnGhost")}
            type="button"
            onClick={onCycleTheme}
            aria-label={`${t("common.theme")} (${themeUi.label})`}
            title={`${t("common.theme")} (${themeUi.label})`}
          >
            <span aria-hidden="true">{themeUi.icon}</span>
            <span>{t("common.theme")}</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
