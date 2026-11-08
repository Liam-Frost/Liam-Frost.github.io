import SiteFavicon from "./SiteFavicon";
import { useEffect } from "react";
import { useLocation } from "react-router";
import { useSiteSettings } from "../data/useSiteSettings";
import { pickLocalized, useI18n } from "../lib/i18n";
export default function SiteMetadata() {
  const settings = useSiteSettings(),
    { lang } = useI18n(),
    location = useLocation();
  useEffect(() => {
    if (!settings || settings.unavailable || /^\/projects\/[^/]+\/?$/.test(location.pathname))
      return;
    document.title = pickLocalized(settings.identity.title, lang) || "Hello! This is Liam!";
  }, [settings, lang, location.pathname]);
  useEffect(() => {
    if (!settings || settings.unavailable) return;
    let preload: HTMLLinkElement | undefined;
    if (settings.avatarUrl) {
      preload = document.createElement("link");
      preload.rel = "preload";
      preload.as = "image";
      preload.href = settings.avatarUrl;
      document.head.append(preload);
    }
    return () => {
      preload?.remove();
    };
  }, [settings, lang]);
  return <SiteFavicon />;
}
