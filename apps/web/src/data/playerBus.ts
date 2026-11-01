import type { SpotifyTrack } from "@liam-frost/shared";
import { useSyncExternalStore } from "react";

import { track } from "../lib/analytics";

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
/** For analytics: what the page last asked to play, so a song that starts right after counts as its play. */
let lastCommand: { source: "button" | "all"; at: number } | null = null;
let countedTrack: string | null = null;

/**
 * Asks the player in the corner to play a song (or pause). Dispatched synchronously, so the player starts
 * audio inside the click that asked for it, which browsers count as user-initiated playback.
 */
export function sendPlayerCommand(command: Command) {
  if (command.type !== "pause")
    lastCommand = { source: command.type === "play" ? "button" : "all", at: Date.now() };
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
  // A play is counted when a song starts; pausing and resuming it is not another play.
  if (next.playing && next.trackId && next.trackId !== countedTrack) {
    const fromPage = lastCommand && Date.now() - lastCommand.at < 3000 ? lastCommand.source : null;
    track("music_play", { contentId: next.trackId, target: "site", detail: fromPage ?? "dock" });
    lastCommand = null;
    countedTrack = next.trackId;
  }
  if (!next.trackId) countedTrack = null;
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
