import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { buildFlickrStaticUrl, capThumbSuffix, longestEdgeBySuffix, parseFlickrStaticUrl, pickBestSuffixForEdge, type FlickrSizeSuffix } from "../images/flickr";
import { prefetchImage } from "../images/prefetch";
import { useQuality } from "../perf/useQuality";

type Variant = "grid" | "lightbox";

type Props = {
  baseUrl: string;
  originalWidth: number;
  originalHeight: number;
  variant: Variant;

  alt: string;
  className?: string;
  style?: CSSProperties;

  // Higher priority for above-the-fold items.
  priority?: boolean;

  // Override sizes for <img sizes="...">.
  sizes?: string;

  // Optional: report the actually loaded image's intrinsic size.
  // Useful when the dataset dimensions are imperfect or when a suffix falls back.
  onLoadNaturalSize?: (naturalWidth: number, naturalHeight: number) => void;

  // For lightbox only: contain (default) or cover.
  fit?: "contain" | "cover";
};

type ThumbSuffix = "n" | "z" | "c" | "b";

const thumbFallbackChain: Record<ThumbSuffix, ThumbSuffix[]> = {
  b: ["b", "c", "z", "n"],
  c: ["c", "z", "n"],
  z: ["z", "n"],
  n: ["n"]
};

// Defaults aligned to `.masonry` columns + container padding.
// See globals.css:
// - .container padding: 0 20px
// - masonry column-gap: 14px
// - columns: 4 / 3 / 2 / 1 at breakpoints
const defaultGridSizes =
  "(max-width: 520px) calc(100vw - 40px), (max-width: 840px) calc((100vw - 40px - 14px) / 2), (max-width: 1100px) calc((100vw - 40px - 28px) / 3), calc((min(1120px, 100vw) - 40px - 42px) / 4)";

function safeNumber(n: number, fallback: number) {
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function computeCandidateWidths(originalW: number, originalH: number, suffixes: ThumbSuffix[]) {
  const ow = safeNumber(originalW, 1);
  const oh = safeNumber(originalH, 1);

  const longest = Math.max(ow, oh);
  const isLandscape = ow >= oh;

  return suffixes
    .map((s) => {
      const targetLongest = Math.min(longestEdgeBySuffix[s], longest);
      const width = isLandscape ? targetLongest : Math.round((targetLongest * ow) / oh);
      return { suffix: s, width: Math.max(1, Math.min(Math.round(ow), width)) };
    })
    .filter((x, idx, arr) => arr.findIndex((y) => y.width === x.width) === idx)
    .sort((a, b) => a.width - b.width);
}

function cssAspectRatio(w: number, h: number) {
  const sw = safeNumber(w, 1);
  const sh = safeNumber(h, 1);
  return `${sw} / ${sh}`;
}

function useImageLoadedFlag(src: string) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setLoaded(false);
  }, [src]);
  return { loaded, setLoaded };
}

function getLightboxDesiredFullEdge() {
  if (typeof window === "undefined") return 1600;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const viewportEdge = Math.max(vw, vh);

  // Cap DPR at 2 to avoid over-fetching.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  // 1.5× viewport longest edge usually covers zoom + crispness.
  return Math.ceil(viewportEdge * dpr * 1.5);
}

function clampSuffixToOriginal(suffix: FlickrSizeSuffix, originalLongestEdge: number): FlickrSizeSuffix {
  const order: FlickrSizeSuffix[] = ["n", "z", "c", "b", "h", "k", "3k", "4k"];
  const idx = order.indexOf(suffix);
  if (idx === -1) return "b";

  let best: FlickrSizeSuffix = "n";
  for (let i = 0; i <= idx; i++) {
    const s = order[i];
    if (longestEdgeBySuffix[s] > originalLongestEdge) break;
    best = s;
  }
  return best;
}

