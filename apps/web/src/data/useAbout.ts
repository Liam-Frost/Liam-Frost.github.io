import { DEFAULT_ABOUT, toPublicAbout, type PublicAbout } from "@liam-frost/shared";
import { useEffect, useState } from "react";

import { apiFetchEnabled, apiUrl } from "../lib/api";

const FALLBACK = toPublicAbout(DEFAULT_ABOUT);

const isAbout = (data: unknown): data is PublicAbout =>
  !!data &&
  Array.isArray((data as PublicAbout).manifestos) &&
  Array.isArray((data as PublicAbout).gear) &&
  typeof (data as PublicAbout).rotation?.mode === "string";

/**
 * The about section's manifestos and gear, as managed in the admin. Without the API (static builds)
 * or when it fails, the built-in defaults; `null` while loading, so the section does not show one
 * manifesto and then switch to another.
 */
export function useAbout(): PublicAbout | null {
  const [about, setAbout] = useState<PublicAbout | null>(apiFetchEnabled ? null : FALLBACK);

  useEffect(() => {
    if (!apiFetchEnabled) return;
    const controller = new AbortController();
    fetch(apiUrl("/api/about"), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load the about section: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((data) => setAbout(isAbout(data) ? data : FALLBACK))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setAbout(FALLBACK);
      });
    return () => controller.abort();
  }, []);

  return about;
}
