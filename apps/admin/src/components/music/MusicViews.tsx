import type { AdminMediaItem, AdminPlaylist } from "@liam-frost/shared";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Disc3,
  ListMusic,
  Mic2,
  Music,
  Plus,
  Search,
  Trash2,
  X
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";

import { usePlaylists, useSetPlaylist } from "../../hooks/usePlaylists";
import { api } from "../../lib/api";
import { pickText } from "../../lib/i18n";
import { Dialog } from "../ui/Dialog";
import { Field, Switch } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { MusicList } from "./MusicTools";

type View = "songs" | "albums" | "artists" | "playlists";

const VIEWS: [View, string, typeof Music][] = [
  ["songs", "全部歌曲", Music],
  ["albums", "专辑", Disc3],
  ["artists", "艺人", Mic2],
  ["playlists", "歌单", ListMusic]
];

type Group = {
  key: string;
  title: string;
  subtitle: string;
  covers: string[];
  items: AdminMediaItem[];
};

const coversOf = (items: AdminMediaItem[]) =>
  [
    ...new Set(
      items.map((item) => item.poster?.variants[0].url).filter((url): url is string => Boolean(url))
    )
  ].slice(0, 4);

/** Songs grouped by album and its first singer; songs without an album are left out. */
export function groupAlbums(items: AdminMediaItem[]): Group[] {
  const groups = new Map<string, AdminMediaItem[]>();
  for (const item of items) {
    const album = item.music?.album?.trim();
    if (!album) continue;
    const key = `${album}\u0000${item.credits[0] ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups]
    .map(([key, songs]) => ({
      key,
      title: key.split("\u0000")[0],
      subtitle: `${songs[0].credits[0] ?? "未知歌手"} · ${songs.length} 首`,
      covers: coversOf(songs).slice(0, 1),
      items: songs
    }))
    .sort((a, b) => b.items.length - a.items.length || a.title.localeCompare(b.title));
}

/** Songs grouped by each of their singers (a duet appears under both). */
export function groupArtists(items: AdminMediaItem[]): Group[] {
  const groups = new Map<string, AdminMediaItem[]>();
  for (const item of items)
    for (const artist of item.credits) groups.set(artist, [...(groups.get(artist) ?? []), item]);
  return (
    [...groups]
      // Songs of one album each keep their own copy of its cover; one is enough.
      .map(([key, songs]) => ({
        key,
        title: key,
        subtitle: `${songs.length} 首`,
        covers: coversOf(songs).slice(0, 1),
        items: songs
      }))
      .sort((a, b) => b.items.length - a.items.length || a.title.localeCompare(b.title))
  );
}

/** The music tab: every song, or songs by album, by artist or by playlist. The view lives in the URL. */
export function MusicTab({ items }: { items: AdminMediaItem[] }) {
  const [params, setParams] = useSearchParams();
  const view = (VIEWS.find(([v]) => v === params.get("view"))?.[0] ?? "songs") as View;
  const open = params.get("group");

  const go = (next: { view?: View; group?: string | null }) => {
    const value = new URLSearchParams(params);
    if (next.view) value.set("view", next.view);
    if (next.group) value.set("group", next.group);
    else value.delete("group");
    setParams(value);
  };

  return (
    <>
      <div role="tablist" aria-label="音乐视图" className="mb-4 flex flex-wrap gap-1.5">
        {VIEWS.map(([v, label, Icon]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => go({ view: v, group: null })}
            className={`chip inline-flex items-center gap-1.5 ${view === v ? "border-brand bg-brand/10 text-brand" : ""}`}
          >
            <Icon aria-hidden="true" className="size-3.5" /> {label}
          </button>
        ))}
      </div>

      {view === "songs" ? <MusicList items={items} /> : null}
      {view === "albums" || view === "artists" ? (
        <GroupView
          groups={view === "albums" ? groupAlbums(items) : groupArtists(items)}
          open={open}
          noun={view === "albums" ? "专辑" : "艺人"}
          onOpen={(group) => go({ group })}
        />
      ) : null}
      {view === "playlists" ? (
        <PlaylistsView items={items} open={open} onOpen={(group) => go({ group })} />
      ) : null}
    </>
  );
}

function Mosaic({ covers, round }: { covers: string[]; round?: boolean }) {
  const shape = round ? "rounded-full" : "rounded-xl";
  if (covers.length < 4) {
    return covers[0] ? (
      <img
        src={covers[0]}
        alt=""
        loading="lazy"
        className={`aspect-square w-full bg-line-soft object-cover ${shape}`}
      />
    ) : (
      <span
        className={`flex aspect-square w-full items-center justify-center bg-line-soft text-faint ${shape}`}
      >
        <Music aria-hidden="true" className="size-8" />
      </span>
    );
  }
  return (
    <span className={`grid aspect-square w-full grid-cols-2 overflow-hidden bg-line-soft ${shape}`}>
      {covers.map((cover) => (
        <img key={cover} src={cover} alt="" loading="lazy" className="size-full object-cover" />
      ))}
    </span>
  );
}

function BackHeader({
  title,
  subtitle,
  onBack,
  children
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        aria-label="返回"
        className="rounded-full p-1.5 text-subtle hover:bg-brand-secondary/12 hover:text-brand"
      >
        <ArrowLeft aria-hidden="true" className="size-5" />
      </button>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[17px] font-semibold text-brand-dark">{title}</h2>
        <p className="text-[12.5px] text-subtle">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

/** Albums or artists as a cover grid; one opens as its song list. */
function GroupView({
  groups,
  open,
  noun,
  onOpen
}: {
  groups: Group[];
  open: string | null;
  noun: string;
  onOpen: (key: string | null) => void;
}) {
  const [filter, setFilter] = useState("");
  const current = groups.find((group) => group.key === open);
  if (current) {
    return (
      <>
        <BackHeader title={current.title} subtitle={current.subtitle} onBack={() => onOpen(null)} />
        <MusicList items={current.items} />
      </>
    );
  }
  const needle = filter.trim().toLowerCase();
  const visible = groups.filter(
    (group) => !needle || `${group.title} ${group.subtitle}`.toLowerCase().includes(needle)
  );
  return (
    <>
      <div className="relative mb-4 w-full sm:w-72">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint"
        />
        <input
          className="field pl-9"
          placeholder={`筛选${noun}`}
          aria-label={`筛选${noun}`}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      {visible.length ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {visible.map((group) => (
            <li key={group.key}>
              <button
                type="button"
                className="card group block w-full overflow-hidden p-2.5 text-left transition-shadow hover:shadow-card-hover"
                onClick={() => onOpen(group.key)}
              >
                <Mosaic covers={group.covers} round={noun === "艺人"} />
                <p
                  className="mt-2 truncate text-[13px] font-semibold text-brand-dark group-hover:text-brand"
                  title={group.title}
                >
                  {group.title}
                </p>
                <p className="truncate text-[12px] text-subtle">{group.subtitle}</p>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="card p-10 text-center text-[13.5px] text-muted">
          {groups.length
            ? `没有符合条件的${noun}`
            : `还没有${noun}：歌曲的${noun === "专辑" ? "专辑" : "歌手"}信息会自动归组到这里`}
        </div>
      )}
    </>
  );
}

function PlaylistsView({
  items,
  open,
  onOpen
}: {
  items: AdminMediaItem[];
  open: string | null;
  onOpen: (id: string | null) => void;
}) {
  const { data: playlists, isPending, error } = usePlaylists();
  const [creating, setCreating] = useState(false);
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const current = playlists?.find((playlist) => playlist.id === open);

  if (isPending) return <p className="py-6 text-[13px] text-subtle">加载中…</p>;
  if (error) return <p className="py-6 text-[13px] text-status-error">{error.message}</p>;
  if (current)
    return (
      <PlaylistDetail playlist={current} items={items} byId={byId} onBack={() => onOpen(null)} />
    );

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-subtle">
          导入 Spotify 歌单或“已点赞的歌曲”时会自动建同名歌单；也可以自己建。
        </p>
        <button type="button" className="btn-primary shrink-0" onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" className="size-4" /> 新建歌单
        </button>
      </div>
      {playlists?.length ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {playlists.map((playlist) => {
            const songs = playlist.trackIds
              .map((id) => byId.get(id))
              .filter((item): item is AdminMediaItem => Boolean(item));
            return (
              <li key={playlist.id}>
                <button
                  type="button"
                  className="card group block w-full overflow-hidden p-2.5 text-left transition-shadow hover:shadow-card-hover"
                  onClick={() => onOpen(playlist.id)}
                >
                  <Mosaic covers={coversOf(songs)} />
                  <p className="mt-2 truncate text-[13px] font-semibold text-brand-dark group-hover:text-brand">
                    {pickText(playlist.name, "未命名歌单")}
                  </p>
                  <p className="truncate text-[12px] text-subtle">
                    {[
                      `${songs.length} 首`,
                      playlist.source === "spotify" ? "Spotify" : "",
                      playlist.visibility === "private" ? "隐藏" : ""
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="card p-10 text-center text-[13.5px] text-muted">还没有歌单</div>
      )}
      {creating ? (
        <CreatePlaylistDialog onClose={() => setCreating(false)} onCreated={(id) => onOpen(id)} />
      ) : null}
    </>
  );
}

function CreatePlaylistDialog({
  onClose,
  onCreated
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const setPlaylist = useSetPlaylist();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      const { playlist } = await api.createPlaylist({ name: { zh: name.trim() } });
      setPlaylist(playlist);
      onClose();
      onCreated(playlist.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    }
  };

  return (
    <Dialog open size="sm" title="新建歌单" onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="space-y-3">
        <Field label="名称" htmlFor="playlist-name">
          <input
            id="playlist-name"
            className="field"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            data-autofocus
          />
        </Field>
        {error ? <p className="text-[12.5px] text-status-error">{error}</p> : null}
        <button type="submit" className="btn-primary" disabled={!name.trim()}>
          创建
        </button>
      </form>
    </Dialog>
  );
}

/** One playlist: names, visibility, its songs in order (move, remove), add songs, delete. */
function PlaylistDetail({
  playlist,
  items,
  byId,
  onBack
}: {
  playlist: AdminPlaylist;
  items: AdminMediaItem[];
  byId: Map<string, AdminMediaItem>;
  onBack: () => void;
}) {
  const setPlaylist = useSetPlaylist();
  const toast = useToast();
  const [zh, setZh] = useState(playlist.name.zh ?? "");
  const [en, setEn] = useState(playlist.name.en ?? "");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const songs = playlist.trackIds
    .map((id) => byId.get(id))
    .filter((item): item is AdminMediaItem => Boolean(item));

  const call = async (action: () => Promise<{ playlist: AdminPlaylist }>, done?: string) => {
    try {
      setPlaylist((await action()).playlist);
      if (done) toast(done);
    } catch (e) {
      toast(e instanceof Error ? e.message : "操作失败", "error");
    }
  };
  const move = (index: number, by: number) => {
    const ids = songs.map((song) => song.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + by, 0, moved);
    void call(() => api.reorderPlaylist(playlist.id, ids));
  };
  const nameChanged =
    zh.trim() !== (playlist.name.zh ?? "") || en.trim() !== (playlist.name.en ?? "");

  return (
    <>
      <BackHeader
        title={pickText(playlist.name, "未命名歌单")}
        subtitle={`${songs.length} 首${playlist.source === "spotify" ? " · 来自 Spotify 导入" : ""}`}
        onBack={onBack}
      >
        <button type="button" className="btn-secondary" onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" className="size-4" /> 添加歌曲
        </button>
        <button type="button" className="btn-danger" onClick={() => setDeleting(true)}>
          <Trash2 aria-hidden="true" className="size-4" /> 删除歌单
        </button>
      </BackHeader>

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <Field label="中文名" htmlFor="playlist-zh" className="min-w-40 flex-1">
          <input
            id="playlist-zh"
            className="field"
            value={zh}
            maxLength={120}
            onChange={(e) => setZh(e.target.value)}
          />
        </Field>
        <Field label="English name" htmlFor="playlist-en" className="min-w-40 flex-1">
          <input
            id="playlist-en"
            className="field"
            value={en}
            maxLength={120}
            onChange={(e) => setEn(e.target.value)}
          />
        </Field>
        <button
          type="button"
          className="btn-primary"
          disabled={!nameChanged || !(zh.trim() || en.trim())}
          onClick={() =>
            void call(
              () => api.updatePlaylist(playlist.id, { name: { zh: zh.trim(), en: en.trim() } }),
              "已保存"
            )
          }
        >
          保存名称
        </button>
        <Switch
          id="playlist-public"
          checked={playlist.visibility === "public"}
          onChange={(on) =>
            void call(() =>
              api.updatePlaylist(playlist.id, { visibility: on ? "public" : "private" })
            )
          }
          label="在网站上显示"
        />
      </div>

      {songs.length ? (
        <ol className="card divide-y divide-line-soft">
          {songs.map((song, index) => (
            <li key={song.id} className="flex items-center gap-3 px-3 py-2">
              <span className="w-6 text-right text-[12px] text-faint">{index + 1}</span>
              {song.poster ? (
                <img
                  src={song.poster.variants[0].url}
                  alt=""
                  loading="lazy"
                  className="size-10 rounded-md object-cover"
                />
              ) : (
                <span className="size-10 rounded-md bg-line-soft" />
              )}
              <div className="min-w-0 flex-1">
                <Link
                  to={`/collection/${song.id}`}
                  className="block truncate text-[13px] font-semibold text-brand-dark hover:text-brand"
                >
                  {pickText(song.title, "未命名")}
                </Link>
                <p className="truncate text-[12px] text-subtle">
                  {[song.credits.join(", "), song.music?.album].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button
                type="button"
                aria-label="上移"
                disabled={index === 0}
                className="rounded-full p-1.5 text-faint hover:text-brand disabled:opacity-30"
                onClick={() => move(index, -1)}
              >
                <ArrowUp aria-hidden="true" className="size-4" />
              </button>
              <button
                type="button"
                aria-label="下移"
                disabled={index === songs.length - 1}
                className="rounded-full p-1.5 text-faint hover:text-brand disabled:opacity-30"
                onClick={() => move(index, 1)}
              >
                <ArrowDown aria-hidden="true" className="size-4" />
              </button>
              <button
                type="button"
                aria-label={`从歌单移除 ${pickText(song.title)}`}
                className="rounded-full p-1.5 text-faint hover:text-status-error"
                onClick={() =>
                  void call(() =>
                    api.playlistTracks(playlist.id, { action: "remove", ids: [song.id] })
                  )
                }
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <div className="card p-10 text-center text-[13.5px] text-muted">
          歌单还是空的，点击“添加歌曲”，或在歌曲列表里选择多首后“加入歌单”
        </div>
      )}

      {adding ? (
        <AddSongsDialog
          playlist={playlist}
          items={items}
          onClose={() => setAdding(false)}
          onAdded={(next) => setPlaylist(next)}
        />
      ) : null}
      <Dialog
        open={deleting}
        size="sm"
        title="删除歌单"
        onClose={() => setDeleting(false)}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setDeleting(false)}>
              取消
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={async () => {
                try {
                  await api.deletePlaylist(playlist.id);
                  setPlaylist({ id: playlist.id, deleted: true });
                  toast("已删除歌单");
                  onBack();
                } catch (e) {
                  toast(e instanceof Error ? e.message : "删除失败", "error");
                }
              }}
            >
              删除
            </button>
          </>
        }
      >
        <p className="text-[13.5px] leading-relaxed text-muted">
          确定删除歌单“{pickText(playlist.name)}”吗？歌曲本身不会删除。
        </p>
      </Dialog>
    </>
  );
}

function AddSongsDialog({
  playlist,
  items,
  onClose,
  onAdded
}: {
  playlist: AdminPlaylist;
  items: AdminMediaItem[];
  onClose: () => void;
  onAdded: (playlist: AdminPlaylist) => void;
}) {
  const [filter, setFilter] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const inPlaylist = new Set(playlist.trackIds);
  const needle = filter.trim().toLowerCase();
  const candidates = items
    .filter((item) => !inPlaylist.has(item.id))
    .filter(
      (item) =>
        !needle ||
        [pickText(item.title), ...item.credits, item.music?.album ?? ""].some((text) =>
          text.toLowerCase().includes(needle)
        )
    )
    .slice(0, 200);

  const add = async () => {
    setSaving(true);
    try {
      const { playlist: next } = await api.playlistTracks(playlist.id, {
        action: "add",
        ids: [...picked]
      });
      onAdded(next);
      toast(`已加入 ${picked.size} 首`);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "添加失败", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      title={`添加歌曲到“${pickText(playlist.name)}”`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!picked.size || saving}
            onClick={() => void add()}
          >
            加入 {picked.size} 首
          </button>
        </>
      }
    >
      <div className="relative mb-3">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint"
        />
        <input
          className="field pl-9"
          placeholder="筛选歌名、歌手、专辑"
          aria-label="筛选歌曲"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          data-autofocus
        />
      </div>
      <ul className="max-h-[50vh] divide-y divide-line-soft overflow-y-auto rounded-xl border border-line-soft">
        {candidates.map((item) => (
          <li key={item.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-brand-secondary/6">
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-brand)]"
                checked={picked.has(item.id)}
                onChange={(e) =>
                  setPicked((current) => {
                    const next = new Set(current);
                    if (e.target.checked) next.add(item.id);
                    else next.delete(item.id);
                    return next;
                  })
                }
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-brand-dark">
                  {pickText(item.title, "未命名")}
                </span>
                <span className="block truncate text-[12px] text-subtle">
                  {[item.credits.join(", "), item.music?.album].filter(Boolean).join(" · ")}
                </span>
              </span>
            </label>
          </li>
        ))}
        {!candidates.length ? (
          <li className="p-4 text-[12.5px] text-subtle">没有可以添加的歌曲</li>
        ) : null}
      </ul>
    </Dialog>
  );
}
