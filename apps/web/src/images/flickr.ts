export type FlickrSizeSuffix = "n" | "z" | "c" | "b" | "h" | "k" | "3k" | "4k";

export type FlickrStaticParts = {
  serverId: string;
  photoId: string;
  secret: string;
  suffix?: string;
  ext: string;
};

// Longest-edge targets (approx) for common Flickr suffixes.
// Source of truth: Flickr "Photo Image URLs / Size Suffixes".
export const longestEdgeBySuffix: Record<FlickrSizeSuffix, number> = {
  n: 320,
  z: 640,
  c: 800,
  b: 1024,
  h: 1600,
  k: 2048,
  "3k": 3072,
  "4k": 4096
};

const STATIC_HOST_RE = /^https?:\/\/live\.staticflickr\.com\/(.+)$/i;

// Supports multi-character suffixes like _3k / _4k.
const STATIC_URL_RE = /^https?:\/\/live\.staticflickr\.com\/(?<serverId>[^/]+)\/(?<photoId>\d+?)_(?<secret>[^_./]+?)(?:_(?<suffix>[a-z0-9]+))?\.(?<ext>[a-z0-9]+)(?:\?.*)?$/i;

export function parseFlickrStaticUrl(url: string): FlickrStaticParts | null {
  if (!url) return null;

  const match = url.match(STATIC_URL_RE);
  if (!match || !match.groups) return null;

  const { serverId, photoId, secret, suffix, ext } = match.groups as Record<string, string>;

  return {
    serverId,
    photoId,
    secret,
    suffix,
    ext: ext || "jpg"
  };
}

export function isFlickrStaticUrl(url: string) {
  return STATIC_HOST_RE.test(url);
}

export function buildFlickrStaticUrl(
  base: FlickrStaticParts | string,
  suffix?: FlickrSizeSuffix | string,
  extOverride?: string
): string {
  const parts = typeof base === "string" ? parseFlickrStaticUrl(base) : base;
  if (!parts) return typeof base === "string" ? base : "";

  const ext = (extOverride ?? parts.ext ?? "jpg").replace(/^\./, "");

  const suffixPart = suffix ? `_${suffix}` : "";
  return `https://live.staticflickr.com/${parts.serverId}/${parts.photoId}_${parts.secret}${suffixPart}.${ext}`;
}

export function pickBestSuffixForEdge(
  desiredLongestEdge: number,
  maxSuffix: FlickrSizeSuffix,
  originalLongestEdge: number
): FlickrSizeSuffix {
  const desired = Math.min(originalLongestEdge, Math.max(1, Math.floor(desiredLongestEdge)));
  const maxEdge = longestEdgeBySuffix[maxSuffix];

  const order: FlickrSizeSuffix[] = ["n", "z", "c", "b", "h", "k", "3k", "4k"];

  let best: FlickrSizeSuffix = "n";
  for (const s of order) {
    const edge = longestEdgeBySuffix[s];
    if (edge > originalLongestEdge) break;
    if (edge > maxEdge) break;

    best = s;
    if (edge >= desired) return s;
  }

  return best;
}

export function capThumbSuffix(maxThumbSuffix: "n" | "z" | "c" | "b", originalLongestEdge: number): "n" | "z" | "c" | "b" {
  const order: Array<"n" | "z" | "c" | "b"> = ["n", "z", "c", "b"];
  const maxIndex = order.indexOf(maxThumbSuffix);

  let best: "n" | "z" | "c" | "b" = "n";
  for (let i = 0; i <= maxIndex; i++) {
    const s = order[i];
    if (longestEdgeBySuffix[s] > originalLongestEdge) break;
    best = s;
  }

  return best;
}
