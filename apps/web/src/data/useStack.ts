import { useLayoutPending } from "../app/layoutPending";
import type { PublicStackCategory, PublicStackResponse } from "@liam-frost/shared";
import { useCallback, useEffect, useState } from "react";

import { apiFetchEnabled, apiUrl } from "../lib/api";

/**
 * The tech stack, from the API in one request. It lives only in the database: when the API is off or
 * fails, the section says so (with a retry) instead of showing an outdated built-in list.
 */
export function useStack() {
  const [categories, setCategories] = useState<PublicStackCategory[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    apiFetchEnabled ? "loading" : "error"
  );
  const [attempt, setAttempt] = useState(0);

  useLayoutPending(status === "loading");

  useEffect(() => {
    if (!apiFetchEnabled) return;
    const controller = new AbortController();
    setStatus("loading");
    fetch(apiUrl("/api/stack"), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load the tech stack: ${response.status}`);
        return response.json() as Promise<PublicStackResponse>;
      })
      .then((data) => {
        setCategories(Array.isArray(data?.categories) ? data.categories : []);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      });
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { categories, status, retry: apiFetchEnabled ? retry : null };
}
