import { COLLECTION_SORTS, sortCollection, type CollectionSort } from "../lib/collectionSort";
import LoadingSkeleton from "../../../web/src/components/LoadingSkeleton";
import type {
  AdminMediaItem,
  CollectionSettings,
  MediaSearchResult,
  MediaSearchSource,
  MediaStatus
} from "@liam-frost/shared";
import { resolveFeaturedWall } from "@liam-frost/shared";
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
import { useArrivalParams } from "../hooks/useArrivalParams";
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
import { Tooltip } from "../components/ui/Tooltip";
import { tr } from "../lib/messages";

const STATUSES = Object.keys(MEDIA_STATUS_LABELS) as MediaStatus[];

export function CollectionPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const kind: CollectionKind = COLLECTION_KINDS.find((k) => k === params.get("kind")) ?? "movie";
  const status = STATUSES.find((s) => s === params.get("status")) ?? null;
  // ?rating=none: entries without a rating (the overview's 未评分 task).
  const unrated = params.get("rating") === "none";
  // 概览 links here with ?open=add, steam or spotify.
  const arrival = useArrivalParams("open").open;
  const [adding, setAdding] = useState(arrival === "add");
  const [importing, setImporting] = useState(false);
  const [spotifyOpen, setSpotifyOpen] = useState(arrival === "spotify");
  const toast = useToast();

  const [steamOpen, setSteamOpen] = useState(arrival === "steam");

  // Back from Spotify's or Steam's sign-in page: report the result and open the account dialog.
  useEffect(() => {
    for (const [param, name, open] of [
      ["spotify", "Spotify", setSpotifyOpen],
      ["steam", "Steam", setSteamOpen]
    ] as const) {
      const result = params.get(param);
      if (!result) continue;
      if (result === "connected") toast(tr("已连接 {0}", name));
      else toast(tr("连接 {0} 失败：{1}", name, params.get("reason") ?? tr("未知原因")), "error");
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

  const select = (next: {
    kind?: CollectionKind;
    status?: MediaStatus | null;
    unrated?: boolean;
  }) => {
    const value = new URLSearchParams();
    value.set("kind", next.kind ?? kind);
    if (params.has("sort")) value.set("sort", params.get("sort")!);
    const nextStatus = next.status === undefined ? status : next.status;
    if (nextStatus) value.set("status", nextStatus);
    if (next.unrated ?? (next.kind === undefined && unrated)) value.set("rating", "none");
    setParams(value, { replace: true });
  };

  if (isPending) return <LoadingSkeleton label={tr("加载中…")} variant="rows" />;
  if (error) {
    return (
      <>
        <PageHeader title={tr("收藏")} />
        <DatabaseNotice error={error} subject={tr("收藏管理")} />
      </>
    );
  }

  const sort: CollectionSort = Object.hasOwn(COLLECTION_SORTS, params.get("sort") ?? "")
    ? (params.get("sort") as CollectionSort)
    : "updated";
  const ofKind = sortCollection(
    (items ?? []).filter((item) => item.kind === kind),
    sort
  );

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={tr("收藏")}
          description={tr(
            "看过、在看和想看的电影、剧集、动漫，读过的书和漫画，以及喜欢的歌。搜索添加时会自动填好资料和海报。"
          )}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setEditingSettings(true)}
            disabled={!settings}
          >
            <Settings2 aria-hidden="true" className="size-4" /> {tr("显示设置")}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate("/collection/featured")}
            disabled={!items}
          >
            <Star aria-hidden="true" className="size-4" /> {tr("首页精选")}
          </button>
          {kind === "game" ? (
            <button type="button" className="btn-secondary" onClick={() => setSteamOpen(true)}>
              {tr("Steam 游戏库")}
            </button>
          ) : null}
          {kind === "track" ? (
            <>
              <button type="button" className="btn-secondary" onClick={() => setSpotifyOpen(true)}>
                {tr("Spotify 账号")}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setImporting(true)}>
                {tr("导入歌单链接")}
              </button>
            </>
          ) : null}
          <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" className="size-4" />{" "}
            {kind === "track" ? tr("添加歌曲") : tr("添加{0}", KIND_LABELS[kind])}
          </button>
        </div>
      </div>

      {settings && !settings.sources.tmdb && (kind === "movie" || kind === "tv") ? (
        <p className="mb-4 rounded-xl border border-status-warn/30 bg-status-warn/8 px-4 py-2.5 text-[12.5px] leading-relaxed text-status-warn">
          {tr("未配置 TMDB：电影和剧集暂时只能手动添加。请到")}{" "}
          <Link to="/integrations" className="text-brand underline">
            {tr("API 配置")}
          </Link>{" "}
          {tr("添加凭据，保存后即可搜索。")}
        </p>
      ) : null}

      <div role="tablist" aria-label={tr("类型")} className="mb-3 flex flex-wrap gap-1.5">
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

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label htmlFor="collection-sort" className="text-xs text-brand-secondary">
          {tr("排列顺序")}
        </label>
        <select
          id="collection-sort"
          className="field !w-auto"
          value={sort}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            next.set("sort", e.target.value);
            setParams(next, { replace: true });
          }}
        >
          {Object.entries(COLLECTION_SORTS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <span className="text-xs text-brand-secondary">{tr("不改变首页精选或歌单播放顺序")}</span>
      </div>
      {kind === "track" ? (
        <MusicTab items={ofKind} sort={sort} />
      ) : (
        <WatchList
          kind={kind}
          items={ofKind}
          status={status}
          onStatus={(s) => select({ status: s })}
          unrated={unrated}
          onUnrated={(on) => select({ unrated: on })}
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
  onStatus,
  unrated,
  onUnrated
}: {
  kind: WatchKind;
  items: AdminMediaItem[];
  status: MediaStatus | null;
  onStatus: (status: MediaStatus | null) => void;
  unrated: boolean;
  onUnrated: (on: boolean) => void;
}) {
  const [filter, setFilter] = useState("");
  const needle = filter.trim().toLowerCase();
  const visible = ofKind.filter(
    (item) =>
      (!status || item.status === status) &&
      (!unrated || item.rating === null) &&
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
            {s ? statusLabels(kind)[s] : tr("全部")}{" "}
            {s ? ofKind.filter((item) => item.status === s).length : ofKind.length}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={unrated}
          onClick={() => onUnrated(!unrated)}
          className={`chip ${unrated ? "border-brand bg-brand/10 text-brand" : ""}`}
        >
          {tr(
            "未评分 {0}",
            ofKind.filter((item) => (!status || item.status === status) && item.rating === null)
              .length
          )}
        </button>
        <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-60">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint"
            />
            <input
              className="field pl-9"
              placeholder={tr("筛选标题")}
              aria-label={tr("筛选标题")}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          {visible.length && !selection.active ? (
            <button type="button" className="btn-secondary shrink-0" onClick={selection.start}>
              {tr("选择")}
            </button>
          ) : null}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="card p-10 text-center text-[13.5px] text-muted">
          {ofKind.length
            ? tr("没有符合条件的条目")
            : tr("还没有{0}，点击“添加{1}”开始", KIND_LABELS[kind], KIND_LABELS[kind])}
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
  const title = pickText(item.title, tr("未命名"));
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
              <EyeOff aria-hidden="true" className="size-3" /> {tr("隐藏")}
            </span>
          ) : null}
          {item.featured ? (
            <span className="chip inline-flex items-center gap-1 bg-surface/90">
              <Star aria-hidden="true" className="size-3" /> {tr("精选")}
            </span>
          ) : null}
        </div>
      </div>
      <div className="space-y-1 p-3">
        <Tooltip content={title} describe={false} className="block min-w-0">
          <p className="truncate text-[13.5px] font-semibold text-brand-dark group-hover:text-brand">
            {title}
          </p>
        </Tooltip>
        <div className="flex items-center justify-between gap-2 text-[12px] text-subtle">
          <span>
            {item.year ?? "—"}
            {views ? (
              <Tooltip content={tr("近 30 天")} describe={false}>
                <span className="ml-1.5 text-faint">{tr("· {0} 次浏览", views)}</span>
              </Tooltip>
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
      aria-label={tr("选择 {0}", title)}
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
      setError(e instanceof Error ? e.message : tr("搜索失败"));
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
            e instanceof ApiError && e.code === "MEDIA_EXISTS"
              ? tr("这个条目已在收藏中")
              : e.message
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
    <Dialog open title={tr("添加{0}", KIND_LABELS[kind])} onClose={onClose}>
      <form onSubmit={search} className="flex flex-wrap items-end gap-2">
        {sources.length > 1 ? (
          <Field label={tr("资料来源")} htmlFor="media-source">
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
          label={tr("在 {0} 搜索", SOURCE_LABELS[source])}
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
          {searching ? tr("搜索中…") : tr("搜索")}
        </button>
      </form>

      {!sourceReady ? (
        <p className="mt-3 text-[12.5px] text-status-warn">
          {tr(
            "未配置 {0}，暂时只能手动添加。",
            source === "tmdb"
              ? "TMDB_API_KEY"
              : source === "igdb"
                ? "TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET"
                : "GOOGLE_BOOKS_API_KEY"
          )}
          <Link to="/integrations" className="text-brand underline">
            {tr("前往 API 配置")}
          </Link>
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
                        {result.mediaType === "movie" ? tr("剧场版") : "TV"}
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
                    {tr("已添加，打开")}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="btn-primary shrink-0"
                    disabled={importMedia.isPending}
                    onClick={() => add(result)}
                  >
                    {importMedia.isPending && importMedia.variables?.sourceId === result.sourceId
                      ? tr("添加中…")
                      : tr("添加")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[13px] text-muted">
            {tr("没有找到，换个关键词试试，或者在下面手动添加。")}
          </p>
        )
      ) : null}

      <form
        onSubmit={addManually}
        className="mt-5 flex flex-wrap items-end gap-2 border-t border-line-soft pt-4"
      >
        <Field
          label={tr("搜不到？手动添加")}
          htmlFor="media-manual-title"
          hint={tr("之后在编辑页补充资料和海报")}
          className="min-w-0 flex-1"
        >
          <input
            id="media-manual-title"
            className="field"
            value={manualTitle}
            maxLength={200}
            placeholder={tr("标题（简体中文）")}
            onChange={(e) => setManualTitle(e.target.value)}
          />
        </Field>
        <button
          type="submit"
          className="btn-secondary"
          disabled={!manualTitle.trim() || createMedia.isPending}
        >
          {createMedia.isPending ? tr("创建中…") : tr("手动添加")}
        </button>
      </form>
    </Dialog>
  );
}

/** What each source finds best. */
const SEARCH_HINTS: Record<MediaSearchSource, string> = {
  tmdb: tr("片名，中文、英文或原名都可以"),
  bangumi: tr("中文名或日文原名"),
  openlibrary: tr("书名或作者，英文和原文书名最容易找到"),
  googlebooks: tr("书名、作者或 ISBN，中文书也很全"),
  anilist: tr("日文原名、罗马音或英文名"),
  igdb: tr("游戏英文名最容易找到")
};

function SettingsDialog({
  settings,
  onClose
}: {
  settings: CollectionSettings;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => ({
    ...settings,
    featuredWall: resolveFeaturedWall(settings.featuredWall)
  }));
  const update = useUpdateCollectionSettings();
  const toast = useToast();
  const kinds = [
    ...WATCH_KINDS.map((k) => [k, KIND_LABELS[k]] as const),
    ["music", tr("音乐")] as const,
    ["people", tr("人物")] as const
  ];

  const save = () => {
    const wall = draft.featuredWall;
    if (
      !Number.isInteger(wall.visibleRows) ||
      wall.visibleRows < 1 ||
      wall.visibleRows > 8 ||
      !Number.isInteger(wall.targetRowHeight) ||
      wall.targetRowHeight < 100 ||
      wall.targetRowHeight > 360
    ) {
      toast(tr("展示行数须为 1–8 的整数；目标行高须为 100–360px 的整数。"), "error");
      return;
    }
    update.mutate(draft, {
      onSuccess: () => {
        toast(tr("已保存"));
        onClose();
      },
      onError: (e) => toast(e.message, "error")
    });
  };

  return (
    <Dialog
      open
      size="sm"
      title={tr("显示设置")}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {tr("取消")}
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={update.isPending}>
            {update.isPending ? tr("保存中…") : tr("保存")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-[12.5px] font-medium text-brand-dark">{tr("在网站上显示")}</p>
          {/* As many columns as fit (4 in the dialog, 3 on a narrow phone): two short rows, not one long one. */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-x-3 gap-y-3">
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
            label={tr("显示“想看”的条目")}
          />
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-faint">
            {tr(
              "关闭后，所有“想看”条目都不在网站上显示；打开时，每个条目再按自己的“公开”设置决定。"
            )}
          </p>
        </div>
        <fieldset className="border-t border-line-soft pt-4">
          {/* Floated so the legend sits below the divider instead of on it. */}
          <legend className="float-left mb-2 w-full text-[12.5px] font-medium text-brand-dark">
            {tr("首页精选")}
          </legend>
          <div className="clear-both space-y-2">
            {(
              [
                ["fixed", tr("固定"), tr("严格按“首页精选”里的顺序分行，不自动混排或打乱。")],
                [
                  "daily",
                  tr("每天"),
                  tr("每天换一批开头并混排音乐与其他收藏，同一天所有访客看到的一样。")
                ],
                [
                  "visit",
                  tr("每次访问"),
                  tr("每次打开首页换一批开头，不会连续两次相同；同样混排。")
                ],
                [
                  "session",
                  tr("每个浏览会话"),
                  tr("同一个标签页里保持不变，下次打开网站换一批；同样混排。")
                ]
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${draft.homeFeatured === value ? "border-brand bg-brand/5" : "border-line"}`}
              >
                <input
                  type="radio"
                  name="home-featured"
                  value={value}
                  checked={draft.homeFeatured === value}
                  onChange={() => setDraft((d) => ({ ...d, homeFeatured: value }))}
                  className="mt-1 accent-[var(--color-brand)]"
                />
                <span>
                  <span className="block text-[13px] font-semibold text-brand-dark">{label}</span>
                  <span className="block text-[12px] leading-relaxed text-subtle">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="space-y-3.5 border-t border-line-soft pt-4">
          <p className="text-[12.5px] font-medium text-brand-dark">{tr("精选拼布墙")}</p>
          <Field
            label={tr("展示行数 · Visible Rows")}
            htmlFor="featured-wall-rows"
            hint={tr("控制精选海报墙最多展示的行数。实际展示数量随页面宽度和图片比例自动调整。")}
          >
            <input
              id="featured-wall-rows"
              className="field"
              type="number"
              min={1}
              max={8}
              step={1}
              value={draft.featuredWall.visibleRows}
              onChange={(event) =>
                setDraft((old) => ({
                  ...old,
                  featuredWall: { ...old.featuredWall, visibleRows: Number(event.target.value) }
                }))
              }
            />
          </Field>
          <Field
            label={tr("目标行高 · Target Row Height（px）")}
            htmlFor="featured-wall-height"
            hint={tr(
              "用于计算每行图片的理想高度。实际行高可能略有调整，以保证所有图片完整展示且无缝拼接。"
            )}
          >
            <input
              id="featured-wall-height"
              className="field"
              type="number"
              min={100}
              max={360}
              step={10}
              value={draft.featuredWall.targetRowHeight}
              onChange={(event) =>
                setDraft((old) => ({
                  ...old,
                  featuredWall: { ...old.featuredWall, targetRowHeight: Number(event.target.value) }
                }))
              }
            />
          </Field>
          <a
            className="inline-flex text-[12px] font-medium text-brand hover:underline"
            href="/#/#watching"
            target="_blank"
            rel="noreferrer"
          >
            {tr("打开主页收藏近况 ↗")}
          </a>
        </div>
      </div>
    </Dialog>
  );
}
