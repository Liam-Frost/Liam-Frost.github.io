import type { PublicCollection, PublicMedia } from "@liam-frost/shared";
import { useEffect, useState } from "react";

import { apiFetchEnabled, apiUrl } from "../lib/api";

const EMPTY: PublicCollection = { kinds: [], items: [] };

/**
 * The public collection. It only exists in the database, so without the API (static builds) or when it
 * fails it is empty and the site hides its collection sections.
 */
export function useCollection() {
  const [collection, setCollection] = useState<PublicCollection>(EMPTY);
  const [status, setStatus] = useState<"loading" | "ready" | "offline">(apiFetchEnabled ? "loading" : "offline");

  useEffect(() => {
    if (!apiFetchEnabled) return;
    const controller = new AbortController();
    fetch(apiUrl("/api/collection"), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load the collection: ${response.status}`);
        return response.json() as Promise<PublicCollection>;
      })
      .then((data) => {
        setCollection(Array.isArray(data?.items) ? data : EMPTY);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("offline");
      });
    return () => controller.abort();
  }, []);

  return { ...collection, status };
}

/** One entry with its synopsis and review; null id loads nothing. */
export function useCollectionItem(id: string | null) {
  const [item, setItem] = useState<PublicMedia | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "missing">("idle");

  useEffect(() => {
    if (!id || !apiFetchEnabled) {
      setItem(null);
      setStatus(id ? "missing" : "idle");
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    fetch(apiUrl(`/api/collection/${encodeURIComponent(id)}`), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Entry not found: ${response.status}`);
        return response.json() as Promise<PublicMedia>;
      })
      .then((data) => {
        setItem(data);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setItem(null);
        setStatus("missing");
      });
    return () => controller.abort();
  }, [id]);

  return { item, status };
}
