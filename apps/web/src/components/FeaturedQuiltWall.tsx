import LoadingImage from "./LoadingImage";
import {
  resolveFeaturedWall,
  type FeaturedWallSettings,
  type PublicMediaSummary
} from "@liam-frost/shared";
import { ArrowUpRight, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import { sendPlayerCommand, useNowPlaying } from "../data/playerBus";
import { useSpotifyPlayer } from "../data/useSpotifyPlayer";
import { justifiedLayout, validCoverRatio } from "../lib/justified-layout";
import { useI18n, type Key } from "../lib/i18n";
import { mediaTitle } from "./MediaCard";
import { playRequest } from "./PlayButton";
import "../styles/featured-wall.css";

type Cover = { src: string | null; ratio: number; known: boolean; unavailable: boolean };
const measured = new Map<string, number | null>();
function remember(src: string, ratio: number | null) {
  if (measured.size >= 1024) measured.delete(measured.keys().next().value!);
  measured.set(src, ratio);
}

/** Choose a cached generated size; use that exact file's dimensions to avoid rounded-srcset seams. */
function coverOf(
  item: PublicMediaSummary,
  target: number,
  cache: ReadonlyMap<string, number | null>
): Cover {
  const fallback = item.kind === "track" || item.kind === "album" ? 1 : 2 / 3;
  const poster = item.poster;
  if (!poster) return { src: null, ratio: fallback, known: true, unavailable: true };
  const ratio = validCoverRatio(poster.width, poster.height) ?? fallback;
  const variants = poster.variants
    .filter((v) => validCoverRatio(v.width, v.height) !== null)
    .sort((a, b) => a.width - b.width);
  const variant =
    variants.find((v) => v.width >= target * ratio * 2) ?? variants[variants.length - 1];
  const src = variant?.url ?? poster.src;
  const intrinsic = variant
    ? validCoverRatio(variant.width, variant.height)
    : validCoverRatio(poster.width, poster.height);
  if (cache.has(src))
    return {
      src,
      ratio: cache.get(src) ?? intrinsic ?? fallback,
      known: true,
      unavailable: cache.get(src) === null
    };
  return { src, ratio: intrinsic ?? fallback, known: intrinsic !== null, unavailable: false };
}

export default function FeaturedQuiltWall({
  items,
  settings: rawSettings,
  onVisibleItems
}: {
  items: PublicMediaSummary[];
  settings?: FeaturedWallSettings;
  onVisibleItems?: (ids: string[]) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [measurement, setMeasurement] = useState(() => new Map(measured));
  const settings = useMemo(() => resolveFeaturedWall(rawSettings), [rawSettings]);
  const covers = useMemo(
    () => items.map((item) => coverOf(item, settings.targetRowHeight, measurement)),
    [items, settings.targetRowHeight, measurement]
  );
  const layout = useMemo(
    () =>
      justifiedLayout(
        covers.map((cover) => cover.ratio),
        width,
        settings
      ),
    [covers, width, settings]
  );
  const probing = useRef(false);
  const lateMeasureTimer = useRef(0);
  const reportDimensions = useCallback(
    (src: string, naturalWidth: number, naturalHeight: number) => {
      const ratio = validCoverRatio(naturalWidth, naturalHeight);
      const old = measured.get(src);
      if (measured.has(src) && old === ratio) return;
      remember(src, ratio);
      // Slow legacy images can finish after the initial probe deadline; coalesce their corrections.
      clearTimeout(lateMeasureTimer.current);
      lateMeasureTimer.current = window.setTimeout(() => {
        if (!probing.current) setMeasurement(new Map(measured));
      }, 100);
    },
    []
  );
  useEffect(() => () => clearTimeout(lateMeasureTimer.current), []);

  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    let frame = 0;
    const measure = () => {
      const next = element.getBoundingClientRect().width;
      setWidth((old) => (Math.abs(old - next) < 0.05 ? old : next));
    };
    measure();
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  // Only legacy/missing dimensions need probing. Publish one batched correction, not one per cover.
  const unknown = covers
    .slice(0, layout.visibleCount)
    .filter((cover) => !cover.known && cover.src)
    .map((cover) => cover.src!);
  const unknownKey = unknown.join("\n");
  useEffect(() => {
    if (!unknownKey) return;
    let alive = true;
    const cancel: (() => void)[] = [];
    probing.current = true;
    const probes = unknownKey.split("\n").map(
      (src) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          let done = false;
          const finish = (ratio: number | null, cache: boolean) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            image.onload = null;
            image.onerror = null;
            if (alive && cache) remember(src, ratio);
            resolve();
          };
          const timer = window.setTimeout(() => finish(null, false), 2000);
          image.onload = () =>
            finish(validCoverRatio(image.naturalWidth, image.naturalHeight), true);
          image.onerror = () => finish(null, true);
          cancel.push(() => {
            finish(null, false);
            image.removeAttribute("src");
          });
          image.src = src;
        })
    );
    void Promise.all(probes).then(() => {
      if (alive) {
        probing.current = false;
        setMeasurement(new Map(measured));
      }
    });
    return () => {
      alive = false;
      probing.current = false;
      cancel.forEach((stop) => stop());
    };
  }, [unknownKey]);

  const visibleKey = items
    .slice(0, layout.visibleCount)
    .map((item) => item.id)
    .join("\n");
  // Before paint, so the shelves below never flash covers that the wall already shows.
  useLayoutEffect(() => {
    if (width > 0) onVisibleItems?.(visibleKey ? visibleKey.split("\n") : []);
  }, [visibleKey, onVisibleItems, width]);
  const { t } = useI18n();
  return (
    <div ref={host} className="featuredWallHost">
      <div
        className="featuredWall"
        role="group"
        aria-label={t("collection.wall.label")}
        style={{ width: layout.width || "100%" }}
      >
        {layout.rows.map((row) => {
          const sum = row.ratios.reduce((total, ratio) => total + ratio, 0);
          return (
            <div
              className="featuredWallRow"
              key={items[row.start]!.id}
              style={{ height: row.height }}
            >
              {items.slice(row.start, row.end).map((item, index) => (
                <QuiltTile
                  key={item.id}
                  item={item}
                  cover={covers[row.start + index]!}
                  // Shares that add up to 1: with a total below 1, flexbox would leave the rest empty.
                  grow={row.ratios[index]! / sum}
                  onDimensions={reportDimensions}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuiltTile({
  item,
  cover,
  grow,
  onDimensions
}: {
  item: PublicMediaSummary;
  cover: Cover;
  grow: number;
  onDimensions: (src: string, width: number, height: number) => void;
}) {
  const { lang, t } = useI18n();
  const player = useSpotifyPlayer();
  const now = useNowPlaying();
  const [failed, setFailed] = useState<string | null>(null);
  const [selectedSpotify, setSelectedSpotify] = useState(false);
  const title = mediaTitle(item, lang);
  const music = item.kind === "track";
  const embed = player?.mode === "embed";
  const playable = Boolean(
    music && player && (embed ? item.music?.spotifyUrl : item.music?.previewUrl)
  );
  const playing = Boolean(playable && !embed && now.playing && now.trackId === item.id);
  const label = playable
    ? embed
      ? t("collection.wall.spotify", { title })
      : t(playing ? "collection.pause" : "collection.play", { title })
    : t("collection.open", { title });
  const unavailable = cover.unavailable || !cover.src || failed === cover.src;
  const className = `featuredWallTile${playing ? " isPlaying" : ""}${selectedSpotify && embed ? " isSelected" : ""}`;
  const content = (
    <>
      {unavailable ? (
        <span className="featuredWallMissing" role="img" aria-label={t("collection.wall.missing")}>
          <span aria-hidden="true">{title.slice(0, 1)}</span>
        </span>
      ) : (
        <LoadingImage
          src={cover.src!}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={(event) => {
            const image = event.currentTarget;
            if (
              !cover.known ||
              Math.abs(image.naturalWidth / image.naturalHeight / cover.ratio - 1) > 0.001
            )
              onDimensions(cover.src!, image.naturalWidth, image.naturalHeight);
          }}
          onError={() => {
            remember(cover.src!, null);
            setFailed(cover.src);
          }}
        />
      )}
      <span className="featuredWallShade" aria-hidden="true" />
      <span className="featuredWallInfo" aria-hidden="true">
        <small>
          {[t(`collection.kind.${item.kind}` as Key), item.year].filter(Boolean).join(" · ")}
        </small>
        <strong>{title}</strong>
        {selectedSpotify && embed ? <small>{t("collection.wall.spotifyHint")}</small> : null}
      </span>
      <span className="featuredWallAction" aria-hidden="true">
        {playable ? playing ? <Pause /> : <Play /> : <ArrowUpRight />}
      </span>
    </>
  );
  const style = { flexGrow: grow };
  return playable ? (
    <button
      type="button"
      className={className}
      data-media-id={item.id}
      style={style}
      aria-label={label}
      aria-pressed={playing || (Boolean(embed) && selectedSpotify)}
      onClick={() => {
        if (playing) sendPlayerCommand({ type: "pause" });
        else {
          const track = playRequest(item, title);
          if (track) sendPlayerCommand({ type: "play", track, player: embed ? "spotify" : "site" });
          if (embed) setSelectedSpotify(true);
        }
      }}
    >
      {content}
    </button>
  ) : (
    <Link
      className={className}
      data-media-id={item.id}
      style={style}
      to={`/collection?kind=${item.kind}&item=${item.id}`}
      aria-label={label}
    >
      {content}
    </Link>
  );
}
