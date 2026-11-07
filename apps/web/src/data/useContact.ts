import { useLayoutPending } from "../app/layoutPending";
import { type ContactContent } from "@liam-frost/shared";
import { useEffect, useState } from "react";
import { apiFetchEnabled, apiUrl } from "../lib/api";

export function useContact() {
  const [contact, setContact] = useState<ContactContent | null>(null);
  const [loading, setLoading] = useState(apiFetchEnabled);
  useLayoutPending(loading);
  useEffect(() => {
    // Emergency Pages intercepts fetch with the verified, database-backed snapshot.
    if (!apiFetchEnabled) return;
    const controller = new AbortController();
    fetch(apiUrl("/api/contact"), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Contact unavailable");
        return response.json() as Promise<ContactContent>;
      })
      .then(setContact)
      .catch(() => {
        /* Keep removed or unavailable contact details hidden. */
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  return contact;
}
