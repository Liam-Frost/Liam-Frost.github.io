import type { SpotifyTrack } from "@liam-frost/shared";

export type FetchedPlaylist = { id: string; name: string; image: string; link: string; tracks: SpotifyTrack[] };

/**
 * Loads a playlist; `knownCovers` maps track ids to cover URLs already known. Cover lookups stop after
 * `coverBudgetMs` (default 20 s); tracks without their own cover get the playlist's.
 */
export type PlaylistFetcher = (playlistId: string, knownCovers: ReadonlyMap<string, string>, options?: { coverBudgetMs?: number }) => Promise<FetchedPlaylist>;

/** Errors worth showing in the admin as they are. */
export class PlaylistError extends Error {}

const ID = /^[A-Za-z0-9]{22}$/;
const TIMEOUT_MS = 10_000;
const COVER_TIMEOUT_MS = 5000;
const COVER_CONCURRENCY = 6;
/** Covers not found within this time use the playlist cover until the next sync. */
const COVER_BUDGET_MS = 20_000;

/** Accepts https://open.spotify.com/[intl-xx/]playlist/<id>[?si=...] and spotify:playlist:<id>. */
export function playlistIdFromUrl(value: string): string | null {
  const uri = /^spotify:playlist:([A-Za-z0-9]+)$/.exec(value.trim());
  if (uri) return ID.test(uri[1]) ? uri[1] : null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "open.spotify.com") return null;
  const match = /^\/(?:intl-[a-z-]+\/)?(?:embed\/)?playlist\/([A-Za-z0-9]+)\/?$/.exec(url.pathname);
  return match && ID.test(match[1]) ? match[1] : null;
}

export const playlistUrl = (id: string) => `https://open.spotify.com/playlist/${id}`;

type EmbedTrack = {
  uri?: string;
  title?: string;
  subtitle?: string;
  isPlayable?: boolean;
  audioPreview?: { url?: string } | null;
};

type EmbedEntity = {
  name?: string;
  title?: string;
  coverArt?: { sources?: { url?: string }[] };
  trackList?: EmbedTrack[];
};

function get(fetchImpl: typeof fetch, url: string, timeoutMs = TIMEOUT_MS) {
  return fetchImpl(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "user-agent": "Mozilla/5.0 (compatible; liam-frost-site)", "accept-language": "en" }
  });
}

/**
 * Spotify's Web API no longer serves editorial playlists or preview URLs to new apps, so the playlist
 * comes from its public embed page (the data the embed player itself uses). Its format is not a public
 * contract: when it changes, this throws and the last good snapshot stays in use.
 */
export function parseEmbedPage(html: string): { name: string; image: string; tracks: Omit<SpotifyTrack, "image">[] } {
  const script = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  let entity: EmbedEntity | undefined;
  try {
    entity = script ? JSON.parse(script[1])?.props?.pageProps?.state?.data?.entity : undefined;
  } catch {
    entity = undefined;
  }
  if (!entity || !Array.isArray(entity.trackList)) {
    throw new PlaylistError("无法解析 Spotify 歌单页面（页面格式可能已变化）");
  }

  const tracks: Omit<SpotifyTrack, "image">[] = [];
  const seen = new Set<string>();
  for (const track of entity.trackList) {
    const id = /^spotify:track:([A-Za-z0-9]{22})$/.exec(track.uri ?? "")?.[1];
    const preview = track.audioPreview?.url ?? "";
    // Songs without a preview are kept (with ""): imports add them, only the player needs previews.
    const previewUrl = preview.startsWith("https://") ? preview : "";
    if (!id || seen.has(id) || track.isPlayable === false) continue;
    seen.add(id);
    tracks.push({
      id,
      title: track.title?.trim() || "Unknown",
      artist: track.subtitle?.trim() || "",
      link: `https://open.spotify.com/track/${id}`,
      previewUrl
    });
  }

  return {
    name: entity.name?.trim() || entity.title?.trim() || "Spotify",
    image: entity.coverArt?.sources?.find((source) => source.url?.startsWith("https://"))?.url ?? "",
    tracks
  };
}

