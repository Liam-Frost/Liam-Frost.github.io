import { useState } from "react";
import { usePresentation } from "../data/usePresentation";

/** `override` shows a logo that is not saved yet, for the admin's preview. */
export default function SiteMark({
  admin = false,
  override
}: {
  admin?: boolean;
  override?: { text: string; alt?: string; src: string | null };
}) {
  const settings = usePresentation();
  const slot = admin ? "adminLogo" : "publicLogo";
  const logo = override ?? settings?.[slot];
  const src = override ? override.src : (settings?.logoUrls?.[slot] ?? null);
  const [failed, setFailed] = useState<string | null>(null);
  if ((src && failed !== src) || logo?.text)
    return (
      <span
        aria-hidden={logo?.alt ? undefined : true}
        role={logo?.alt ? "img" : undefined}
        aria-label={logo?.alt || undefined}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: src && failed !== src ? 36 : "auto",
          minWidth: 36,
          maxWidth: 140,
          height: 36,
          flexShrink: 0,
          fontSize:
            src && failed !== src ? 16 : Math.min(16, 120 / Math.max(1, logo?.text.length ?? 1)),
          fontWeight: 700,
          overflow: "hidden"
        }}
      >
        {src && failed !== src ? (
          <img
            src={src}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
            onError={() => setFailed(src)}
          />
        ) : (
          logo?.text
        )}
      </span>
    );
  return (
    <span
      aria-hidden="true"
      className={admin ? "size-7 shrink-0" : "brandMark"}
      style={
        admin
          ? {
              background: "linear-gradient(135deg,#547792,#94b4c1)",
              mask: 'url("./favicon.svg?v=lf") center / contain no-repeat',
              WebkitMask: 'url("./favicon.svg?v=lf") center / contain no-repeat'
            }
          : undefined
      }
    />
  );
}
