import { useEffect } from "react";
import { useSiteSettings } from "../data/useSiteSettings";
/** The same public icon applies before and after admin authentication. */
export default function SiteFavicon() {
  const settings = useSiteSettings(),
    url = settings?.faviconUrl;
  useEffect(() => {
    if (!url) return;
    const base = url.replace(/32\.png$/, ""),
      originals = Array.from(
        document.querySelectorAll<HTMLLinkElement>('link[rel="icon"],link[rel="apple-touch-icon"]')
      );
    for (const link of originals) link.remove();
    const created: HTMLLinkElement[] = [];
    for (const [rel, file] of [
      ["icon", "32.png"],
      ["apple-touch-icon", "180.png"],
      ["icon", "192.png"],
      ["icon", "512.png"]
    ] as const) {
      const link = document.createElement("link");
      link.rel = rel;
      link.href = base + file;
      if (rel === "icon") {
        link.type = "image/png";
        link.sizes = file.replace(".png", "") + "x" + file.replace(".png", "");
      }
      document.head.append(link);
      created.push(link);
    }
    return () => {
      for (const link of created) link.remove();
      for (const link of originals) document.head.append(link);
    };
  }, [url]);
  return null;
}
