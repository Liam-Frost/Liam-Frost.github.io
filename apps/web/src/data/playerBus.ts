import type { SpotifyTrack } from "@liam-frost/shared";
import { useSyncExternalStore } from "react";

/** A song the page asks the player to play: the site player uses the preview, Spotify's player the link. */
export type PlayRequest = SpotifyTrack & { spotifyUrl: string | null };

type Command =
  | { type: "play"; track: PlayRequest }
  | { type: "pause" }
  /** Plays a list (an album, an artist, a playlist) from its first song; Spotify's player shows `spotifyUrl`. */
  | { type: "queue"; tracks: PlayRequest[]; spotifyUrl: string | null };
type NowPlaying = { trackId: string | null; playing: boolean };

const COMMAND = "lf:player";
let nowPlaying: NowPlaying = { trackId: null, playing: false };
const listeners = new Set<() => void>();

/**
 * Asks the player in the corner to play a song (or pause). Dispatched synchronously, so the player starts
 * audio inside the click that asked for it, which browsers count as user-initiated playback.
 */
export function sendPlayerCommand(command: Command) {
  window.dispatchEvent(new CustomEvent<Command>(COMMAND, { detail: command }));
}

export function onPlayerCommand(handler: (command: Command) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<Command>).detail);
  window.addEventListener(COMMAND, listener);
  return () => window.removeEventListener(COMMAND, listener);
}

/** The player reports which song it is on and whether it plays, so buttons can show pause. */
export function setNowPlaying(next: NowPlaying) {
  if (next.trackId === nowPlaying.trackId && next.playing === nowPlaying.playing) return;
  nowPlaying = next;
  for (const listener of listeners) listener();
}

export function useNowPlaying() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => nowPlaying
  );
}
