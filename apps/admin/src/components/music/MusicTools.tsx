import type { AdminMediaItem, MusicImportJob, MusicImportRequest, MusicSearchResult } from "@liam-frost/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Music, Pause, Play, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { mediaKey, useSetMediaItem, useUpdateMedia } from "../../hooks/useMedia";
import { useSelection, type Selection } from "../../hooks/useSelection";
import { api, ApiError } from "../../lib/api";
import { formatDuration, MUSIC_STORES, pickText } from "../../lib/i18n";
import { MediaBatchActions } from "../collection/MediaBatchActions";
import { BatchBar, SelectMark } from "../ui/BatchBar";
import { Dialog } from "../ui/Dialog";
import { Field, Switch } from "../ui/Field";
import { useToast } from "../ui/Toast";

/** One shared <audio> for preview buttons: starting a preview stops the previous one. */
export function usePreview() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => () => audio.current?.pause(), []);

  const toggle = useCallback(
    (url: string) => {
      if (!audio.current) {
        audio.current = new Audio();
        audio.current.volume = 0.5;
        audio.current.addEventListener("ended", () => setPlaying(null));
        audio.current.addEventListener("pause", () => setPlaying((current) => (audio.current?.ended ? null : current)));
      }
      if (playing === url) {
        audio.current.pause();
        setPlaying(null);
        return;
      }
      audio.current.src = url;
      void audio.current.play().catch(() => setPlaying(null));
      setPlaying(url);
    },
    [playing]
  );

  return { playing, toggle };
}

export function PreviewButton({ url, preview }: { url: string | null; preview: ReturnType<typeof usePreview> }) {
  if (!url) return null;
  const active = preview.playing === url;
  return (
    <button
      type="button"
      onClick={() => preview.toggle(url)}
      aria-label={active ? "暂停试听" : "试听"}
      title={active ? "暂停试听" : "试听"}
      className={`flex size-8 shrink-0 items-center justify-center rounded-full transition-colors ${active ? "bg-brand text-white" : "bg-brand-secondary/12 text-brand hover:bg-brand-secondary/20"}`}
    >
      {active ? <Pause aria-hidden="true" className="size-3.5" /> : <Play aria-hidden="true" className="ml-0.5 size-3.5" />}
    </button>
  );
}

