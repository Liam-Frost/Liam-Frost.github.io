import { DEFAULT_PRESENTATION, type PublicPresentation } from "@liam-frost/shared";
import { useEffect, useState } from "react";
import { apiFetchEnabled, apiUrl } from "../lib/api";
import { useLayoutPending } from "../app/layoutPending";

const fallback: PublicPresentation = { ...DEFAULT_PRESENTATION, images: {}, logoImages: {} };
type LoadedPresentation = PublicPresentation & { unavailable?: boolean };
const unavailable: LoadedPresentation = { ...fallback, unavailable: true };
let pending: Promise<LoadedPresentation> | null = null;
let generation = 0;
function loadPresentation(): Promise<LoadedPresentation> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  return fetch(apiUrl("/api/presentation"), { signal: controller.signal })
    .then(async (r) => {
      if (!r.ok) throw new Error("Presentation unavailable");
      return (await r.json()) as PublicPresentation;
    })
    .then((v) =>
      v?.sections && v.publicLogo && v.adminLogo && v.loginBackground && v.images ? v : unavailable
    )
    .catch(() => unavailable)
    .finally(() => window.clearTimeout(timeout));
}
export function refreshPresentation() {
  generation++;
  pending = null;
  window.dispatchEvent(new Event("lf:presentation"));
}
export function usePresentation() {
  const [value, setValue] = useState<LoadedPresentation | null>(apiFetchEnabled ? null : fallback);
  useLayoutPending(value === null);
  useEffect(() => {
    if (!apiFetchEnabled) return;
    let active = true;
    const load = () => {
      const expected = generation;
      setValue(null);
      pending ??= loadPresentation();
      void pending.then((v) => {
        if (active && expected === generation) setValue(v);
      });
    };
    load();
    window.addEventListener("lf:presentation", load);
    return () => {
      active = false;
      window.removeEventListener("lf:presentation", load);
    };
  }, []);
  return value;
}
