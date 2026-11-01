import type { PublicCollection, PublicMedia, PublicPerson } from "@liam-frost/shared";
import { useEffect, useState } from "react";

import { apiFetchEnabled, apiUrl } from "../lib/api";

const EMPTY: PublicCollection = { kinds: [], items: [], people: [], playlists: [] };

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
        setCollection(Array.isArray(data?.items) ? { ...data, people: Array.isArray(data.people) ? data.people : [], playlists: Array.isArray(data.playlists) ? data.playlists : [] } : EMPTY);
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

/** One public resource by path; null loads nothing. 404s and failures read as missing. */
function useDetail<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "missing">("idle");

  useEffect(() => {
    if (!path || !apiFetchEnabled) {
      setData(null);
      setStatus(path ? "missing" : "idle");
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    fetch(apiUrl(path), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Not found: ${response.status}`);
        return response.json() as Promise<T>;
      })
      .then((value) => {
        setData(value);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setData(null);
        setStatus("missing");
      });
    return () => controller.abort();
  }, [path]);

  return { data, status };
}

/** One entry with its synopsis, review and links; null id loads nothing. */
export function useCollectionItem(id: string | null) {
  const { data, status } = useDetail<PublicMedia>(id ? `/api/collection/${encodeURIComponent(id)}` : null);
  return { item: data, status };
}

/** One person with their entries; null id loads nothing. */
export function usePublicPerson(id: string | null) {
  const { data, status } = useDetail<PublicPerson>(id ? `/api/people/${encodeURIComponent(id)}` : null);
  return { person: data, status };
}
