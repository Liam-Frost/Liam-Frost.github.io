import type { SpotifySettings } from "@liam-frost/shared";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { PageHeader } from "../components/layout/AdminLayout";
import { DatabaseNotice } from "../components/ui/DatabaseNotice";
import { Field, Switch } from "../components/ui/Field";
import { Panel } from "../components/ui/Panel";
import { useToast } from "../components/ui/Toast";
import { useSpotify, useUpdateSpotify } from "../hooks/useSpotify";

/** Settings of the site's music player; its songs are managed in the collection's music tab. */
export function MusicPage() {
  const { data, isPending, error } = useSpotify();

  if (isPending) return <p className="py-10 text-center text-[13px] text-subtle">加载中…</p>;
  if (error) {
    return (
      <>
        <PageHeader title="播放器" />
        <DatabaseNotice error={error} subject="播放器设置" />
      </>
    );
  }

  return (
    <>
      <PageHeader title="播放器" description="网站右下角的音乐播放器，播放收藏里标为“加入播放器”的歌曲，每首 30 秒试听。" />
      <div className="grid gap-5 lg:grid-cols-[1fr_minmax(0,360px)]">
        <SettingsForm settings={data.settings} />
        <Panel title="歌曲">
          <p className="text-[13.5px] text-muted">
            播放器里现在有 <span className="font-semibold text-brand-dark">{data.playerTracks}</span> 首歌（公开、加入播放器并且有试听）。
          </p>
          <Link to="/collection?kind=track" className="btn-secondary">
            管理歌曲
          </Link>
          {data.playerTracks === 0 ? <p className="text-[12px] leading-relaxed text-faint">没有歌曲时，网站会播放内置的几首备用歌曲。</p> : null}
        </Panel>
      </div>
    </>
  );
}

function SettingsForm({ settings }: { settings: SpotifySettings }) {
  const [draft, setDraft] = useState(settings);
  const [error, setError] = useState("");
  const update = useUpdateSpotify();
  const toast = useToast();

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
    update.mutate(draft, { onSuccess: () => toast("已保存"), onError: (e) => setError(e.message) });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Panel title="播放">
        <Switch id="spotify-enabled" checked={draft.enabled} onChange={(on) => set("enabled", on)} label="在网站上显示播放器" />
        <Switch id="spotify-shuffle" checked={draft.shuffle} onChange={(on) => set("shuffle", on)} label="随机播放（关闭则按收藏顺序）" />
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
          {update.isPending ? "保存中…" : "保存"}
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
