import type { PublicSpotifyPlayer } from "@liam-frost/shared";
import { useEffect, useState } from "react";

import { apiFetchEnabled, apiUrl } from "../lib/api";
import { site } from "./site";

/** Used by static builds and whenever the API has no playlist to offer. */
const FALLBACK: PublicSpotifyPlayer = {
  enabled: true,
  mode: "custom",
  embedUrl: "",
  shuffle: true,
  volume: 30,
  autoCollapseSeconds: 3,
  playlistId: null,
  tracks: site.spotify.tracks
};

/** One request per page load: the dock and the collection's play buttons share it. */
let loading: Promise<PublicSpotifyPlayer> | null = null;

function loadPlayer() {
  loading ??= fetch(apiUrl("/api/spotify/player"))
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to load the Spotify player: ${response.status}`);
      return response.json() as Promise<PublicSpotifyPlayer>;
    })
    // The site's own player falls back to built-in tracks when the collection has none.
    .then((data) =>
      data.enabled && data.mode !== "embed" && !data.tracks?.length
        ? { ...data, tracks: FALLBACK.tracks }
        : data
    )
    .catch(() => FALLBACK);
  return loading;
}

/** The Spotify player's settings and tracks; null while loading or when the player is turned off. */
export function useSpotifyPlayer() {
  const [player, setPlayer] = useState<PublicSpotifyPlayer | null>(
    apiFetchEnabled ? null : FALLBACK
  );

  useEffect(() => {
    if (!apiFetchEnabled) return;
    let current = true;
    void loadPlayer().then((data) => {
      if (current) setPlayer(data);
    });
    return () => {
      current = false;
    };
  }, []);

  if (!player?.enabled) return null;
  return (player.mode === "embed" ? Boolean(player.embedUrl) : player.tracks.length > 0)
    ? player
    : null;
}
