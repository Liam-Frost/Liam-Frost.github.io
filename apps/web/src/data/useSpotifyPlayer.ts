import type { PublicSpotifyPlayer } from "@liam-frost/shared";
import { useEffect, useState } from "react";

import { apiFetchEnabled, apiUrl } from "../lib/api";
import { site } from "./site";

/** Used by static builds and whenever the API has no playlist to offer. */
const FALLBACK: PublicSpotifyPlayer = {
  enabled: true,
  shuffle: true,
  volume: 30,
  autoCollapseSeconds: 3,
  tracks: site.spotify.tracks
};

/** The Spotify player's settings and tracks; null while loading or when the player is turned off. */
export function useSpotifyPlayer() {
  const [player, setPlayer] = useState<PublicSpotifyPlayer | null>(apiFetchEnabled ? null : FALLBACK);

  useEffect(() => {
    if (!apiFetchEnabled) return;
    const controller = new AbortController();
    fetch(apiUrl("/api/spotify/player"), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load the Spotify player: ${response.status}`);
        return response.json() as Promise<PublicSpotifyPlayer>;
      })
      .then((data) => setPlayer(data.enabled && !data.tracks?.length ? { ...data, tracks: FALLBACK.tracks } : data))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPlayer(FALLBACK);
      });
    return () => controller.abort();
  }, []);

  return player?.enabled && player.tracks.length ? player : null;
}
