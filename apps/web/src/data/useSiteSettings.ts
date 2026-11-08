import { DEFAULT_SITE_SETTINGS, type PublicSiteSettings } from "@liam-frost/shared";
import { useEffect, useState } from "react";
import { apiFetchEnabled, apiUrl } from "../lib/api";

type Result = PublicSiteSettings & { unavailable?: boolean };
const { favicon: _favicon, ...groups } = DEFAULT_SITE_SETTINGS;
const defaults: Result = { ...groups, avatarUrl: null, faviconUrl: null };
let pending: Promise<Result> | null = null;
let resolved: Result | null = null;
let generation = 0;
export function refreshSiteSettings() {
  generation++;
  pending = null;
  resolved = null;
  window.dispatchEvent(new Event("lf:site-settings"));
}
export function useSiteSettings() {
  const [value, setValue] = useState<Result | null>(apiFetchEnabled ? resolved : defaults);
  useEffect(() => {
    if (!apiFetchEnabled) return;
    let active = true;
    const load = () => {
      const expected = generation;
      if (!resolved) setValue(null);
      pending ??= (async () => {
        const controller = new AbortController(),
          timer = window.setTimeout(() => controller.abort(), 8000);
        try {
          const response = await fetch(apiUrl("/api/site-settings"), { signal: controller.signal });
          if (!response.ok) throw new Error();
          const data = await response.json();
          if (
            !data?.identity ||
            !data.preferences ||
            !data.dictionary?.entries ||
            !data.privacy ||
            !data.footer
          )
            throw new Error();
          return data as Result;
        } catch {
          return { ...defaults, unavailable: true };
        } finally {
          window.clearTimeout(timer);
        }
      })().then((value) => {
        if (expected === generation) resolved = value;
        return value;
      });
      void pending.then((next) => {
        if (active && expected === generation) setValue(next);
      });
    };
    load();
    window.addEventListener("lf:site-settings", load);
    return () => {
      active = false;
      window.removeEventListener("lf:site-settings", load);
    };
  }, []);
  return value;
}