function Cover({ src, size = "size-10" }: { src: string | null | undefined; size?: string }) {
  return src ? (
    <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className={`${size} shrink-0 rounded-md bg-line-soft object-cover`} />
  ) : (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-md bg-line-soft text-faint`}>
      <Music aria-hidden="true" className="size-4" />
    </span>
  );
}

/**
 * iTunes song search. "add" adds results to the collection (the dialog stays open for more songs);
 * "preview" picks a result as the preview of an existing song.
 */
export function MusicSearchDialog({
  mode,
  initialQuery = "",
  onPick,
  onClose
}: {
  mode: "add" | "preview";
  initialQuery?: string;
  onPick?: (result: MusicSearchResult) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [country, setCountry] = useState("US");
  const [results, setResults] = useState<MusicSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState("");
  const setItem = useSetMediaItem();
  const preview = usePreview();
  const toast = useToast();

  const search = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    try {
      setResults((await api.searchMusic(query.trim(), country)).results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "搜索失败");
    } finally {
      setSearching(false);
    }
  };

  // Opened with a query (finding a preview for a song): search right away.
  useEffect(() => {
    if (initialQuery) void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open
  }, []);

  const add = async (result: MusicSearchResult) => {
    setAdding(result.itunesId);
    setError("");
    try {
      const { item } = await api.importMusic({ itunesId: result.itunesId, country });
      setItem(item);
      setResults((list) => list?.map((r) => (r.itunesId === result.itunesId ? { ...r, existingId: item.id } : r)) ?? null);
      toast(`已添加：${result.title}${item.inPlayer ? "" : "（没有试听，未加入播放器）"}`);
    } catch (e) {
      setError(e instanceof ApiError && e.code === "MEDIA_EXISTS" ? "这首歌已在收藏中" : e instanceof Error ? e.message : "添加失败");
    } finally {
      setAdding(null);
    }
  };

  return (
    <Dialog open title={mode === "add" ? "添加歌曲" : "选择试听"} onClose={onClose}>
      <form onSubmit={search} className="flex flex-wrap items-end gap-2">
        <Field label="商店" htmlFor="music-store">
          <select id="music-store" className="field" value={country} onChange={(e) => setCountry(e.target.value)}>
            {MUSIC_STORES.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="在 iTunes 搜索" htmlFor="music-query" className="min-w-0 flex-1">
          <input id="music-query" className="field" value={query} maxLength={100} placeholder="歌名和歌手" onChange={(e) => setQuery(e.target.value)} data-autofocus />
        </Field>
        <button type="submit" className="btn-primary" disabled={searching || !query.trim()}>
          <Search aria-hidden="true" className="size-4" />
          {searching ? "搜索中…" : "搜索"}
        </button>
      </form>
      <p className="mt-2 text-[11.5px] text-faint">日文歌在“日本”商店更容易找到，并显示日文歌名。</p>

      {error ? (
        <p role="alert" className="mt-3 text-[12.5px] text-status-error">
          {error}
        </p>
      ) : null}

      {results ? (
        results.length ? (
          <ul className="mt-4 divide-y divide-line-soft rounded-xl border border-line-soft">
            {results.map((result) => (
              <li key={result.itunesId} className="flex items-center gap-3 p-2.5">
                <Cover src={result.artworkUrl} size="size-12" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-brand-dark">{result.title}</p>
                  <p className="truncate text-[12px] text-subtle">
                    {[result.artist, result.album, result.year, formatDuration(result.durationMs)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <PreviewButton url={result.previewUrl} preview={preview} />
                {mode === "preview" ? (
                  <button type="button" className="btn-primary shrink-0" disabled={!result.previewUrl} onClick={() => onPick?.(result)}>
                    用这个
                  </button>
                ) : result.existingId ? (
                  <Link to={`/collection/${result.existingId}`} className="btn-secondary shrink-0">
                    已添加
                  </Link>
                ) : (
                  <button type="button" className="btn-primary shrink-0" disabled={adding !== null} onClick={() => void add(result)}>
                    {adding === result.itunesId ? "添加中…" : "添加"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[13px] text-muted">没有找到，换个关键词或商店试试。</p>
        )
      ) : null}
    </Dialog>
  );
}

/** Polls an import job until it ends, then refreshes the collection. */
function useImportJob(jobId: string | null) {
  const qc = useQueryClient();
  const { data: job } = useQuery({
    queryKey: ["admin", "music-job", jobId],
    queryFn: () => api.musicJob(jobId!).then((r) => r.job),
    enabled: jobId !== null,
    refetchInterval: (q) => (q.state.data?.state === "running" || !q.state.data ? 1000 : false)
  });
  useEffect(() => {
    if (job && job.state !== "running") void qc.invalidateQueries({ queryKey: mediaKey });
  }, [job, qc]);
  return { job, running: job?.state === "running" || (jobId !== null && !job) };
}

function JobProgress({ job }: { job: MusicImportJob }) {
  return (
    <div className="mt-4 space-y-2 rounded-xl border border-line-soft p-3 text-[13px]" role="status">
      <p className="font-semibold text-brand-dark">{job.playlistName ?? "读取中…"}</p>
      {job.total ? (
        <>
          <div className="h-2 overflow-hidden rounded-full bg-line-soft">
            <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${Math.round((job.processed / job.total) * 100)}%` }} />
          </div>
          <p className="text-muted">
            {job.processed} / {job.total} · 新增 {job.added} · 已有 {job.skipped}
            {job.noPreview ? ` · 没有试听 ${job.noPreview}` : ""}
          </p>
        </>
      ) : null}
      {job.state === "done" ? <p className="text-status-ok">导入完成。没有试听的歌不会加入播放器，可以在列表里为它们找试听。</p> : null}
      {job.state === "failed" ? <p className="text-status-error">导入失败：{job.error}</p> : null}
    </div>
  );
}

