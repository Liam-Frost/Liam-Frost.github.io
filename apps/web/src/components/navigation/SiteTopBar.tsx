import { Menu } from "@base-ui/react/menu";
import { Check, Globe } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router";

import AnimatedThemeToggler from "../AnimatedThemeToggler";
import SiteMark from "../SiteMark";
import Tooltip from "../Tooltip";
import { useI18n, type Lang } from "../../lib/i18n";
import { scrollToTop } from "../../lib/smoothScroll";
import type { ThemeMode } from "../../lib/useTheme";
import { GlassSurface } from "../../vendor/cupertinocn/liquid-glass";
import { isPlainClick, leaveMissingPage } from "./goHome";

const LANGUAGES: { value: Lang; label: string }[] = [
  { value: "zh", label: "简体中文" },
  { value: "zh-Hant", label: "繁體中文" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "ja", label: "日本語" }
];

function LanguageMenu() {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <Menu.Root open={open} onOpenChange={setOpen} modal={false}>
      <Tooltip content={open ? "" : t("common.language")} describe={false}>
        <Menu.Trigger className="siteIconButton" aria-label={t("common.language")}>
          <Globe size={18} aria-hidden="true" />
        </Menu.Trigger>
      </Tooltip>
      <Menu.Portal>
        <Menu.Positioner
          className="glassScope siteLangPositioner"
          side="bottom"
          align="end"
          sideOffset={10}
          collisionPadding={12}
        >
          <Menu.Popup className="cupertino cupertino-glass siteLangPopup">
            <GlassSurface variant="opaque" interactive={false} />
            <Menu.RadioGroup value={lang} onValueChange={(value: Lang) => setLang(value)}>
              {LANGUAGES.map((item) => (
                <Menu.RadioItem
                  key={item.value}
                  value={item.value}
                  closeOnClick
                  className="siteLangItem"
                  lang={item.value}
                >
                  <span>{item.label}</span>
                  <Menu.RadioItemIndicator className="siteLangCheck">
                    <Check size={15} aria-hidden="true" />
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** Part of the page: the logo and the two icons scroll away with the hero, nothing here is sticky. */
export default function SiteTopBar({
  theme,
  onCycleTheme
}: {
  theme: ThemeMode;
  onCycleTheme: () => void;
}) {
  const { t } = useI18n();
  const { pathname, hash } = useLocation();
  const themeLabel =
    theme === "light" ? t("theme.light") : theme === "dark" ? t("theme.dark") : t("theme.system");
  return (
    <div className="siteTop">
      <div className="container siteTopRow">
        <Link
          className="siteBrand"
          to="/"
          aria-label={t("nav.home")}
          onClick={(event) => {
            if (leaveMissingPage(event)) return;
            // Already on the home page: a same-URL navigation does not scroll by itself.
            if (pathname === "/" && !hash && isPlainClick(event)) scrollToTop(true);
          }}
        >
          <SiteMark />
        </Link>
        <div className="siteTopActions">
          <LanguageMenu />
          <AnimatedThemeToggler
            theme={theme}
            cycleTheme={onCycleTheme}
            className="siteIconButton"
            aria-label={`${t("common.theme")} (${themeLabel})`}
          />
        </div>
      </div>
    </div>
  );
}
