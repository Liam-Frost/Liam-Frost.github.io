import type { SpotifySettings } from "@liam-frost/shared";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { PageHeader } from "../components/layout/AdminLayout";
import { DatabaseNotice } from "../components/ui/DatabaseNotice";
import { Field, Switch } from "../components/ui/Field";
import { Panel } from "../components/ui/Panel";
import { useToast } from "../components/ui/Toast";
import { usePlaylists } from "../hooks/usePlaylists";
import { useSpotify, useUpdateSpotify } from "../hooks/useSpotify";
import { pickText } from "../lib/i18n";

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
      <PageHeader
        title="播放器"
        description="网站右下角的音乐播放器：网站自己的播放器（收藏里的歌，30 秒试听），或 Spotify 嵌入播放器。"
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_minmax(0,360px)]">
        <SettingsForm settings={data.settings} />
        <Panel title="歌曲">
          <p className="text-[13.5px] text-muted">
            网站自己的播放器{data.settings.playlistId ? "（所选歌单）" : ""}里现在有{" "}
            <span className="font-semibold text-brand-dark">{data.playerTracks}</span>{" "}
            首歌（公开、加入播放器并且有试听）。
          </p>
          <Link to="/collection?kind=track" className="btn-secondary">
            管理歌曲
          </Link>
          {data.playerTracks === 0 ? (
            <p className="text-[12px] leading-relaxed text-faint">
              没有歌曲时，网站会播放内置的几首备用歌曲。
            </p>
          ) : null}
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
  const { data: playlists } = usePlaylists();

  const saved = JSON.stringify(settings);
  // The seconds field keeps its own text so it can be cleared while typing; the draft gets valid numbers only.
  const [collapseText, setCollapseText] = useState(String(settings.autoCollapseSeconds));
  useEffect(() => {
    const next = JSON.parse(saved) as SpotifySettings;
    setDraft(next);
    setCollapseText(String(next.autoCollapseSeconds));
  }, [saved]);

  const dirty = JSON.stringify(draft) !== saved;
  const set = <K extends keyof SpotifySettings>(key: K, value: SpotifySettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    update.mutate(draft, { onSuccess: () => toast("已保存"), onError: (e) => setError(e.message) });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Panel title="播放">
        <Switch
          id="spotify-enabled"
          checked={draft.enabled}
          onChange={(on) => set("enabled", on)}
          label="在网站上显示播放器"
        />
        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-[12.5px] font-medium text-brand-dark">播放器类型</legend>
          {(
            [
              [
                "custom",
                "网站自己的播放器",
                "播放收藏里“加入播放器”的歌，每首 30 秒试听；样式和网站一致，支持随机播放。"
              ],
              [
                "embed",
                "Spotify 嵌入播放器",
                "Spotify 官方的播放器。在同一个浏览器登录了 Spotify 的访客能听整首，其他人听 30 秒试听；样式由 Spotify 决定。"
              ]
            ] as const
          ).map(([value, label, hint]) => (
            <label
              key={value}
              className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${draft.mode === value ? "border-brand bg-brand/5" : "border-line"}`}
            >
              <input
                type="radio"
                name="player-mode"
                value={value}
                checked={draft.mode === value}
                onChange={() => set("mode", value)}
                className="mt-1 accent-[var(--color-brand)]"
              />
              <span>
                <span className="block text-[13.5px] font-semibold text-brand-dark">{label}</span>
                <span className="block text-[12px] leading-relaxed text-subtle">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {draft.mode === "embed" ? (
          <Field
            label="Spotify 链接"
            htmlFor="spotify-embed"
            hint="歌单、专辑、歌曲或艺人的分享链接。"
          >
            <input
              id="spotify-embed"
              className="field"
              value={draft.embedUrl}
              maxLength={500}
              placeholder="https://open.spotify.com/playlist/…"
              onChange={(e) => set("embedUrl", e.target.value)}
            />
          </Field>
        ) : (
          <>
            <Field
              label="播放内容"
              htmlFor="spotify-playlist"
              hint="选一个歌单时，播放歌单里公开并且有试听的歌，按歌单顺序；歌单被隐藏或删除后回到全部歌曲。"
            >
              <select
                id="spotify-playlist"
                className="field"
                value={draft.playlistId ?? ""}
                onChange={(e) => set("playlistId", e.target.value || null)}
              >
                <option value="">所有“加入播放器”的歌</option>
                {(playlists ?? []).map((playlist) => (
                  <option key={playlist.id} value={playlist.id}>
                    歌单：{pickText(playlist.name, "未命名歌单")}
                    {playlist.visibility === "private" ? "（隐藏）" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Switch
              id="spotify-shuffle"
              checked={draft.shuffle}
              onChange={(on) => set("shuffle", on)}
              label="随机播放（关闭则按顺序）"
            />
          </>
        )}
        {draft.mode === "custom" ? (
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
        ) : null}
        <Field
          label="自动收起（秒）"
          htmlFor="spotify-collapse"
          hint="页面打开后，播放器展开多少秒再收起成小图标。0 表示不自动收起。"
        >
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
              if (
                e.target.value.trim() &&
                Number.isInteger(seconds) &&
                seconds >= 0 &&
                seconds <= 120
              )
                set("autoCollapseSeconds", seconds);
            }}
            onBlur={() => setCollapseText(String(draft.autoCollapseSeconds))}
          />
        </Field>
      </Panel>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-status-error/30 bg-status-error/8 px-4 py-2.5 text-[12.5px] text-status-error"
        >
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
