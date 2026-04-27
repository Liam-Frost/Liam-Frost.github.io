import { useEffect, useRef, useState } from "react";
import { SiSpotify } from "@icons-pack/react-simple-icons";

import { cn } from "../lib/cn";

interface SpotifyData {
  title: string;
  artist: string;
  image: string;
  link: string;
  audio?: string;
}

interface SpotifyCardProps {
  url: string;
  className?: string;
  data?: SpotifyData;
  onPlaybackChange?: (isPlaying: boolean) => void;
}

const SpotifyCardSkeleton = ({ className }: { className?: string }) => (
  <div className={cn("spotifyCard spotifyCardSkeleton", className)}>
    <div className="spotifyCardSkeletonCover" />
    <div className="spotifyCardBody">
      <div className="spotifyCardSkeletonLine isLong" />
      <div className="spotifyCardSkeletonLine" />
    </div>
  </div>
);

const SpotifyCardError = ({ className }: { className?: string }) => (
  <div className={cn("spotifyCard spotifyCardError", className)}>
    <p>Failed to load Spotify data</p>
  </div>
);

export function SpotifyCard({ url, className, data: initialData, onPlaybackChange }: SpotifyCardProps) {
  const [data, setData] = useState<SpotifyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setIsLoading(false);
      setError(false);
      return;
    }

    const fetchSpotifyData = async () => {
      try {
        setIsLoading(true);
        setError(false);

        const response = await fetch(
          `/api/spotify?url=${encodeURIComponent(url)}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch Spotify metadata");
        }

        const spotifyData = (await response.json()) as SpotifyData;
        setData(spotifyData);
      } catch {
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSpotifyData();
  }, [initialData, url]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      onPlaybackChange?.(false);
    };
  }, [onPlaybackChange]);

  const handlePlayPause = () => {
    if (!data?.audio) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(data.audio);
      audioRef.current.volume = 0.3;
      audioRef.current.addEventListener("ended", () => {
        setIsPlaying(false);
        onPlaybackChange?.(false);
      });
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      onPlaybackChange?.(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
      onPlaybackChange?.(true);
    }
  };

  if (isLoading) {
    return <SpotifyCardSkeleton className={className} />;
  }

  if (error || !data) {
    return <SpotifyCardError className={className} />;
  }

  return (
    <div className={cn("spotifyCard", className)}>
      {data.image ? (
        <div className="spotifyCardBackdrop" aria-hidden="true">
          <img src={data.image} alt="" />
          <div className="spotifyCardBackdropShade" />
        </div>
      ) : null}

      {data.audio ? (
        <button
          onClick={handlePlayPause}
          className={cn("spotifyCardCoverButton", "hasAudio", isPlaying && "isPlaying")}
          type="button"
          aria-label={isPlaying ? "Pause Spotify preview" : "Play Spotify preview"}
        >
          {data.image ? <img src={data.image} alt={data.title} className="spotifyCardCover" /> : null}
          <div className={cn("spotifyCardDisc", isPlaying && "isPlaying")}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r="55" fill="#000" />
              <circle cx="55" cy="55" r="51.5" stroke="#fff" strokeOpacity="0.21" />
              <circle cx="55" cy="55" r="47.5" stroke="#fff" strokeOpacity="0.21" />
              <circle cx="55" cy="55" r="43.5" stroke="#fff" strokeOpacity="0.21" />
            </svg>
          </div>
        </button>
      ) : (
        <div className="spotifyCardCoverButton">
          {data.image ? <img src={data.image} alt={data.title} className="spotifyCardCover" /> : null}
        </div>
      )}

      <div className="spotifyCardContent">
        <div className="spotifyCardIconRow">
          <a href={data.link} target="_blank" rel="noopener noreferrer" aria-label="Open on Spotify">
            <SiSpotify size={18} className="spotifyCardIcon" />
          </a>
        </div>

        <div className="spotifyCardText">
          <h2>{data.title}</h2>
          <p>{data.artist}</p>
        </div>
      </div>
    </div>
  );
}
