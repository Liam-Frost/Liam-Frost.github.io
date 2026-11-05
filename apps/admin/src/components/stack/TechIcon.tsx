import { stackInitials } from "@liam-frost/shared";
import { useEffect, useState } from "react";

/**
 * Logos come from the API (a path on this site or an https URL) or are a local file's preview
 * (a blob: URL of a canvas-encoded PNG, never the raw uploaded file). Anything else is not used.
 */
const IMAGE_SOURCE = /^(?:https?:\/\/|blob:|\/(?![/\\]))/i;
function imageSource(url: string | null) {
  if (url === null || !IMAGE_SOURCE.test(url)) return null;
  return url;
}

/**
 * A technology's logo in a fixed square, never stretched; its initials when there is no logo or it
 * fails to load (same box, so nothing moves).
 */
export function TechIcon({
  name,
  url,
  size = "md"
}: {
  name: string;
  url: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  const src = imageSource(url);
  const box =
    size === "lg"
      ? "size-14 rounded-xl p-2"
      : size === "sm"
        ? "size-7 rounded-md p-1"
        : "size-9 rounded-lg p-1.5";
  const text = size === "lg" ? "text-[17px]" : size === "sm" ? "text-[10px]" : "text-[12px]";
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center bg-canvas ring-1 ring-line-soft ${box}`}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          className="size-full object-contain"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={`font-semibold text-brand-secondary ${text}`}>{stackInitials(name)}</span>
      )}
    </span>
  );
}
