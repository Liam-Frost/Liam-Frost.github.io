/** A read-only tap on the existing player. It never reroutes or duplicates audible output. */
type CapturableAudio = HTMLAudioElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
};
type State = {
  source: "none" | "custom" | "spotify";
  playback: "playing" | "paused" | "stopped" | "unknown";
  playing: boolean;
  analyser: AnalyserNode | null;
};
let state: State = { source: "none", playback: "stopped", playing: false, analyser: null };
const subscribers = new Set<() => void>();
const publish = (next: State) => {
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

/** A plain Spotify iframe provides no reliable playback state. */
export function observeSpotifyEmbed() {
  publish({ source: "spotify", playback: "unknown", playing: false, analyser: null });
  return () => {
    if (state.source === "spotify")
      publish({ source: "none", playback: "stopped", playing: false, analyser: null });
  };
}

/** Call from the player's user gesture. captureStream may be absent or CORS-restricted. */
export function createAudioTap(audio: HTMLAudioElement) {
  let context: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let analyser: AnalyserNode | null = null;
  let stream: MediaStream | null = null;
  let disposed = false;
  const captured = audio as CapturableAudio;
  const capture = captured.captureStream ?? captured.mozCaptureStream;
  try {
    if (capture && typeof AudioContext !== "undefined") {
      context = new AudioContext();
      void context.resume().catch(() => {});
    }
  } catch {
    context = null;
  }
  const detach = () => {
    source?.disconnect();
    analyser?.disconnect();
    stream?.getTracks().forEach((track) => track.stop());
    source = null;
    analyser = null;
    stream = null;
  };
  const playing = () => {
    if (disposed) return;
    void context?.resume().catch(() => {});
    detach();
    try {
      if (context && capture) {
        stream = capture.call(audio);
        source = context.createMediaStreamSource(stream);
        analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.65;
        source.connect(analyser);
      }
    } catch {
      detach();
    }
    publish({ source: "custom", playback: "playing", playing: true, analyser });
  };
  const pause = () => {
    publish({ source: "custom", playback: "paused", playing: false, analyser });
    void context?.suspend().catch(() => {});
  };
  audio.addEventListener("playing", playing);
  audio.addEventListener("pause", pause);
  audio.addEventListener("ended", pause);
  audio.addEventListener("error", pause);
  return {
    resume: () => void context?.resume().catch(() => {}),
    dispose: () => {
      disposed = true;
      audio.removeEventListener("playing", playing);
      audio.removeEventListener("pause", pause);
      audio.removeEventListener("ended", pause);
      audio.removeEventListener("error", pause);
      detach();
      void context?.close().catch(() => {});
      publish({ source: "none", playback: "stopped", playing: false, analyser: null });
    }
  };
}