/** Track covers are not in the playlist embed; oEmbed has them. Failures fall back to the playlist cover. */
async function trackCover(fetchImpl: typeof fetch, id: string) {
  try {
    const url = `https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${id}`)}`;
    const response = await get(fetchImpl, url, COVER_TIMEOUT_MS);
    if (!response.ok) {
      // Release the connection instead of leaving the unread body to the garbage collector.
      await response.body?.cancel();
      return "";
    }
    const data = (await response.json()) as { thumbnail_url?: unknown };
    return typeof data.thumbnail_url === "string" && data.thumbnail_url.startsWith("https://") ? data.thumbnail_url : "";
  } catch {
    return "";
  }
}

export function createPlaylistFetcher(fetchImpl: typeof fetch = fetch): PlaylistFetcher {
  return async (playlistId, knownCovers, options = {}) => {
    let response: Response;
    try {
      response = await get(fetchImpl, `https://open.spotify.com/embed/playlist/${playlistId}`);
    } catch {
      throw new PlaylistError("无法连接 Spotify");
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new PlaylistError(response.status === 404 ? "歌单不存在或不是公开歌单" : `Spotify 返回错误（HTTP ${response.status}）`);
    }

    const parsed = parseEmbedPage(await response.text());
    if (!parsed.tracks.length) throw new PlaylistError("歌单里没有可以导入的歌曲");

    // Covers from earlier syncs are reused; only new tracks are looked up, within a time budget.
    const covers = new Map(knownCovers);
    const missing = parsed.tracks.filter((track) => !covers.has(track.id));
    const deadline = Date.now() + (options.coverBudgetMs ?? COVER_BUDGET_MS);
    for (let i = 0; i < missing.length && Date.now() < deadline; i += COVER_CONCURRENCY) {
      const batch = missing.slice(i, i + COVER_CONCURRENCY);
      const found = await Promise.all(batch.map((track) => trackCover(fetchImpl, track.id)));
      batch.forEach((track, index) => {
        if (found[index]) covers.set(track.id, found[index]);
      });
    }

    return {
      id: playlistId,
      name: parsed.name,
      image: parsed.image,
      link: playlistUrl(playlistId),
      tracks: parsed.tracks.map((track) => ({ ...track, image: covers.get(track.id) || parsed.image }))
    };
  };
}

const EMBED_TYPES = ["playlist", "album", "track", "artist"] as const;
export type SpotifyEmbedType = (typeof EMBED_TYPES)[number];

/**
 * Normalizes a Spotify link or URI for the embedded player: open.spotify.com/[intl-xx/][embed/]{type}/{id}
 * or spotify:{type}:{id} → https://open.spotify.com/{type}/{id}; null for anything else.
 */
export function spotifyLink(value: string): string | null {
  const trimmed = value.trim();
  const uri = /^spotify:([a-z]+):([A-Za-z0-9]{22})$/.exec(trimmed);
  let type: string | undefined;
  let id: string | undefined;
  if (uri) {
    [, type, id] = uri;
  } else {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return null;
    }
    if (url.protocol !== "https:" || url.hostname !== "open.spotify.com") return null;
    const match = /^\/(?:intl-[a-z-]+\/)?(?:embed\/)?([a-z]+)\/([A-Za-z0-9]{22})\/?$/.exec(url.pathname);
    if (!match) return null;
    [, type, id] = match;
  }
  return (EMBED_TYPES as readonly string[]).includes(type!) ? `https://open.spotify.com/${type}/${id}` : null;
}

/** The 30-second preview of one track, from its embed page; null when it has none or the page fails. */
export async function fetchTrackPreview(trackId: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  try {
    const response = await get(fetchImpl, `https://open.spotify.com/embed/track/${trackId}`);
    if (!response.ok) {
      await response.body?.cancel();
      return null;
    }
    const script = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(await response.text());
    const entity = script ? JSON.parse(script[1])?.props?.pageProps?.state?.data?.entity : null;
    const url: unknown = entity?.audioPreview?.url;
    return typeof url === "string" && url.startsWith("https://p.scdn.co/") ? url : null;
  } catch {
    return null;
  }
}
