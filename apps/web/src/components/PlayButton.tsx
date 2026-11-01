import type { PublicMediaSummary } from "@liam-frost/shared";

import { sendPlayerCommand, useNowPlaying, type PlayRequest } from "../data/playerBus";
import { useSpotifyPlayer } from "../data/useSpotifyPlayer";
import { pickLocalized, useI18n } from "../lib/i18n";

/**
 * Plays a song in the corner player: its preview in the site's own player, or its Spotify page in
 * Spotify's player. Nothing is shown when the player is off or the song has nothing it could play.
 */
/** A song as the player wants it; the title in the visitor's language. */
export function playRequest(item: PublicMediaSummary, title: string): PlayRequest | null {
  const music = item.music;
  if (!music) return null;
  return {
    id: item.id,
    title,
    artist: item.credits.join(", "),
    image: item.poster?.variants[0].url ?? "",
    link: music.spotifyUrl ?? music.appleUrl ?? "",
    previewUrl: music.previewUrl ?? "",
    spotifyUrl: music.spotifyUrl
  };
}

/** Plays a list of songs (an album, an artist, a playlist) from the first; hidden when nothing could play. */
export function PlayAllButton({ items, spotifyUrl = null }: { items: PublicMediaSummary[]; spotifyUrl?: string | null }) {
  const { lang, t } = useI18n();
  const player = useSpotifyPlayer();
  if (!player) return null;
  const tracks = items
    .map((item) => playRequest(item, pickLocalized(item.title, lang) || item.originalTitle || ""))
    .filter((track): track is PlayRequest => track !== null);
  const playable = player.mode === "embed" ? spotifyUrl || tracks.some((track) => track.spotifyUrl) : tracks.some((track) => track.previewUrl);
  if (!playable) return null;
  return (
    <button type="button" className="btn btnPrimary btnSmall" onClick={() => sendPlayerCommand({ type: "queue", tracks, spotifyUrl })}>
      {t("collection.playAll")}
    </button>
  );
}

export default function PlayButton({ item, className = "" }: { item: PublicMediaSummary; className?: string }) {
  const { lang, t } = useI18n();
  const player = useSpotifyPlayer();
  const now = useNowPlaying();
  const music = item.music;
  if (!player || !music) return null;
  const embed = player.mode === "embed";
  if (embed ? !music.spotifyUrl : !music.previewUrl) return null;

  const title = pickLocalized(item.title, lang) || item.originalTitle || "";
  const playing = !embed && now.playing && now.trackId === item.id;
  const onClick = () => {
    if (playing) {
      sendPlayerCommand({ type: "pause" });
      return;
    }
    sendPlayerCommand({ type: "play", track: playRequest(item, title)! });
  };

  return (
    <button
      type="button"
      className={["playButton", playing ? "isPlaying" : "", className].filter(Boolean).join(" ")}
      aria-label={t(playing ? "collection.pause" : "collection.play", { title })}
      aria-pressed={playing}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {playing ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /> : <path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2Z" />}
      </svg>
    </button>
  );
}
