import type { MusicSearchResult } from "@liam-frost/shared";

import { SourceError } from "./sources";

/** An iTunes song, with a large cover for importing. */
export type ItunesSong = Omit<MusicSearchResult, "existingId"> & {
  artworkLarge: string | null;
  genre: string | null;
};

export interface MusicSource {
  /** Songs matching a free-text search in one iTunes store (e.g. "US", "JP"). */
  search(term: string, country: string): Promise<ItunesSong[]>;
  lookup(itunesId: string, country: string): Promise<ItunesSong | null>;
  /** The iTunes song that best matches a song from elsewhere (for its preview); null when none is close. */
  findPreview(title: string, artist: string, durationMs: number | null): Promise<ItunesSong | null>;
}

export const MUSIC_STORES = ["US", "JP", "GB", "FR", "CN", "TW", "HK"] as const;

const TIMEOUT_MS = 10_000;

type ItunesResult = {
  wrapperType?: string;
  kind?: string;
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  releaseDate?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
  trackViewUrl?: string;
  primaryGenreName?: string;
};

const https = (value: string | undefined) => (value?.startsWith("https://") ? value : null);

function toSong(result: ItunesResult): ItunesSong | null {
  if (result.kind !== "song" || !result.trackId || !result.trackName) return null;
  const artwork = https(result.artworkUrl100);
  return {
    itunesId: String(result.trackId),
    title: result.trackName,
    artist: result.artistName ?? "",
    album: result.collectionName ?? null,
    year: Number(result.releaseDate?.slice(0, 4)) || null,
    artworkUrl: artwork,
    // The artwork URL ends with the size; ask for a larger square.
    artworkLarge: artwork ? artwork.replace(/\/\d+x\d+bb\.(jpg|png)$/, "/600x600bb.$1") : null,
    previewUrl: https(result.previewUrl),
    durationMs: result.trackTimeMillis ?? null,
    appleUrl: https(result.trackViewUrl)?.replace(/[?&]uo=\d+$/, "") ?? null,
    genre: result.primaryGenreName ?? null
  };
}

/** Compares names ignoring case, width, spacing and punctuation. */
const key = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "");
/** "Song (2019 Remaster)" and "Song - Remastered" match "Song". */
const baseTitle = (value: string) =>
  key(value.replace(/\s*[([（【].*?[)\]）】]\s*/g, " ").replace(/\s+-\s+.*$/, ""));

export function createMusicSource(fetchImpl: typeof fetch = fetch): MusicSource {
  const get = async (path: string, params: Record<string, string>) => {
    const url = new URL(`https://itunes.apple.com${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    let response: Response;
    try {
      response = await fetchImpl(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
    } catch {
      throw new SourceError(
        "无法连接 iTunes。如果访问它需要代理，请在 apps/api/.env 中设置 HTTPS_PROXY 后重启 API"
      );
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new SourceError(`iTunes 返回错误（HTTP ${response.status}）`);
    }
    const data = (await response.json()) as { results?: ItunesResult[] };
    return (data.results ?? []).map(toSong).filter((song): song is ItunesSong => song !== null);
  };

  const search = (term: string, country: string) =>
    get("/search", { term, country, entity: "song", limit: "25" });

  return {
    search,

    async lookup(itunesId, country) {
      return (await get("/lookup", { id: itunesId, country, entity: "song" }))[0] ?? null;
    },

    async findPreview(title, artist, durationMs) {
      const wantTitle = baseTitle(title);
      const wantArtist = key(artist.split(",")[0] ?? "");
      // Japanese releases are often only in the JP store, under Japanese names.
      for (const country of ["US", "JP"]) {
        let songs: ItunesSong[];
        try {
          songs = await search(`${title} ${artist.split(",")[0] ?? ""}`, country);
        } catch {
          continue;
        }
        const match = songs.find((song) => {
          if (!song.previewUrl) return false;
          const sameTitle = baseTitle(song.title) === wantTitle;
          const sameArtist =
            !wantArtist ||
            key(song.artist).includes(wantArtist) ||
            wantArtist.includes(key(song.artist));
          const closeLength =
            durationMs === null ||
            song.durationMs === null ||
            Math.abs(song.durationMs - durationMs) <= 5000;
          return sameTitle && sameArtist && closeLength;
        });
        if (match) return match;
      }
      return null;
    }
  };
}