export default function ResponsiveFlickrImage({
  baseUrl,
  originalWidth,
  originalHeight,
  variant,
  alt,
  className,
  style,
  priority,
  sizes,
  onLoadNaturalSize,
  fit = "contain"
}: Props) {
  const { config, tier } = useQuality();

  const ow = safeNumber(originalWidth, 1);
  const oh = safeNumber(originalHeight, 1);
  const originalLongest = Math.max(ow, oh);

  const parsed = useMemo(() => parseFlickrStaticUrl(baseUrl), [baseUrl]);
  const isFlickr = Boolean(parsed);

  // --- GRID ---
  const maxThumbSuffix: ThumbSuffix = useMemo(() => {
    // Tier-aware cap.
    // Tier0 uses n; Tier1 uses z; Tier2 uses c; Tier3 uses b.
    const tierCap: ThumbSuffix = tier >= 3 ? "b" : tier === 2 ? "c" : tier === 1 ? "z" : "n";

    // Config can further reduce it.
    const configCap = config.images.maxThumbSuffix;

    const order: ThumbSuffix[] = ["n", "z", "c", "b"];
    const cap = order[Math.min(order.indexOf(tierCap), order.indexOf(configCap))] ?? "n";
    return capThumbSuffix(cap, originalLongest);
  }, [tier, config.images.maxThumbSuffix, originalLongest]);

  const thumbCandidates = useMemo(() => {
    if (!isFlickr) return [];

    const chain = thumbFallbackChain[maxThumbSuffix];
    const unique = Array.from(new Set(chain));
    return computeCandidateWidths(ow, oh, unique);
  }, [isFlickr, maxThumbSuffix, ow, oh]);

  const initialThumbSuffix = maxThumbSuffix;
  const [thumbFallbackIndex, setThumbFallbackIndex] = useState(0);

  useEffect(() => {
    // Reset fallback when the cap changes (tier/config change).
    setThumbFallbackIndex(0);
  }, [maxThumbSuffix, baseUrl]);

  const thumbFallbackList = thumbFallbackChain[initialThumbSuffix];
  const thumbSuffix = thumbFallbackList[Math.min(thumbFallbackIndex, thumbFallbackList.length - 1)];

  const gridSrc = useMemo(() => {
    if (!isFlickr) return baseUrl;
    return buildFlickrStaticUrl(baseUrl, thumbSuffix);
  }, [baseUrl, isFlickr, thumbSuffix]);

  const gridSrcSet = useMemo(() => {
    if (!isFlickr) return undefined;
    if (thumbCandidates.length === 0) return undefined;

    return thumbCandidates
      .map((c) => `${buildFlickrStaticUrl(baseUrl, c.suffix)} ${c.width}w`)
      .join(", ");
  }, [isFlickr, thumbCandidates, baseUrl]);

  // --- LIGHTBOX ---
  const [showFull, setShowFull] = useState(false);
  const fullAttemptedRef = useRef(false);

  const mediumSuffix: ThumbSuffix = useMemo(() => {
    // Choose a safe medium that appears quickly.
    // Cap by tier/config to avoid giant download on low tiers.
    const cap = maxThumbSuffix;
    const order: ThumbSuffix[] = ["n", "z", "c", "b"];
    const capIndex = order.indexOf(cap);

    // Prefer b, then c, then z.
    const preferred: ThumbSuffix[] = ["b", "c", "z", "n"];
    for (const s of preferred) {
      if (order.indexOf(s) <= capIndex) return s;
    }
    return "c";
  }, [maxThumbSuffix]);

  const [lightboxMediumFallbackIndex, setLightboxMediumFallbackIndex] = useState(0);
  const lightboxMediumList = thumbFallbackChain[mediumSuffix];
  const lightboxMediumSuffix = lightboxMediumList[Math.min(lightboxMediumFallbackIndex, lightboxMediumList.length - 1)];

  useEffect(() => {
    setShowFull(false);
    fullAttemptedRef.current = false;
    setLightboxMediumFallbackIndex(0);
  }, [baseUrl, variant, mediumSuffix]);

  const lightboxMediumSrc = useMemo(() => {
    if (!isFlickr) return baseUrl;
    return buildFlickrStaticUrl(baseUrl, lightboxMediumSuffix);
  }, [isFlickr, baseUrl, lightboxMediumSuffix]);

  const fullSuffix: FlickrSizeSuffix = useMemo(() => {
    const desired = getLightboxDesiredFullEdge();

    // Find the smallest suffix that meets desired edge.
    const picked = pickBestSuffixForEdge(desired, "4k", originalLongest);

    // Clamp to original.
    return clampSuffixToOriginal(picked, originalLongest);
  }, [originalLongest]);

  const fullFallbackChain: FlickrSizeSuffix[] = useMemo(() => {
    // If higher-res fails, step down. Keep it deterministic.
    const order: FlickrSizeSuffix[] = ["4k", "3k", "k", "h", "b", "c", "z", "n"];
    const startIdx = Math.max(0, order.indexOf(fullSuffix));
    const chain = order.slice(startIdx);

    // Remove sizes larger than original.
    return chain.filter((s) => longestEdgeBySuffix[s] <= originalLongest);
  }, [fullSuffix, originalLongest]);

  const [fullFallbackIndex, setFullFallbackIndex] = useState(0);
  const fullSuffixActive = fullFallbackChain[Math.min(fullFallbackIndex, fullFallbackChain.length - 1)] ?? "b";

  const fullSrc = useMemo(() => {
    if (!isFlickr) return baseUrl;
    return buildFlickrStaticUrl(baseUrl, fullSuffixActive);
  }, [isFlickr, baseUrl, fullSuffixActive]);

  const { loaded: mediumLoaded, setLoaded: setMediumLoaded } = useImageLoadedFlag(lightboxMediumSrc);
  const { loaded: fullLoaded, setLoaded: setFullLoaded } = useImageLoadedFlag(fullSrc);

  // Start loading full once medium is visible enough.
  useEffect(() => {
    if (variant !== "lightbox") return;
    if (!isFlickr) return;
    if (fullAttemptedRef.current) return;

    // Don’t fetch full until the medium at least starts loading.
    // (Avoids double-download races.)
    fullAttemptedRef.current = true;

    // Use an <img> preload via JS to detect success and avoid swapping to broken URL.
    prefetchImage(fullSrc)
      .then(() => {
        setShowFull(true);
      })
      .catch(() => {
        // On failure, try next fallback, without affecting global tier.
        setFullFallbackIndex((i) => Math.min(i + 1, fullFallbackChain.length - 1));
        fullAttemptedRef.current = false;
      });
  }, [variant, isFlickr, fullSrc, fullFallbackChain.length]);

  const gridImgStyle: CSSProperties = useMemo(
    () => ({
      ...style,
      aspectRatio: cssAspectRatio(ow, oh)
    }),
    [style, ow, oh]
  );

  const placeholderStyle: CSSProperties | undefined =
    config.images.placeholderStrategy === "solid"
      ? {
          background: "rgba(255,255,255,0.06)"
        }
      : undefined;

  if (variant === "lightbox") {
    // Progressive: medium → full swap.
    return (
      <div
        className={className}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          // Ensure the wrapper fills `.modalMedia` (which is a grid container using place-items:center).
          // Without this, some aspect ratios can end up centered with extra gaps.
          alignSelf: "stretch",
          justifySelf: "stretch",
          minWidth: 0,
          minHeight: 0,
          ...(style ?? {}),
          ...placeholderStyle
        }}
      >
        <img
          src={lightboxMediumSrc}
          alt={alt}
          width={Math.round(ow)}
          height={Math.round(oh)}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: fit,
            opacity: showFull && fullLoaded ? 0 : 1,
            transition: "opacity 180ms ease",
            willChange: "opacity"
          }}
          onLoad={(e) => {
            setMediumLoaded(true);
            onLoadNaturalSize?.(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
          }}
          onError={() => {
            setLightboxMediumFallbackIndex((i) => Math.min(i + 1, lightboxMediumList.length - 1));
          }}
        />

        {/* The full image is only shown if it successfully prefetched and loaded. */}
        {showFull ? (
          <img
            src={fullSrc}
            alt={alt}
            width={Math.round(ow)}
            height={Math.round(oh)}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: fit,
              opacity: fullLoaded ? 1 : 0,
              transition: "opacity 180ms ease",
              willChange: "opacity"
            }}
            onLoad={() => setFullLoaded(true)}
            onError={() => {
              setFullFallbackIndex((i) => Math.min(i + 1, fullFallbackChain.length - 1));
              setShowFull(false);
              fullAttemptedRef.current = false;
            }}
          />
        ) : null}

        {/* Tiny status hook for timing; avoids unused warnings */}
        <span style={{ display: "none" }} aria-hidden>
          {mediumLoaded ? "m" : ""}
        </span>
      </div>
    );
  }

  // Grid thumbnail.
  return (
    <img
      className={className}
      src={gridSrc}
      srcSet={gridSrcSet}
      sizes={sizes ?? defaultGridSizes}
      alt={alt}
      width={Math.round(ow)}
      height={Math.round(oh)}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "low"}
      style={{ ...gridImgStyle, ...placeholderStyle }}
      onError={() => {
        // Suffix fallback chain: b → c → z → n.
        setThumbFallbackIndex((i) => Math.min(i + 1, thumbFallbackList.length - 1));
      }}
    />
  );
}
