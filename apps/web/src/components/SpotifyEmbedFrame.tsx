import { useEffect, useRef, useState } from "react";
import { observeSpotifyEmbed, setSpotifyPlayback } from "../data/audio-visualization";
import { trustedSpotifyMessage } from "../data/spotify-bridge";

/** Spotify's API runs in an opaque sandbox; only authenticated playback-state messages leave it. */
export function SpotifyEmbedFrame({ src }: { src: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    const disposeState = observeSpotifyEmbed();
    const container = host.current;
    if (!container) return disposeState;
    let cancelled = false;
    let watchdog = 0;
    let timeout = 0;
    let ready = false;
    setFallback(false);
    const bytes = new Uint8Array(16);
    try {
      crypto.getRandomValues(bytes);
    } catch {
      setFallback(true);
      return disposeState;
    }
    const token = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
    const iframe = document.createElement("iframe");
    iframe.title = "Spotify";
    iframe.width = "100%";
    iframe.height = "152";
    iframe.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
    );
    iframe.setAttribute(
      "allow",
      "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
    );
    iframe.src = new URL("spotify-bridge.html?v=2", document.baseURI).href;
    const unknown = () => {
      container.dataset.playback = "unknown";
      setSpotifyPlayback("unknown");
    };
    const armWatchdog = () => {
      clearTimeout(watchdog);
      watchdog = window.setTimeout(unknown, 60000);
    };
    const message = (event: MessageEvent) => {
      if (cancelled || !trustedSpotifyMessage(event, iframe.contentWindow, token)) return;
      const data = event.data;
      if (!data || data.channel !== "lf-spotify-bridge") return;
      if (data.type === "hello") {
        container.dataset.bridge = "hello";
        initialize();
        return;
      }
      if (data.token !== token) return;
      if (data.type === "ready") {
        container.dataset.bridge = "ready";
        ready = true;
        clearTimeout(timeout);
        return;
      }
      if (data.type === "error") {
        fail();
        return;
      }
      if (!ready) return;
      if (data.type === "started") {
        container.dataset.playback = "playing";
        setSpotifyPlayback("playing");
        armWatchdog();
        return;
      }
      if (data.type !== "update" || typeof data.data?.isPaused !== "boolean") return;
      const playing = !data.data.isPaused && data.data.isBuffering !== true;
      container.dataset.playback = playing ? "playing" : "paused";
      setSpotifyPlayback(playing ? "playing" : "paused");
      clearTimeout(watchdog);
      if (playing) armWatchdog();
    };
    const fail = () => {
      if (cancelled) return;
      clearTimeout(timeout);
      clearTimeout(watchdog);
      window.removeEventListener("message", message);
      unknown();
      setFallback(true);
      container.dataset.bridge = "fallback";
    };
    const initialize = () => {
      const url = src.replace("https://open.spotify.com/embed/", "https://open.spotify.com/");
      iframe.contentWindow?.postMessage({ channel: "lf-spotify-bridge-init", token, url }, "*");
    };
    iframe.onload = initialize;
    window.addEventListener("message", message);
    container.replaceChildren(iframe);
    timeout = window.setTimeout(fail, 15000);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      clearTimeout(watchdog);
      window.removeEventListener("message", message);
      iframe.onload = null;
      container.replaceChildren();
      disposeState();
    };
  }, [src]);
  return (
    <>
      <div ref={host} hidden={fallback} />
      {fallback && (
        <iframe
          title="Spotify"
          src={src}
          width="100%"
          height="152"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      )}
    </>
  );
}
