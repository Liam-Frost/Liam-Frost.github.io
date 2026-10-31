import type { SpotifySettings, SpotifySyncStatus } from "@liam-frost/shared";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { PageHeader } from "../components/layout/AdminLayout";
import { DatabaseNotice } from "../components/ui/DatabaseNotice";
import { Field, Switch } from "../components/ui/Field";
import { Panel } from "../components/ui/Panel";
import { useToast } from "../components/ui/Toast";
import { useSpotify, useSyncSpotify, useUpdateSpotify } from "../hooks/useSpotify";

const dateTime = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" });
const formatTime = (iso: string | null) => (iso ? dateTime.format(new Date(iso)) : "—");

export function MusicPage() {
  const { data, isPending, error } = useSpotify();

  if (isPending) return <p className="py-10 text-center text-[13px] text-subtle">加载中…</p>;
  if (error) {
    return (
      <>
        <PageHeader title="音乐" />
        <DatabaseNotice error={error} subject="音乐设置" />
      </>
    );
  }

  return (
    <>
      <PageHeader title="音乐" description="网站右下角的 Spotify 播放器。歌单每 6 小时自动同步一次，每首歌播放 30 秒试听。" />
      <div className="grid gap-5 lg:grid-cols-[1fr_minmax(0,420px)]">
        <SettingsForm settings={data.settings} />
        <SyncPanel sync={data.sync} />
      </div>
    </>
  );
}

function SettingsForm({ settings }: { settings: SpotifySettings }) {
  const [draft, setDraft] = useState(settings);
  const [error, setError] = useState("");
  const update = useUpdateSpotify();
  const toast = useToast();

  // Adopt saved (normalized) values, e.g. the playlist link without ?si=. Keyed by content: a sync
  // replaces the cached response but not the settings, and must not reset unsaved edits.
  const saved = JSON.stringify(settings);
  // The seconds field keeps its own text so it can be cleared while typing; the draft gets valid numbers only.
  const [collapseText, setCollapseText] = useState(String(settings.autoCollapseSeconds));
  useEffect(() => {
    const next = JSON.parse(saved) as SpotifySettings;
    setDraft(next);
    setCollapseText(String(next.autoCollapseSeconds));
  }, [saved]);

  const dirty = JSON.stringify(draft) !== saved;
  const set = <K extends keyof SpotifySettings>(key: K, value: SpotifySettings[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    update.mutate(draft, {
      onSuccess: ({ sync }) => {
        if (draft.playlistUrl !== settings.playlistUrl && sync.error) toast(`已保存，但歌单同步失败：${sync.error}`, "error");
        else toast("已保存");
      },
      onError: (e) => setError(e.message)
    });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Panel title="播放器">
        <Switch id="spotify-enabled" checked={draft.enabled} onChange={(on) => set("enabled", on)} label="在网站上显示播放器" />
        <Field label="Spotify 歌单链接" htmlFor="spotify-playlist" hint="在 Spotify 里打开歌单 → 分享 → 复制歌单链接。必须是公开歌单。">
          <input
            id="spotify-playlist"
            className="field"
            value={draft.playlistUrl}
            maxLength={500}
            placeholder="https://open.spotify.com/playlist/…"
            onChange={(e) => set("playlistUrl", e.target.value)}
          />
        </Field>
        <Switch id="spotify-shuffle" checked={draft.shuffle} onChange={(on) => set("shuffle", on)} label="随机播放（关闭则按歌单顺序）" />
      </Panel>

      <Panel title="细节">
        <Field label={`默认音量：${draft.volume}%`} htmlFor="spotify-volume">
          <input
            id="spotify-volume"
            type="range"
            min={0}
            max={100}
            step={5}
            value={draft.volume}
            onChange={(e) => set("volume", Number(e.target.value))}
            className="w-full accent-[var(--color-brand)]"
          />
        </Field>
        <Field label="自动收起（秒）" htmlFor="spotify-collapse" hint="页面打开后，播放器展开多少秒再收起成小图标。0 表示不自动收起。">
          <input
            id="spotify-collapse"
            type="number"
            min={0}
            max={120}
            className="field w-28"
            value={collapseText}
            onChange={(e) => {
              setCollapseText(e.target.value);
              const seconds = Number(e.target.value);
              if (e.target.value.trim() && Number.isInteger(seconds) && seconds >= 0 && seconds <= 120) set("autoCollapseSeconds", seconds);
            }}
            onBlur={() => setCollapseText(String(draft.autoCollapseSeconds))}
          />
        </Field>
      </Panel>

      {error ? (
        <p role="alert" className="rounded-xl border border-status-error/30 bg-status-error/8 px-4 py-2.5 text-[12.5px] text-status-error">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={update.isPending || !dirty}>
          {update.isPending ? (draft.playlistUrl !== settings.playlistUrl ? "保存并同步中…" : "保存中…") : "保存"}
        </button>
        {dirty ? (
          <span className="text-[12.5px] text-status-warn" role="status">
            有未保存的修改
          </span>
        ) : null}
      </div>
    </form>
  );
}

function SyncPanel({ sync }: { sync: SpotifySyncStatus }) {
  const run = useSyncSpotify();
  const toast = useToast();

  const syncNow = () =>
    run.mutate(undefined, {
      onSuccess: ({ sync: next }) => (next.error ? toast(`同步失败：${next.error}`, "error") : toast(`已同步 ${next.tracks.length} 首歌`)),
      onError: (e) => toast(e.message, "error")
    });

  return (
    <Panel title="歌单">
      <div className="flex items-start gap-3">
        {sync.playlist?.image ? <img src={sync.playlist.image} alt="" className="size-14 shrink-0 rounded-lg object-cover" /> : null}
        <div className="min-w-0 flex-1">
          {sync.playlist ? (
            <a
              href={sync.playlist.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-full items-center gap-1 text-[14px] font-semibold text-brand-dark hover:text-brand"
            >
              <span className="truncate">{sync.playlist.name}</span>
              <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
            </a>
          ) : (
            <p className="text-[13.5px] text-muted">还没有同步这个歌单</p>
          )}
          <p className="mt-0.5 text-[12px] text-subtle">
            {sync.tracks.length} 首可试听 · 上次同步 {formatTime(sync.syncedAt)}
          </p>
        </div>
        <button type="button" className="btn-secondary shrink-0" onClick={syncNow} disabled={run.isPending}>
          <RefreshCw aria-hidden="true" className={`size-4 ${run.isPending ? "animate-spin" : ""}`} />
          {run.isPending ? "同步中…" : "立即同步"}
        </button>
      </div>

      {sync.error ? (
        <p role="alert" className="rounded-xl border border-status-error/30 bg-status-error/8 px-3 py-2 text-[12.5px] text-status-error">
          {formatTime(sync.attemptedAt)} 同步失败：{sync.error}
          {sync.tracks.length ? "。网站继续使用上次同步的歌曲。" : ""}
        </p>
      ) : null}

      {sync.tracks.length ? (
        <ol className="max-h-[520px] divide-y divide-line-soft overflow-y-auto rounded-xl border border-line-soft">
          {sync.tracks.map((track, index) => (
            <li key={track.id} className="flex items-center gap-3 px-3 py-2">
              <span className="w-6 shrink-0 text-right text-[11.5px] text-faint tabular-nums">{index + 1}</span>
              <img src={track.image} alt="" loading="lazy" className="size-9 shrink-0 rounded bg-line-soft object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-ink">{track.title}</p>
                <p className="truncate text-[12px] text-subtle">{track.artist}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </Panel>
  );
}
