import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

import { site } from "../data/site";
import { cx } from "../lib/cx";
import { useI18n, type Lang } from "../lib/i18n";
import type { ThemeMode } from "../lib/useTheme";
import AnimatedThemeToggler from "./AnimatedThemeToggler";

type Props = {
  theme: ThemeMode;
  onCycleTheme: () => void;
};

export default function Header({ theme, onCycleTheme }: Props) {
  const { lang, setLang, t } = useI18n();

  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const langWrapRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
    setLangOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      const el = langWrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setLangOpen(false);
    };

    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLangOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const themeUi = useMemo(() => {
    if (theme === "light") return { icon: "☀", label: t("theme.light") };
    if (theme === "dark") return { icon: "☾", label: t("theme.dark") };
    return { icon: "◐", label: t("theme.system") };
  }, [theme, t]);

  return (
    <nav className="nav" aria-label="Primary">
      <Link className="brand" to="/" aria-label={t("nav.home")}>
        <span className="brandMark" aria-hidden="true" />
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
          <div ref={langWrapRef} className={cx("langWrap", langOpen && "langWrapOpen")}>
            <button
              className={cx("btn", "btnGhost", "langBtn")}
              type="button"
              aria-label={t("common.language")}
              title={t("common.language")}
              aria-expanded={langOpen}
              onClick={() => setLangOpen((v) => !v)}
            >
              <svg className="langIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M2 12h20"></path>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
              <span className="srOnly">{t("common.language")}</span>
            </button>

            <div className="langPanel" role="menu" aria-label={t("common.language")}>
              {([
                { k: "zh", label: "简体中文" },
                { k: "zh-Hant", label: "繁體中文" },
                { k: "en", label: "English" },
                { k: "fr", label: "Français" },
                { k: "ja", label: "日本語" }
              ] as Array<{ k: Lang; label: string }>).map((item) => (
                <button
                  key={item.k}
                  className={cx("langItem", item.k === lang && "langItemActive")}
                  type="button"
                  role="menuitemradio"
                  aria-checked={item.k === lang}
                  onClick={() => {
                    setLang(item.k);
                    setLangOpen(false);
                  }}
                >
                  <span className="langLabel">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <AnimatedThemeToggler
            theme={theme}
            cycleTheme={onCycleTheme}
            aria-label={`${t("common.theme")} (${themeUi.label})`}
            title={`${t("common.theme")} (${themeUi.label})`}
          />
        </div>
      </div>
    </nav>
  );
}
