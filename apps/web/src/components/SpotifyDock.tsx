import type { PublicSpotifyPlayer } from "@liam-frost/shared";
import { useCallback, useEffect, useRef, useState, type FocusEvent } from "react";

import { useSpotifyPlayer } from "../data/useSpotifyPlayer";
import { SpotifyCard } from "./spotify-card";

/** Previews that fail to load are skipped; after this many in a row, playback stops. */
const MAX_FAILED_IN_A_ROW = 3;
/** "Previous" restarts the current track once it has played this long. */
const RESTART_AFTER_SECONDS = 3;

function playOrder(count: number, shuffle: boolean, avoidFirst?: number) {
  const order = Array.from({ length: count }, (_, i) => i);
  if (!shuffle) return order;
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  // A new round should not start with the track that just ended.
  if (count > 1 && order[0] === avoidFirst) [order[0], order[1]] = [order[1], order[0]];
  return order;
}

export default function SpotifyDock() {
  const player = useSpotifyPlayer();
  return player ? <Dock player={player} /> : null;
}

function Dock({ player }: { player: PublicSpotifyPlayer }) {
  const { tracks, shuffle } = player;
  const [order, setOrder] = useState(() => playOrder(tracks.length, shuffle));
  const [position, setPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  const [hasAutoCollapsed, setHasAutoCollapsed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const failuresRef = useRef(0);

  const track = tracks[order[position]] ?? tracks[0];

  const next = useCallback(() => {
    if (position + 1 < order.length) {
      setPosition(position + 1);
    } else {
      // Loop: start another round (reshuffled when shuffling).
      setOrder(playOrder(tracks.length, shuffle, order[position]));
      setPosition(0);
    }
  }, [order, position, shuffle, tracks.length]);

  const previous = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > RESTART_AFTER_SECONDS) {
      audio.currentTime = 0;
      return;
    }
    setPosition((position - 1 + order.length) % order.length);
  }, [order.length, position]);

  // Audio event handlers outlive renders; route them through a ref to the latest callbacks.
  const handlers = useRef({ next, previous });
  handlers.current = { next, previous };

  const ensureAudio = () => {
    if (audioRef.current) return audioRef.current;
    const audio = new Audio();
    audio.preload = "none";
    audio.volume = player.volume / 100;
    // With one track there is nothing to advance to; let the browser repeat it.
    audio.loop = tracks.length === 1;
    audio.addEventListener("ended", () => handlers.current.next());
    audio.addEventListener("playing", () => {
      failuresRef.current = 0;
    });
    audio.addEventListener("error", () => {
      failuresRef.current += 1;
      if (failuresRef.current >= MAX_FAILED_IN_A_ROW) setIsPlaying(false);
      else handlers.current.next();
    });
    // Keep state in sync with pauses from outside the card (headphones, OS media controls).
    audio.addEventListener("pause", () => {
      if (!audio.ended) setIsPlaying(false);
    });
    audio.addEventListener("play", () => setIsPlaying(true));
    audioRef.current = audio;
    return audio;
  };

  const play = (audio: HTMLAudioElement) => {
    if (audio.src !== track.previewUrl) audio.src = track.previewUrl;
    audio.play().catch((error: unknown) => {
      // Only the autoplay policy stops playback here. Interrupted plays (a newer src, pause()) are
      // expected, and broken previews are skipped by the "error" listener.
      if (error instanceof DOMException && error.name === "NotAllowedError") setIsPlaying(false);
    });
  };

  const togglePlay = () => {
    const audio = ensureAudio();
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      // Started inside the click handler so browsers count it as user-initiated playback.
      failuresRef.current = 0;
      play(audio);
      setIsPlaying(true);
    }
  };

  // Moving to another track while playing keeps playing.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isPlaying || audio.src === track.previewUrl) return;
    play(audio);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a track change should restart playback
  }, [track.previewUrl]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.setActionHandler("nexttrack", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
      }
    },
    []
  );

  // Lock-screen and media-key controls.
  useEffect(() => {
    if (!("mediaSession" in navigator) || !audioRef.current) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      artwork: track.image ? [{ src: track.image }] : []
    });
    navigator.mediaSession.setActionHandler("nexttrack", () => handlers.current.next());
    navigator.mediaSession.setActionHandler("previoustrack", () => handlers.current.previous());
  }, [track, isPlaying]);

  useEffect(() => {
    const delay = player.autoCollapseSeconds;
    if (!delay || hasAutoCollapsed || isHovering || isPlaying || !isExpanded) return;
    const timer = window.setTimeout(() => {
      setIsExpanded(false);
      setHasAutoCollapsed(true);
    }, delay * 1000);
    return () => window.clearTimeout(timer);
  }, [player.autoCollapseSeconds, hasAutoCollapsed, isExpanded, isHovering, isPlaying]);

  const expand = () => {
    setIsHovering(true);
    setIsExpanded(true);
  };

  const collapse = () => {
    setIsHovering(false);
    setHasAutoCollapsed(true);
    setIsExpanded(false);
  };

  // Moving the pointer away keeps a playing card open; the close button always collapses (music continues).
  const collapseUnlessPlaying = () => {
    if (isPlaying) {
      setIsHovering(false);
      return;
    }
    collapse();
  };

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
      return;
    }
    collapseUnlessPlaying();
  };

  const canSkip = tracks.length > 1;

  return (
    <aside
      className={`spotifyDock ${isExpanded ? "isExpanded" : "isCollapsed"} ${isPlaying ? "isPlaying" : ""}`}
      aria-label="Spotify player"
      onFocus={expand}
      onBlur={handleBlur}
      onMouseEnter={expand}
      onMouseLeave={collapseUnlessPlaying}
    >
      <div className="spotifyDockPanel">
        <SpotifyCard
          track={track}
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          onPrevious={canSkip ? previous : undefined}
          onNext={canSkip ? next : undefined}
        />
      </div>

      <button className="spotifyDockClose" type="button" aria-label="Hide Spotify player" onClick={collapse}>
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M4.2 4.2 8 8m0 0 3.8 3.8M8 8l3.8-3.8M8 8l-3.8 3.8" />
        </svg>
      </button>

      <button
        className="spotifyDockButton"
        type="button"
        aria-label={isPlaying ? `Show Spotify player (playing ${track.title})` : "Show Spotify player"}
        onClick={expand}
      >
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <circle cx="32" cy="32" r="31" fill="currentColor" />
          <path
            d="M46.8 27.7c-8.1-4.8-21.1-5.2-28.7-2.9a2.3 2.3 0 0 1-1.4-4.4c8.8-2.7 23.2-2.2 32.5 3.3a2.3 2.3 0 0 1-2.4 4Zm-2.7 7.1c-6.8-4.1-17.2-5.3-25.2-2.9a2 2 0 0 1-1.2-3.8c9.2-2.8 20.7-1.5 28.5 3.2a2 2 0 0 1-2.1 3.5Zm-2.4 6.8c-5.9-3.5-13.2-4.3-21.8-2.3a1.7 1.7 0 0 1-.8-3.3c9.5-2.2 17.6-1.3 24.4 2.7a1.7 1.7 0 0 1-1.8 2.9Z"
            fill="#0b1410"
          />
        </svg>
      </button>
    </aside>
  );
}