/** Imports a public Spotify playlist on the server and shows its progress. */
export function PlaylistImportDialog({ onClose }: { onClose: () => void }) {
  const [link, setLink] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const { job, running } = useImportJob(jobId);

  const start = async (event: FormEvent) => {
    event.preventDefault();
    setStarting(true);
    setError("");
    try {
      setJobId((await api.startPlaylistImport(link.trim())).job.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法开始导入");
    } finally {
      setStarting(false);
    }
  };

  return (
    <Dialog open size="sm" title="导入 Spotify 歌单" onClose={onClose}>
      <form onSubmit={start} className="space-y-3">
        <Field label="歌单链接" htmlFor="playlist-link" hint="公开歌单的分享链接。每首歌带 30 秒试听；已在收藏里的歌会跳过，所以可以重复导入同一个歌单来补充新歌。">
          <input
            id="playlist-link"
            className="field"
            value={link}
            maxLength={500}
            placeholder="https://open.spotify.com/playlist/…"
            disabled={running}
            onChange={(e) => setLink(e.target.value)}
            data-autofocus
          />
        </Field>
        <button type="submit" className="btn-primary" disabled={!link.trim() || starting || running}>
          {running ? "导入中…" : "开始导入"}
        </button>
      </form>

      {error ? (
        <p role="alert" className="mt-3 text-[12.5px] text-status-error">
          {error}
        </p>
      ) : null}
      {job ? <JobProgress job={job} /> : null}
    </Dialog>
  );
}

/** The admin's Spotify account: connect, then import Liked Songs or one of their playlists. */
export function SpotifyAccountDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: status, isPending } = useQuery({ queryKey: ["admin", "spotify-account"], queryFn: api.spotifyAccount });
  const connected = Boolean(status?.account);
  const { data: playlists, error: playlistsError } = useQuery({ queryKey: ["admin", "spotify-playlists"], queryFn: () => api.spotifyPlaylists().then((r) => r.playlists), enabled: connected });
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { job, running } = useImportJob(jobId);

  const connect = async () => {
    setError("");
    try {
      // Spotify sends the browser back to this page, which reports the result.
      const returnTo = new URL(window.location.href);
      returnTo.searchParams.delete("spotify");
      returnTo.searchParams.delete("reason");
      window.location.assign((await api.connectSpotify(returnTo.toString())).url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法连接");
    }
  };

  const disconnect = async () => {
    await api.disconnectSpotify();
    await qc.invalidateQueries({ queryKey: ["admin", "spotify-account"] });
    toast("已断开 Spotify");
  };

  const importFrom = async (request: MusicImportRequest) => {
    setError("");
    try {
      setJobId((await api.startSpotifyImport(request)).job.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法开始导入");
    }
  };

  return (
    <Dialog open title="Spotify 账号" onClose={onClose}>
      {isPending ? <p className="text-[13px] text-subtle">加载中…</p> : null}
      {status && !status.configured ? (
        <p className="text-[13px] leading-relaxed text-muted">
          还没有配置 Spotify 应用。在 <code className="chip">apps/api/.env</code> 中设置 <code className="chip">SPOTIFY_CLIENT_ID</code> 和{" "}
          <code className="chip">SPOTIFY_CLIENT_SECRET</code> 后重启 API。
        </p>
      ) : null}
      {status?.configured && !status.account ? (
        <div className="space-y-3 text-[13px] text-muted">
          <p>连接你的 Spotify 账号后，可以导入“已点赞的歌曲”和你的歌单（只读权限）。</p>
          <p className="text-[12px] text-faint">Spotify 应用里登记的 Redirect URI 必须是：{status.redirectUri}</p>
          <button type="button" className="btn-primary" onClick={() => void connect()}>
            连接 Spotify
          </button>
        </div>
      ) : null}
      {status?.account ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-[13px]">
            <span className="text-muted">
              已连接：<span className="font-semibold text-brand-dark">{status.account.displayName}</span>
            </span>
            <button type="button" className="btn-secondary" onClick={() => void disconnect()} disabled={running}>
              断开
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line-soft p-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-brand-dark">已点赞的歌曲</p>
              <p className="text-[12px] text-subtle">试听优先用 Spotify 的，没有时到 iTunes 找同一首歌；歌多时需要几分钟。</p>
            </div>
            <button type="button" className="btn-primary" disabled={running} onClick={() => void importFrom({ source: "liked" })}>
              导入
            </button>
          </div>
          <div>
            <p className="mb-2 text-[12.5px] font-medium text-brand-dark">我的歌单</p>
            {playlistsError ? <p className="text-[12.5px] text-status-error">{playlistsError.message}</p> : null}
            {playlists?.length ? (
              <ul className="max-h-72 divide-y divide-line-soft overflow-y-auto rounded-xl border border-line-soft">
                {playlists.map((playlist) => (
                  <li key={playlist.id} className="flex items-center gap-3 p-2.5">
                    <Cover src={playlist.image} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-brand-dark">{playlist.name}</p>
                      <p className="truncate text-[12px] text-subtle">
                        {playlist.tracks} 首 · {playlist.owner}
                      </p>
                    </div>
                    <button type="button" className="btn-secondary shrink-0" disabled={running} onClick={() => void importFrom({ source: "playlist", playlistId: playlist.id })}>
                      导入
                    </button>
                  </li>
                ))}
              </ul>
            ) : playlists ? (
              <p className="text-[12.5px] text-subtle">没有歌单。</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-[12.5px] text-status-error">
          {error}
        </p>
      ) : null}
      {job ? <JobProgress job={job} /> : null}
    </Dialog>
  );
}

type MusicFilter = "all" | "player" | "notPlayer" | "noPreview";

/** The collection's songs: preview, player switch and a preview search for songs without one. */
export function MusicList({ items }: { items: AdminMediaItem[] }) {
  const [filter, setFilter] = useState<MusicFilter>("all");
  const [needle, setNeedle] = useState("");
  const [fixing, setFixing] = useState<AdminMediaItem | null>(null);
  const preview = usePreview();

  const counts = {
    all: items.length,
    player: items.filter((i) => i.inPlayer).length,
    notPlayer: items.filter((i) => !i.inPlayer).length,
    noPreview: items.filter((i) => !i.music?.previewUrl).length
  };
  const q = needle.trim().toLowerCase();
  const visible = items.filter(
    (item) =>
      (filter === "all" || (filter === "player" ? item.inPlayer : filter === "notPlayer" ? !item.inPlayer : !item.music?.previewUrl)) &&
      (!q || [pickText(item.title), ...item.credits, item.music?.album ?? ""].some((text) => text.toLowerCase().includes(q)))
  );
  const labels: Record<MusicFilter, string> = { all: "全部", player: "在播放器中", notPlayer: "不在播放器中", noPreview: "没有试听" };
  const order = useMemo(() => visible.map((item) => item.id), [visible]);
  const selection = useSelection(order);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {(Object.keys(labels) as MusicFilter[]).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`chip ${filter === f ? "border-brand bg-brand/10 text-brand" : ""}`}>
            {labels[f]} {counts[f]}
          </button>
        ))}
        <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-60">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
            <input className="field pl-9" placeholder="筛选歌名、歌手、专辑" aria-label="筛选歌曲" value={needle} onChange={(e) => setNeedle(e.target.value)} />
          </div>
          {visible.length && !selection.active ? (
            <button type="button" className="btn-secondary shrink-0" onClick={selection.start}>
              选择
            </button>
          ) : null}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="card p-10 text-center text-[13.5px] text-muted">{items.length ? "没有符合条件的歌曲" : "还没有歌曲，点击“添加歌曲”或“导入 Spotify 歌单”开始"}</div>
      ) : (
        <ul className="card divide-y divide-line-soft">
          {visible.map((item) => (
            <MusicRow key={item.id} item={item} preview={preview} onFix={() => setFixing(item)} selection={selection} />
          ))}
        </ul>
      )}

      <BatchBar selection={selection} total={visible.length}>
        <MediaBatchActions kind="track" selection={selection} />
      </BatchBar>

      {fixing ? <FixPreviewDialog item={fixing} onClose={() => setFixing(null)} /> : null}
    </>
  );
}

