import type {
  AdminMediaItem,
  CollectionSettings,
  MediaSearchResult,
  MediaSearchSource,
  MediaStatus
} from "@liam-frost/shared";
import { Clapperboard, EyeOff, Plus, Search, Settings2, Star } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { MediaBatchActions } from "../components/collection/MediaBatchActions";
import { SteamDialog } from "../components/games/SteamDialog";
import { PageHeader } from "../components/layout/AdminLayout";
import {
  MusicSearchDialog,
  PlaylistImportDialog,
  SpotifyAccountDialog
} from "../components/music/MusicTools";
import { MusicTab } from "../components/music/MusicViews";
import { BatchBar, SelectMark } from "../components/ui/BatchBar";
import { DatabaseNotice } from "../components/ui/DatabaseNotice";
import { Dialog } from "../components/ui/Dialog";
import { Field, Switch } from "../components/ui/Field";
import { StarRating } from "../components/ui/StarRating";
import { useToast } from "../components/ui/Toast";
import {
  useCollectionSettings,
  useCreateMedia,
  useImportMedia,
  useMediaList,
  useUpdateCollectionSettings
} from "../hooks/useMedia";
import { useSelection, type Selection } from "../hooks/useSelection";
import { api, ApiError } from "../lib/api";
import {
  COLLECTION_KIND_LABELS,
  COLLECTION_KINDS,
  KIND_LABELS,
  KIND_SOURCES,
  MEDIA_STATUS_LABELS,
  pickText,
  SOURCE_LABELS,
  statusLabels,
  WATCH_KINDS,
  type CollectionKind,
  type WatchKind
} from "../lib/i18n";
import { useRecentCounts } from "../components/analytics/RecentStats";

const STATUSES = Object.keys(MEDIA_STATUS_LABELS) as MediaStatus[];

export function CollectionPage() {
  const [params, setParams] = useSearchParams();
  const kind: CollectionKind = COLLECTION_KINDS.find((k) => k === params.get("kind")) ?? "movie";
  const status = STATUSES.find((s) => s === params.get("status")) ?? null;
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [spotifyOpen, setSpotifyOpen] = useState(false);
  const toast = useToast();

  const [steamOpen, setSteamOpen] = useState(false);

  // Back from Spotify's or Steam's sign-in page: report the result and open the account dialog.
  useEffect(() => {
    for (const [param, name, open] of [
      ["spotify", "Spotify", setSpotifyOpen],
      ["steam", "Steam", setSteamOpen]
    ] as const) {
      const result = params.get(param);
      if (!result) continue;
      if (result === "connected") toast(`已连接 ${name}`);
      else toast(`连接 ${name} 失败：${params.get("reason") ?? "未知原因"}`, "error");
      open(result === "connected");
      const next = new URLSearchParams(params);
      next.delete(param);
      next.delete("reason");
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when returning from a sign-in page
  }, []);
  const [editingSettings, setEditingSettings] = useState(false);
  const { data: items, isPending, error } = useMediaList();
  const { data: settings } = useCollectionSettings();

  const select = (next: { kind?: CollectionKind; status?: MediaStatus | null }) => {
    const value = new URLSearchParams();
    value.set("kind", next.kind ?? kind);
    const nextStatus = next.status === undefined ? status : next.status;
    if (nextStatus) value.set("status", nextStatus);
    setParams(value, { replace: true });
  };

  if (isPending) return <p className="py-10 text-center text-[13px] text-subtle">加载中…</p>;
  if (error) {
    return (
      <>
        <PageHeader title="收藏" />
        <DatabaseNotice error={error} subject="收藏管理" />
      </>
    );
  }

  const ofKind = (items ?? []).filter((item) => item.kind === kind);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="收藏"
          description="看过、在看和想看的电影、剧集、动漫，读过的书和漫画，以及喜欢的歌。搜索添加时会自动填好资料和海报。"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setEditingSettings(true)}
            disabled={!settings}
          >
            <Settings2 aria-hidden="true" className="size-4" /> 显示设置
          </button>
          {kind === "game" ? (
            <button type="button" className="btn-secondary" onClick={() => setSteamOpen(true)}>
              Steam 游戏库
            </button>
          ) : null}
          {kind === "track" ? (
            <>
              <button type="button" className="btn-secondary" onClick={() => setSpotifyOpen(true)}>
                Spotify 账号
              </button>
              <button type="button" className="btn-secondary" onClick={() => setImporting(true)}>
                导入歌单链接
              </button>
            </>
          ) : null}
          <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" className="size-4" />{" "}
            {kind === "track" ? "添加歌曲" : `添加${KIND_LABELS[kind]}`}
          </button>
        </div>
      </div>

      {settings && !settings.sources.tmdb && (kind === "movie" || kind === "tv") ? (
        <p className="mb-4 rounded-xl border border-status-warn/30 bg-status-warn/8 px-4 py-2.5 text-[12.5px] leading-relaxed text-status-warn">
          未配置 TMDB：电影和剧集暂时只能手动添加。在 <code className="chip">apps/api/.env</code>{" "}
          中设置 <code className="chip">TMDB_API_KEY</code> 后重启 API。
        </p>
      ) : null}

      <div role="tablist" aria-label="类型" className="mb-3 flex flex-wrap gap-1.5">
        {COLLECTION_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => select({ kind: k })}
            className={`rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${kind === k ? "bg-brand text-white" : "bg-brand-secondary/10 text-brand hover:bg-brand-secondary/18"}`}
          >
            {COLLECTION_KIND_LABELS[k]}{" "}
            <span className="opacity-70">
              {(items ?? []).filter((item) => item.kind === k).length}
            </span>
          </button>
        ))}
      </div>

      {kind === "track" ? (
        <MusicTab items={ofKind} />
      ) : (
        <WatchList
          kind={kind}
          items={ofKind}
          status={status}
          onStatus={(s) => select({ status: s })}
        />
      )}

      {adding && kind === "track" ? (
        <MusicSearchDialog mode="add" onClose={() => setAdding(false)} />
      ) : null}
      {adding && kind !== "track" ? (
        <AddMediaDialog
          kind={kind}
          available={settings?.sources}
          onClose={() => setAdding(false)}
        />
      ) : null}
      {importing ? <PlaylistImportDialog onClose={() => setImporting(false)} /> : null}
      {spotifyOpen ? <SpotifyAccountDialog onClose={() => setSpotifyOpen(false)} /> : null}
      {steamOpen ? <SteamDialog onClose={() => setSteamOpen(false)} /> : null}
      {editingSettings && settings ? (
        <SettingsDialog settings={settings.settings} onClose={() => setEditingSettings(false)} />
      ) : null}
    </>
  );
}

