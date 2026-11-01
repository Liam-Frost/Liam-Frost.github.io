import type { PublicProject, PublicProjectSummary } from "@liam-frost/shared";
import { useEffect, useState } from "react";

import { apiFetchEnabled, apiUrl } from "../lib/api";

/**
 * Public projects. Projects live only in the database, so without the API (static builds) or when it
 * fails the list is empty and the project sections stay hidden.
 */
export function useProjects() {
  const [projects, setProjects] = useState<PublicProjectSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "offline">(
    apiFetchEnabled ? "loading" : "offline"
  );

  useEffect(() => {
    if (!apiFetchEnabled) return;
    const controller = new AbortController();
    fetch(apiUrl("/api/projects"), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load projects: ${response.status}`);
        return response.json() as Promise<PublicProjectSummary[]>;
      })
      .then((list) => {
        setProjects(Array.isArray(list) ? list : []);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("offline");
      });
    return () => controller.abort();
  }, []);

  return { projects, status };
}

export function useProject(slug: string) {
  const [project, setProject] = useState<PublicProject | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">(
    apiFetchEnabled ? "loading" : "missing"
  );

  useEffect(() => {
    if (!apiFetchEnabled) return;
    const controller = new AbortController();
    setStatus("loading");
    fetch(apiUrl(`/api/projects/${encodeURIComponent(slug)}`), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Project not found: ${response.status}`);
        return response.json() as Promise<PublicProject>;
      })
      .then((data) => {
        setProject(data);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setProject(null);
        setStatus("missing");
      });
    return () => controller.abort();
  }, [slug]);

  return { project, status };
}
