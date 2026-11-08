import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import type { SiteSettingsGroups } from "@liam-frost/shared";
import { GlassSurface } from "../../vendor/cupertinocn/liquid-glass";

/** Every button of the site's pages. The bare icons in the top row stay bare. */
const SELECTOR = ".btn:not(.siteIconButton), .contactCopy";

type Host = { key: number; element: HTMLElement; container: HTMLElement };

/**
 * CupertinoCN's `glass` button without touching the site's components: each button gets a real
 * GlassSurface, and navigation.css removes its own fill. The surface sits in a `display: contents` span so
 * that React replacing a button's text (which clears the whole element) only detaches the span; it
 * is put back in the same microtask, before anything paints.
 */
export default function GlassButtons({
  strength,
  selected
}: {
  strength: number;
  selected: SiteSettingsGroups["navigation"]["selectedButton"];
}) {
  const [hosts, setHosts] = useState<Host[]>([]);

  useEffect(() => {
    document.body.dataset.selectedButton = selected;
  }, [selected]);

  useEffect(() => {
    const known = new Map<HTMLElement, Host>();
    let nextKey = 0;
    const scan = () => {
      const found = new Set(document.querySelectorAll<HTMLElement>(SELECTOR));
      let changed = false;
      for (const element of found) {
        let host = known.get(element);
        if (!host) {
          const container = document.createElement("span");
          container.className = "glassPortal";
          host = { key: ++nextKey, element, container };
          known.set(element, host);
          changed = true;
        }
        if (host.container.parentElement !== element) element.appendChild(host.container);
      }
      for (const element of known.keys()) {
        if (found.has(element)) continue;
        known.delete(element);
        changed = true;
      }
      if (changed) setHosts([...known.values()]);
    };
    const observer = new MutationObserver(scan);
    // The body, because photo and detail dialogs render outside the app root.
    observer.observe(document.body, { childList: true, subtree: true });
    scan();
    return () => {
      observer.disconnect();
      for (const host of known.values()) host.container.remove();
    };
  }, []);

  return hosts.map((host) =>
    createPortal(
      <GlassSurface variant="regular" strength={strength} host={host.element} />,
      host.container,
      String(host.key)
    )
  );
}
