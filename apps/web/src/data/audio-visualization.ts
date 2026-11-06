/**
 * Whether music is playing, for the side navigator's simulated visualizer. It never reads or
 * reroutes the audio itself: the animation is simulated and only follows play and pause.
 */
type State = {
  source: "none" | "custom" | "spotify";
  playing: boolean;
};
let state: State = { source: "none", playing: false };
const subscribers = new Set<() => void>();
const publish = (next: State) => {
  if (next.source === state.source && next.playing === state.playing) return;
  state = next;
  subscribers.forEach((subscriber) => subscriber());
};
export const audioVisualization = {
  get: () => state,
  subscribe: (fn: () => void) => {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }
};

const SPOTIFY_ORIGIN = "https://open.spotify.com";
/** Spotify's embed reports playback about once a second while it plays. */
const SPOTIFY_SILENCE_MS = 4000;

type SpotifyMessage = { type?: unknown; payload?: { isPaused?: unknown } };

function spotifyMessage(data: unknown): SpotifyMessage | null {
  if (typeof data === "string") {
    try {
      return spotifyMessage(JSON.parse(data));
    } catch {
      return null;
    }
  }
  return data && typeof data === "object" ? (data as SpotifyMessage) : null;
}

/**
 * Spotify's embedded player (a plain iframe, so a signed-in visitor gets full tracks) posts its
 * playback state to the page: `playback_started`, and `playback_update` with `isPaused`. Only
 * messages from Spotify's origin and from this iframe count; without updates for a few seconds it
 * counts as stopped (the iframe was reloaded, or a message was lost).
 */
export function observeSpotifyEmbed(frame: () => HTMLIFrameElement | null) {
  publish({ source: "spotify", playing: false });
  let silence = 0;
  const set = (playing: boolean) => {
    window.clearTimeout(silence);
    if (playing)
      silence = window.setTimeout(
        () => publish({ source: "spotify", playing: false }),
        SPOTIFY_SILENCE_MS
      );
    publish({ source: "spotify", playing });
  };
  const onMessage = (event: MessageEvent) => {
    const iframe = frame();
    if (event.origin !== SPOTIFY_ORIGIN || !iframe || event.source !== iframe.contentWindow) return;
    const message = spotifyMessage(event.data);
    if (!message) return;
    if (message.type === "playback_started") set(true);
    else if (message.type === "playback_update" && typeof message.payload?.isPaused === "boolean")
      set(!message.payload.isPaused);
  };
  window.addEventListener("message", onMessage);
  return () => {
    window.removeEventListener("message", onMessage);
    window.clearTimeout(silence);
    if (state.source === "spotify") publish({ source: "none", playing: false });
  };
}

/** The site's own player: playing between its audio's `playing` and `pause` / `ended` / `error`. */
export function observeAudioPlayback(audio: HTMLAudioElement) {
  const playing = () => publish({ source: "custom", playing: true });
  const stopped = () => publish({ source: "custom", playing: false });
  audio.addEventListener("playing", playing);
  audio.addEventListener("pause", stopped);
  audio.addEventListener("ended", stopped);
  audio.addEventListener("error", stopped);
  return {
    dispose: () => {
      audio.removeEventListener("playing", playing);
      audio.removeEventListener("pause", stopped);
      audio.removeEventListener("ended", stopped);
      audio.removeEventListener("error", stopped);
      if (state.source === "custom") publish({ source: "none", playing: false });
    }
  };
}