/** Films, series or anime: status filters, title filter and the poster grid. */
function WatchList({
  kind,
  items: ofKind,
  status,
  onStatus
}: {
  kind: WatchKind;
  items: AdminMediaItem[];
  status: MediaStatus | null;
  onStatus: (status: MediaStatus | null) => void;
}) {
  const [filter, setFilter] = useState("");
  const needle = filter.trim().toLowerCase();
  const visible = ofKind.filter(
    (item) =>
      (!status || item.status === status) &&
      (!needle ||
        [...Object.values(item.title), item.originalTitle ?? ""].some((text) =>
          text?.toLowerCase().includes(needle)
        ))
  );
  const order = useMemo(() => visible.map((item) => item.id), [visible]);
  const selection = useSelection(order);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {[null, ...STATUSES].map((s) => (
          <button
            key={s ?? "all"}
            type="button"
            aria-pressed={status === s}
            onClick={() => onStatus(s)}
            className={`chip ${status === s ? "border-brand bg-brand/10 text-brand" : ""}`}
          >
            {s ? statusLabels(kind)[s] : "全部"}{" "}
            {s ? ofKind.filter((item) => item.status === s).length : ofKind.length}
          </button>
        ))}
        <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-60">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint"
            />
            <input
              className="field pl-9"
              placeholder="筛选标题"
              aria-label="筛选标题"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          {visible.length && !selection.active ? (
            <button type="button" className="btn-secondary shrink-0" onClick={selection.start}>
              选择
            </button>
          ) : null}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="card p-10 text-center text-[13.5px] text-muted">
          {ofKind.length
            ? "没有符合条件的条目"
            : `还没有${KIND_LABELS[kind]}，点击“添加${KIND_LABELS[kind]}”开始`}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((item) => (
            <li key={item.id}>
              <MediaCard item={item} selection={selection} />
            </li>
          ))}
        </ul>
      )}

      <BatchBar selection={selection} total={visible.length}>
        <MediaBatchActions kind={kind} selection={selection} />
      </BatchBar>
    </>
  );
}

