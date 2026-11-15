import { isSitePalette } from "@liam-frost/shared";
import { useEffect } from "react";

import { useSiteSettings } from "../data/useSiteSettings";

/** Where the last applied palette is kept, so index.html can set it before the first paint. */
export const PALETTE_KEY = "site-palette";

/**
 * Applies the colour scheme chosen in the admin (site settings, preferences.palette) as
 * html[data-palette]; styles/themes.css does the rest. Visitors cannot change it. Until the settings
 * arrive, and when they cannot be loaded, the palette of the last visit stays.
 */
export function usePalette() {
  const settings = useSiteSettings();
  const loaded = settings && !settings.unavailable ? settings.preferences.palette : undefined;
  const ready = Boolean(settings && !settings.unavailable);
  useEffect(() => {
    if (!ready) return;
    // An API from before palettes existed sends none: the default.
    const palette = isSitePalette(loaded) ? loaded : "mist";
    document.documentElement.setAttribute("data-palette", palette);
    try {
      localStorage.setItem(PALETTE_KEY, palette);
    } catch {
      // storage unavailable
    }
  }, [ready, loaded]);
}