function MusicRow({ item, preview, onFix, selection }: { item: AdminMediaItem; preview: ReturnType<typeof usePreview>; onFix: () => void; selection: Selection }) {
  const update = useUpdateMedia(item.id);
  const toast = useToast();
  const title = pickText(item.title, "未命名");
  const previewUrl = item.music?.previewUrl ?? null;
  const selected = selection.isSelected(item.id);

  return (
    <li className={`flex items-center gap-3 px-3 py-2.5 ${selected ? "bg-brand/6" : ""}`}>
      {selection.active ? (
        <button type="button" aria-pressed={selected} aria-label={`选择 ${title}`} className="rounded-md p-0.5" onClick={(e) => selection.toggle(item.id, e.shiftKey)}>
          <SelectMark checked={selected} />
        </button>
      ) : null}
      <Cover src={item.poster?.variants[0].url} />
      <div className="min-w-0 flex-1">
        <Link to={`/collection/${item.id}`} className="block truncate text-[13.5px] font-semibold text-brand-dark hover:text-brand">
          {title}
        </Link>
        <p className="truncate text-[12px] text-subtle">{[item.credits.join(", "), item.music?.album].filter(Boolean).join(" · ")}</p>
      </div>
      {item.visibility === "private" ? <span className="chip">隐藏</span> : null}
      {previewUrl ? (
        <PreviewButton url={previewUrl} preview={preview} />
      ) : (
        <button type="button" className="btn-secondary shrink-0" onClick={onFix}>
          找试听
        </button>
      )}
      <Switch
        id={`player-${item.id}`}
        checked={item.inPlayer}
        onChange={(on) => {
          if (on && !previewUrl) {
            toast("先为这首歌找到试听，才能加入播放器", "error");
            return;
          }
          update.mutate({ inPlayer: on }, { onError: (e) => toast(e.message, "error") });
        }}
        label={<span className="hidden text-[12px] text-subtle sm:inline">播放器</span>}
      />
    </li>
  );
}

/** Finds an iTunes preview for a song and puts it in the player. */
export function FixPreviewDialog({ item, onClose }: { item: AdminMediaItem; onClose: () => void }) {
  const update = useUpdateMedia(item.id);
  const toast = useToast();
  return (
    <MusicSearchDialog
      mode="preview"
      initialQuery={`${pickText(item.title)} ${item.credits[0] ?? ""}`.trim()}
      onClose={onClose}
      onPick={(result) =>
        update.mutate(
          { music: { previewUrl: result.previewUrl, appleUrl: result.appleUrl }, inPlayer: true },
          {
            onSuccess: () => {
              toast("已设置试听并加入播放器");
              onClose();
            },
            onError: (e) => toast(e.message, "error")
          }
        )
      }
    />
  );
}