function MediaCard({ item, selection }: { item: AdminMediaItem; selection: Selection }) {
  const title = pickText(item.title, "未命名");
  const selected = selection.isSelected(item.id);
  const { data: counts } = useRecentCounts("media");
  const views = counts?.[item.id]?.views;
  const className = `card group block w-full overflow-hidden text-left transition-shadow hover:shadow-card-hover ${selected ? "ring-2 ring-brand" : ""}`;
  const body = (
    <>
      <div className="relative aspect-[2/3] bg-line-soft">
        {selection.active ? (
          <span className="absolute top-2 right-2 z-10">
            <SelectMark checked={selected} />
          </span>
        ) : null}
        {item.poster ? (
          <img
            src={item.poster.variants[0].url}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-faint">
            <Clapperboard aria-hidden="true" className="size-8" />
          </span>
        )}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {item.status ? (
            <span className="chip bg-surface/90">{statusLabels(item.kind)[item.status]}</span>
          ) : null}
          {item.visibility === "private" ? (
            <span className="chip inline-flex items-center gap-1 bg-surface/90">
              <EyeOff aria-hidden="true" className="size-3" /> 隐藏
            </span>
          ) : null}
          {item.featured ? (
            <span className="chip inline-flex items-center gap-1 bg-surface/90">
              <Star aria-hidden="true" className="size-3" /> 精选
            </span>
          ) : null}
        </div>
      </div>
      <div className="space-y-1 p-3">
        <p
          className="truncate text-[13.5px] font-semibold text-brand-dark group-hover:text-brand"
          title={title}
        >
          {title}
        </p>
        <div className="flex items-center justify-between gap-2 text-[12px] text-subtle">
          <span>
            {item.year ?? "—"}
            {views ? (
              <span className="ml-1.5 text-faint" title="近 30 天浏览">
                · {views} 次浏览
              </span>
            ) : null}
          </span>
          <StarRating value={item.rating} size="sm" />
        </div>
      </div>
    </>
  );
  // While selecting, a click selects (Shift: a range) instead of opening the editor.
  return selection.active ? (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`选择 ${title}`}
      className={className}
      onClick={(e) => selection.toggle(item.id, e.shiftKey)}
    >
      {body}
    </button>
  ) : (
    <Link to={`/collection/${item.id}`} className={className}>
      {body}
    </Link>
  );
}

