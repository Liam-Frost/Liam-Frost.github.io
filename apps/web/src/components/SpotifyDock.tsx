import { useEffect, useState, type FocusEvent } from "react";

import { SpotifyCard } from "./spotify-card";

type SpotifyDockProps = {
  tracks?: ReadonlyArray<SpotifyTrack>;
};

type SpotifyTrack = {
  url: string;
  title: string;
  artist: string;
  image: string;
  link: string;
  audio?: string;
};

export default function SpotifyDock({ tracks = [] }: SpotifyDockProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  const [hasAutoCollapsed, setHasAutoCollapsed] = useState(false);
  const [isPlaybackActive, setIsPlaybackActive] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeTrack = tracks[activeIndex % tracks.length];

  useEffect(() => {
    if (!tracks.length || hasAutoCollapsed || isHovering || isPlaybackActive || !isExpanded) {
      return;
    }

    const collapseTimer = window.setTimeout(() => {
      setIsExpanded(false);
      setHasAutoCollapsed(true);
    }, 3000);

    return () => window.clearTimeout(collapseTimer);
  }, [tracks.length, hasAutoCollapsed, isExpanded, isHovering, isPlaybackActive]);

  useEffect(() => {
    if (tracks.length <= 1 || isPlaybackActive) {
      return;
    }

    const autoplayTimer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % tracks.length);
    }, 2000);

    return () => window.clearInterval(autoplayTimer);
  }, [tracks.length, isPlaybackActive]);

  if (!activeTrack) {
    return null;
  }

  const expand = () => {
    setIsHovering(true);
    setIsExpanded(true);
  };

  const collapse = () => {
    if (isPlaybackActive) {
      return;
    }

    setIsHovering(false);
    setHasAutoCollapsed(true);
    setIsExpanded(false);
  };

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    collapse();
  };

  return (
    <aside
      className={`spotifyDock ${isExpanded ? "isExpanded" : "isCollapsed"}`}
      aria-label="Spotify tracks"
      onFocus={expand}
      onBlur={handleBlur}
      onMouseEnter={expand}
      onMouseLeave={collapse}
    >
      <div className="spotifyDockPanel">
        <SpotifyCard
          key={activeTrack.url}
          url={activeTrack.url}
          data={activeTrack}
          onPlaybackChange={setIsPlaybackActive}
        />
      </div>

      <button
        className="spotifyDockClose"
        type="button"
        aria-label={isPlaybackActive ? "Pause preview before hiding Spotify player" : "Hide Spotify player"}
        disabled={isPlaybackActive}
        onClick={collapse}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M4.2 4.2 8 8m0 0 3.8 3.8M8 8l3.8-3.8M8 8l-3.8 3.8" />
        </svg>
      </button>

      <button
        className="spotifyDockButton"
        type="button"
        aria-label="Show Spotify player"
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
