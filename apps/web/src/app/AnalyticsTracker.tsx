import type { AnalyticsContentType } from "@liam-frost/shared";
import { useEffect, useRef } from "react";
import { useLocation } from "react-router";

import { routeOf, track, trackPage } from "../lib/analytics";
import { useI18n } from "../lib/i18n";

/**
 * What is open, read from the address: projects, photos (?photo=), collection entries and people
 * (?item= / ?person=) and playlists (?music=playlists&in=) all have their own address.
 */
function contentOf(pathname: string, params: URLSearchParams) {
  const route = routeOf(pathname);
  const open: [AnalyticsContentType, string | null][] = [];
  if (route === "/projects/:slug")
    open.push(["project", decodeURIComponent(pathname.split("/")[2] ?? "")]);
  if (route === "/portfolio") open.push(["photo", params.get("photo")]);
  if (route === "/collection") {
    open.push(["media", params.get("item")]);
    open.push(["person", params.get("person")]);
    if (params.get("music") === "playlists") open.push(["playlist", params.get("in")]);
  }
  return open.filter((entry): entry is [AnalyticsContentType, string] => Boolean(entry[1]));
}

/** Counts pages, opened content and collection tabs as the visitor moves around the site. */
export default function AnalyticsTracker() {
  const location = useLocation();
  const { lang } = useI18n();
  const previous = useRef<{ pathname: string; content: Set<string>; tab: string | null } | null>(
    null
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const last = previous.current;
    const route = routeOf(location.pathname);
    if (last?.pathname !== location.pathname) trackPage(route, lang);

    const content = new Set<string>();
    for (const [type, id] of contentOf(location.pathname, params)) {
      const key = `${type}:${id}`;
      content.add(key);
      if (!last?.content.has(key)) track("content_view", { contentType: type, contentId: id });
    }

    // Collection tabs and music views the visitor switches to (not the one a page opens with).
    const tab =
      route === "/collection" && params.get("kind")
        ? `${params.get("kind")}|${params.get("music") ?? ""}`
        : null;
    if (tab && last?.pathname === location.pathname && last.tab !== tab) {
      const [kind, view] = tab.split("|");
      track("collection_filter", { target: kind, detail: view || undefined });
    }

    previous.current = { pathname: location.pathname, content, tab };
    // The language is only sent with page views; changing it is not a page view.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lang is read, not watched
  }, [location.pathname, location.search]);

  return null;
}