function AddMediaDialog({
  kind,
  available,
  onClose
}: {
  kind: WatchKind;
  available?: Record<MediaSearchSource, boolean>;
  onClose: () => void;
}) {
  // Sources that need a key (TMDB, Google Books) are left out until it is set.
  const configured = KIND_SOURCES[kind].filter((s) => available?.[s] ?? true);
  const sources = configured.length ? configured : KIND_SOURCES[kind];
  const [source, setSource] = useState<MediaSearchSource>(sources[0]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const importMedia = useImportMedia();
  const createMedia = useCreateMedia();
  const navigate = useNavigate();
  const sourceReady = available?.[source] ?? true;

  const search = async (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim() || !sourceReady) return;
    setSearching(true);
    setError("");
    try {
      setResults((await api.searchMedia(kind, source, query.trim())).results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "搜索失败");
    } finally {
      setSearching(false);
    }
  };

  const add = (result: MediaSearchResult) =>
    importMedia.mutate(
      { kind, source: result.source, sourceId: result.sourceId },
      {
        onSuccess: ({ item }) => navigate(`/collection/${item.id}`),
        onError: (e) =>
          setError(
            e instanceof ApiError && e.code === "MEDIA_EXISTS" ? "这个条目已在收藏中" : e.message
          )
      }
    );

  const addManually = (event: FormEvent) => {
    event.preventDefault();
    if (!manualTitle.trim()) return;
    createMedia.mutate(
      { kind, title: { zh: manualTitle.trim() } },
      {
        onSuccess: ({ item }) => navigate(`/collection/${item.id}`),
        onError: (e) => setError(e.message)
      }
    );
  };

  return (
    <Dialog open title={`添加${KIND_LABELS[kind]}`} onClose={onClose}>
      <form onSubmit={search} className="flex flex-wrap items-end gap-2">
        {sources.length > 1 ? (
          <Field label="资料来源" htmlFor="media-source">
            <select
              id="media-source"
              className="field"
              value={source}
              onChange={(e) => {
                setSource(e.target.value as MediaSearchSource);
                setResults(null);
              }}
            >
              {sources.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field
          label={`在 ${SOURCE_LABELS[source]} 搜索`}
          htmlFor="media-query"
          className="min-w-0 flex-1"
        >
          <input
            id="media-query"
            className="field"
            value={query}
            maxLength={100}
            placeholder={SEARCH_HINTS[source]}
            disabled={!sourceReady}
            onChange={(e) => setQuery(e.target.value)}
            data-autofocus
          />
        </Field>
        <button
          type="submit"
          className="btn-primary"
          disabled={searching || !query.trim() || !sourceReady}
        >
          <Search aria-hidden="true" className="size-4" />
          {searching ? "搜索中…" : "搜索"}
        </button>
      </form>

      {!sourceReady ? (
        <p className="mt-3 text-[12.5px] text-status-warn">
          未配置{" "}
          {source === "tmdb"
            ? "TMDB_API_KEY"
            : source === "igdb"
              ? "TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET"
              : "GOOGLE_BOOKS_API_KEY"}
          ，暂时只能手动添加。
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-[12.5px] text-status-error">
          {error}
        </p>
      ) : null}

      {results ? (
        results.length ? (
          <ul className="mt-4 divide-y divide-line-soft rounded-xl border border-line-soft">
            {results.map((result) => (
              <li key={result.sourceId} className="flex items-start gap-3 p-3">
                {result.posterUrl ? (
                  <img
                    src={result.posterUrl}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-[84px] w-14 shrink-0 rounded-md bg-line-soft object-cover"
                  />
                ) : (
                  <span className="flex h-[84px] w-14 shrink-0 items-center justify-center rounded-md bg-line-soft text-faint">
                    <Clapperboard aria-hidden="true" className="size-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-brand-dark">
                    {result.title}
                    {result.year ? (
                      <span className="ml-1.5 font-normal text-subtle">{result.year}</span>
                    ) : null}
                    {kind === "anime" && result.source === "tmdb" ? (
                      <span className="chip ml-1.5">
                        {result.mediaType === "movie" ? "剧场版" : "TV"}
                      </span>
                    ) : null}
                  </p>
                  {result.originalTitle && result.originalTitle !== result.title ? (
                    <p className="truncate text-[12px] text-subtle">{result.originalTitle}</p>
                  ) : null}
                  {result.creators.length ? (
                    <p className="truncate text-[12px] text-subtle">{result.creators.join("、")}</p>
                  ) : null}
                  {result.overview ? (
                    <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted">
                      {result.overview}
                    </p>
                  ) : null}
                </div>
                {result.existingId ? (
                  <Link to={`/collection/${result.existingId}`} className="btn-secondary shrink-0">
                    已添加，打开
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="btn-primary shrink-0"
                    disabled={importMedia.isPending}
                    onClick={() => add(result)}
                  >
                    {importMedia.isPending && importMedia.variables?.sourceId === result.sourceId
                      ? "添加中…"
                      : "添加"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[13px] text-muted">
            没有找到，换个关键词试试，或者在下面手动添加。
          </p>
        )
      ) : null}

      <form
        onSubmit={addManually}
        className="mt-5 flex flex-wrap items-end gap-2 border-t border-line-soft pt-4"
      >
        <Field
          label="搜不到？手动添加"
          htmlFor="media-manual-title"
          hint="之后在编辑页补充资料和海报"
          className="min-w-0 flex-1"
        >
          <input
            id="media-manual-title"
            className="field"
            value={manualTitle}
            maxLength={200}
            placeholder="标题（简体中文）"
            onChange={(e) => setManualTitle(e.target.value)}
          />
        </Field>
        <button
          type="submit"
          className="btn-secondary"
          disabled={!manualTitle.trim() || createMedia.isPending}
        >
          {createMedia.isPending ? "创建中…" : "手动添加"}
        </button>
      </form>
    </Dialog>
  );
}

/** What each source finds best. */
const SEARCH_HINTS: Record<MediaSearchSource, string> = {
  tmdb: "片名，中文、英文或原名都可以",
  bangumi: "中文名或日文原名",
  openlibrary: "书名或作者，英文和原文书名最容易找到",
  googlebooks: "书名、作者或 ISBN，中文书也很全",
  anilist: "日文原名、罗马音或英文名",
  igdb: "游戏英文名最容易找到"
};

function SettingsDialog({
  settings,
  onClose
}: {
  settings: CollectionSettings;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(settings);
  const update = useUpdateCollectionSettings();
  const toast = useToast();
  const kinds = [
    ...WATCH_KINDS.map((k) => [k, KIND_LABELS[k]] as const),
    ["music", "音乐"] as const,
    ["people", "人物"] as const
  ];

  const save = () =>
    update.mutate(draft, {
      onSuccess: () => {
        toast("已保存");
        onClose();
      },
      onError: (e) => toast(e.message, "error")
    });

  return (
    <Dialog
      open
      size="sm"
      title="显示设置"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={update.isPending}>
            {update.isPending ? "保存中…" : "保存"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-[12.5px] font-medium text-brand-dark">在网站上显示</p>
          <div className="flex flex-col items-start gap-2.5">
            {kinds.map(([key, label]) => (
              <Switch
                key={key}
                id={`show-${key}`}
                checked={draft.show[key]}
                onChange={(on) => setDraft((d) => ({ ...d, show: { ...d.show, [key]: on } }))}
                label={label}
              />
            ))}
          </div>
        </div>
        <div className="border-t border-line-soft pt-4">
          <Switch
            id="show-want"
            checked={draft.showWant}
            onChange={(on) => setDraft((d) => ({ ...d, showWant: on }))}
            label="显示“想看”的条目"
          />
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-faint">
            关闭后，所有“想看”条目都不在网站上显示；打开时，每个条目再按自己的“公开”设置决定。
          </p>
        </div>
      </div>
    </Dialog>
  );
}
