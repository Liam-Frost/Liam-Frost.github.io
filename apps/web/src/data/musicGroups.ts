import type { PublicMediaSummary, PublicPlaylist } from "@liam-frost/shared";

import { pickLocalized, type Lang } from "../lib/i18n";

export type MusicView = "albums" | "artists" | "playlists";
export const MUSIC_VIEWS: MusicView[] = ["albums", "artists", "playlists"];

/** Albums, artists or playlists with their songs (in playlist order for playlists). */
export type MusicGroup = {
  key: string;
  title: string;
  subtitle: string;
  covers: string[];
  items: PublicMediaSummary[];
  spotifyUrl: string | null;
};

const coversOf = (items: PublicMediaSummary[]) =>
  [
    ...new Set(
      items.map((item) => item.poster?.variants[0].url).filter((url): url is string => Boolean(url))
    )
  ].slice(0, 4);

export function musicGroups(
  view: MusicView,
  songs: PublicMediaSummary[],
  playlists: PublicPlaylist[],
  lang: Lang
): MusicGroup[] {
  if (view === "playlists") {
    const byId = new Map(songs.map((song) => [song.id, song]));
    return playlists
      .map((playlist) => {
        const items = playlist.trackIds
          .map((id) => byId.get(id))
          .filter((song): song is PublicMediaSummary => Boolean(song));
        return {
          key: playlist.id,
          title: pickLocalized(playlist.name, lang),
          subtitle: pickLocalized(playlist.description, lang),
          covers: coversOf(items),
          items,
          spotifyUrl: playlist.sourceUrl
        };
      })
      .filter((group) => group.items.length > 0);
  }

  const groups = new Map<string, PublicMediaSummary[]>();
  for (const song of songs) {
    // Albums: by album and first singer (two albums can share a name); artists: under each singer.
    const keys =
      view === "albums"
        ? song.music?.album
          ? [`${song.music.album}\u0000${song.credits[0] ?? ""}`]
          : []
        : song.credits;
    for (const key of keys) groups.set(key, [...(groups.get(key) ?? []), song]);
  }
  return [...groups]
    .map(([key, items]) => {
      const [title, artist] = key.split("\u0000");
      // Songs of one album each keep their own copy of its cover; one is enough.
      return {
        key,
        title,
        subtitle: view === "albums" ? (artist ?? "") : "",
        covers: coversOf(items).slice(0, 1),
        items,
        spotifyUrl: null
      };
    })
    .sort((a, b) => b.items.length - a.items.length || a.title.localeCompare(b.title));
}
