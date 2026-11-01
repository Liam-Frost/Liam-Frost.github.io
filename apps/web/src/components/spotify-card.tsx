import type { SpotifyTrack } from "@liam-frost/shared";
import { SiSpotify } from "@icons-pack/react-simple-icons";

import { cn } from "../lib/cn";

interface SpotifyCardProps {
  track: SpotifyTrack;
  isPlaying: boolean;
  onTogglePlay: () => void;
  /** Omitted for single-track lists. */
  onPrevious?: () => void;
  onNext?: () => void;
  className?: string;
}

/** Presentational card; playback lives in SpotifyDock so it continues across tracks. */
export function SpotifyCard({
  track,
  isPlaying,
  onTogglePlay,
  onPrevious,
  onNext,
  className
}: SpotifyCardProps) {
  return (
    <div className={cn("spotifyCard", className)}>
      {track.image ? (
        <div className="spotifyCardBackdrop" aria-hidden="true">
          <img src={track.image} alt="" />
          <div className="spotifyCardBackdropShade" />
        </div>
      ) : null}

      <button
        onClick={onTogglePlay}
        className={cn("spotifyCardCoverButton", "hasAudio", isPlaying && "isPlaying")}
        type="button"
        aria-label={isPlaying ? "Pause Spotify preview" : "Play Spotify preview"}
      >
        {track.image ? (
          <img src={track.image} alt={track.title} className="spotifyCardCover" />
        ) : null}
        <div className={cn("spotifyCardDisc", isPlaying && "isPlaying")}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 110">
            <circle cx="55" cy="55" r="55" fill="#000" />
            <circle cx="55" cy="55" r="51.5" stroke="#fff" strokeOpacity="0.21" />
            <circle cx="55" cy="55" r="47.5" stroke="#fff" strokeOpacity="0.21" />
            <circle cx="55" cy="55" r="43.5" stroke="#fff" strokeOpacity="0.21" />
          </svg>
        </div>
      </button>

      <div className="spotifyCardContent">
        <div className="spotifyCardIconRow">
          {onPrevious ? (
            <button
              type="button"
              className="spotifyCardSkip"
              onClick={onPrevious}
              aria-label="Previous track"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M3.5 3v10M13 3.6v8.8a.6.6 0 0 1-.92.5L5.6 8.5a.6.6 0 0 1 0-1l6.48-4.4a.6.6 0 0 1 .92.5Z" />
              </svg>
            </button>
          ) : null}
          {onNext ? (
            <button
              type="button"
              className="spotifyCardSkip"
              onClick={onNext}
              aria-label="Next track"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M12.5 3v10M3 3.6v8.8a.6.6 0 0 0 .92.5l6.48-4.4a.6.6 0 0 0 0-1L3.92 3.1a.6.6 0 0 0-.92.5Z" />
              </svg>
            </button>
          ) : null}
          <a
            href={track.link}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open on Spotify"
          >
            <SiSpotify size={18} className="spotifyCardIcon" />
          </a>
        </div>

        <div className="spotifyCardText">
          <h2>{track.title}</h2>
          <p>{track.artist}</p>
        </div>
      </div>
    </div>
  );
}
