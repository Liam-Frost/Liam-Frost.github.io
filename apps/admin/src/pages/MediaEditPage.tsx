import type { AdminMediaItem, AdminMediaUpdate, LocalizedText, MediaStatus } from "@liam-frost/shared";
import { ArrowLeft, Clapperboard, ExternalLink, ImagePlus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { FixPreviewDialog, PreviewButton, usePreview } from "../components/music/MusicTools";
import { RelationsPanel } from "../components/relations/RelationsPanel";
import { Dialog } from "../components/ui/Dialog";
import { Field, Switch } from "../components/ui/Field";
import { Panel } from "../components/ui/Panel";
import { StarRating } from "../components/ui/StarRating";
import { useToast } from "../components/ui/Toast";
import { useDeleteMedia, useMediaItem, useUpdateMedia, useUploadMediaPoster } from "../hooks/useMedia";
import { ApiError } from "../lib/api";
import {
  COLLECTION_KIND_LABELS,
  formatDuration,
  isReadKind,
  LANG_LABELS,
  LANGS,
  MEDIA_STATUS_LABELS,
  pickText,
  SOURCE_LABELS,
  statusLabels,
  type CollectionKind,
  type Lang
} from "../lib/i18n";

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/tiff";

type Draft = {
  title: LocalizedText;
  originalTitle: string;
  year: string;
  genres: LocalizedText[];
  credits: string[];
  overview: LocalizedText;
  status: MediaStatus;
  rating: number | null;
  review: LocalizedText;
  watchedOn: string;
  rewatchCount: string;
  watched: string;
  total: string;
  album: string;
  publisher: string;
  pages: string;
  volumes: string;
  ongoing: "" | "yes" | "no";
  inPlayer: boolean;
  featured: boolean;
  visibility: AdminMediaItem["visibility"];
};

function toDraft(item: AdminMediaItem): Draft {
  return {
    title: item.title,
    originalTitle: item.originalTitle ?? "",
    year: item.year ? String(item.year) : "",
    genres: item.genres,
    credits: item.credits,
    overview: item.overview,
    status: item.status ?? "done",
    rating: item.rating,
    review: item.review,
    watchedOn: item.watchedOn ?? "",
    rewatchCount: String(item.rewatchCount),
    watched: item.progress ? String(item.progress.watched) : "",
    total: item.progress?.total ? String(item.progress.total) : "",
    album: item.music?.album ?? "",
    publisher: item.publication?.publisher ?? "",
    pages: item.publication?.pages ? String(item.publication.pages) : "",
    volumes: item.publication?.volumes ? String(item.publication.volumes) : "",
    ongoing: item.publication?.ongoing === true ? "yes" : item.publication?.ongoing === false ? "no" : "",
    inPlayer: item.inPlayer,
    featured: item.featured,
    visibility: item.visibility
  };
}

const today = () => new Date().toLocaleDateString("sv-SE");

export function MediaEditPage() {
  const { id = "" } = useParams();
  const { data: item, isPending, error } = useMediaItem(id);

  if (isPending) return <p className="py-10 text-center text-[13px] text-subtle">加载中…</p>;
  if (error || !item) {
    return (
      <div className="card p-6 text-[13.5px]">
        <p role="alert" className="mb-3 text-status-error">
          {error instanceof ApiError && error.status === 404 ? "条目不存在" : (error?.message ?? "无法加载条目")}
        </p>
        <Link to="/collection" className="btn-secondary">
          返回收藏
        </Link>
      </div>
    );
  }
  return <MediaEditor key={item.id} item={item} />;
}

function MediaEditor({ item }: { item: AdminMediaItem }) {
  const [draft, setDraft] = useState(() => toDraft(item));
  const [saved, setSaved] = useState(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const [lang, setLang] = useState<Lang>("zh");
  const [error, setError] = useState("");
  const [genreInput, setGenreInput] = useState("");
  const [creditInput, setCreditInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const update = useUpdateMedia(item.id);
  const remove = useDeleteMedia();
  const navigate = useNavigate();
  const toast = useToast();
  const kind = item.kind as CollectionKind;
  const isMusic = kind === "track";
  const isRead = isReadKind(kind);
  // Progress: episodes of series and anime, volumes of comics, pages of books.
  const hasEpisodes = kind === "tv" || kind === "anime" || isRead;
  const unit = kind === "comic" ? "卷" : kind === "book" ? "页" : "集";
  const [fixingPreview, setFixingPreview] = useState(false);
  const preview = usePreview();
  const backTo = `/collection?kind=${kind}`;

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setText = (field: "title" | "overview" | "review", value: string) => setDraft((d) => ({ ...d, [field]: { ...d[field], [lang]: value } }));

  const addGenre = () => {
    const value = genreInput.trim();
    if (value && draft.genres.length < 20 && !draft.genres.some((g) => pickText(g) === value)) set("genres", [...draft.genres, { [lang]: value }]);
    setGenreInput("");
  };
  const addCredit = () => {
    const value = creditInput.trim();
    if (value && draft.credits.length < 20 && !draft.credits.includes(value)) set("credits", [...draft.credits, value]);
    setCreditInput("");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!Object.values(draft.title).some((t) => t?.trim())) return setError("请至少用一种语言填写标题");
    const year = draft.year.trim() ? Number(draft.year) : null;
    if (year !== null && !(Number.isInteger(year) && year >= 1870 && year <= 2100)) return setError("年份无效");
    const rewatchCount = Number(draft.rewatchCount || 0);
    if (!Number.isInteger(rewatchCount) || rewatchCount < 0) return setError("重看次数无效");
    const watched = draft.watched.trim() ? Number(draft.watched) : null;
    const total = draft.total.trim() ? Number(draft.total) : null;
    if ((watched !== null && !(Number.isInteger(watched) && watched >= 0)) || (total !== null && !(Number.isInteger(total) && total >= 1))) {
      return setError(`${unit}数进度无效`);
    }
    if (watched !== null && total !== null && watched > total) return setError(`进度超过总${unit}数`);
    const optionalCount = (text: string) => (text.trim() ? Number(text) : null);
    const pages = optionalCount(draft.pages);
    const volumes = optionalCount(draft.volumes);
    if ([pages, volumes].some((n) => n !== null && !(Number.isInteger(n) && n >= 1))) return setError("页数和卷数需要是正整数");
    setError("");

    const shared: AdminMediaUpdate = {
      title: draft.title,
      year,
      genres: draft.genres,
      credits: draft.credits,
      rating: draft.rating,
      review: draft.review,
      featured: draft.featured,
      visibility: draft.visibility
    };
    // Songs have no watch status, dates or episodes; films, series and anime have no music details.
    const body: AdminMediaUpdate = isMusic
      ? { ...shared, inPlayer: draft.inPlayer, music: { album: draft.album } }
      : {
          ...shared,
          originalTitle: draft.originalTitle,
          overview: draft.overview,
          status: draft.status,
          watchedOn: draft.watchedOn || null,
          rewatchCount,
          progress: hasEpisodes && (watched !== null || total !== null) ? { watched: watched ?? 0, total } : null,
          ...(isRead
            ? { publication: { publisher: draft.publisher, pages, volumes, ongoing: draft.ongoing === "" ? null : draft.ongoing === "yes" } }
            : {})
        };
    update.mutate(body, {
      onSuccess: ({ item: next }) => {
        const normalized = toDraft(next);
        setDraft(normalized);
        setSaved(normalized);
        toast("已保存");
      },
      onError: (e) => setError(e.message)
    });
  };

  const title = pickText(draft.title, "未命名");

  return (
    <form onSubmit={submit} noValidate>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          to={backTo}
          className="rounded-full p-1.5 text-subtle hover:bg-brand-secondary/12 hover:text-brand"
          aria-label="返回收藏"
          onClick={(e) => {
            if (dirty && !window.confirm("有未保存的修改，确定离开吗？")) e.preventDefault();
          }}
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-[22px] font-semibold text-brand-dark">
          {title}
          <span className="chip ml-2 align-middle">{COLLECTION_KIND_LABELS[kind]}</span>
        </h1>
        {dirty ? (
          <span className="text-[12.5px] text-status-warn" role="status">
            有未保存的修改
          </span>
        ) : null}
        <button type="submit" className="btn-primary" disabled={update.isPending}>
          {update.isPending ? "保存中…" : "保存"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mb-4 rounded-xl border border-status-error/30 bg-status-error/8 px-4 py-2.5 text-[12.5px] text-status-error">
          {error}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          {isMusic ? (
            <Panel title="我的记录">
              <div className="grid gap-3.5 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium text-brand-dark">评分</p>
                  <StarRating value={draft.rating} onChange={(value) => set("rating", value)} />
                </div>
                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium text-brand-dark">播放器</p>
                  <Switch
                    id="media-in-player"
                    checked={draft.inPlayer}
                    onChange={(on) => {
                      if (on && !item.music?.previewUrl) return setError("这首歌还没有试听，先在右侧“试听”里选一个");
                      set("inPlayer", on);
                    }}
                    label="加入网站播放器"
                  />
                </div>
              </div>
            </Panel>
          ) : (
          <Panel title="我的记录">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="状态" htmlFor="media-status">
                <select id="media-status" className="field" value={draft.status} onChange={(e) => set("status", e.target.value as MediaStatus)}>
                  {(Object.keys(MEDIA_STATUS_LABELS) as MediaStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {statusLabels(kind)[status]}
                    </option>
                  ))}
                </select>
              </Field>
              <div>
                <p className="mb-1.5 text-[12.5px] font-medium text-brand-dark">评分</p>
                <StarRating value={draft.rating} onChange={(value) => set("rating", value)} />
              </div>
              <Field label={isRead ? "读完的日期" : "看完的日期"} htmlFor="media-watched-on">
                <div className="flex gap-2">
                  <input id="media-watched-on" type="date" className="field" value={draft.watchedOn} max={today()} onChange={(e) => set("watchedOn", e.target.value)} />
                  <button type="button" className="btn-secondary shrink-0" onClick={() => set("watchedOn", today())}>
                    今天
                  </button>
                </div>
              </Field>
              <Field label={isRead ? "重读次数" : "重看次数"} htmlFor="media-rewatch">
                <input id="media-rewatch" type="number" min={0} max={999} className="field w-28" value={draft.rewatchCount} onChange={(e) => set("rewatchCount", e.target.value)} />
              </Field>
              {hasEpisodes ? (
                <Field label={`${unit}数进度`} htmlFor="media-watched" hint={`${isRead ? "已读" : "已看"} / 总${unit}数，总${unit}数未知可留空`}>
                  <div className="flex items-center gap-2">
                    <input id="media-watched" type="number" min={0} className="field w-24" aria-label={`${isRead ? "已读" : "已看"}${unit}数`} value={draft.watched} onChange={(e) => set("watched", e.target.value)} />
                    <span className="text-subtle">/</span>
                    <input type="number" min={1} className="field w-24" aria-label={`总${unit}数`} value={draft.total} onChange={(e) => set("total", e.target.value)} />
                  </div>
                </Field>
              ) : null}
            </div>
          </Panel>
          )}

          <section className="card min-w-0 p-5" aria-label="文字">
            <div role="tablist" aria-label="语言" className="mb-3 flex flex-wrap gap-1.5">
              {LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  role="tab"
                  aria-selected={lang === l}
                  onClick={() => setLang(l)}
                  className={`rounded-full px-3 py-1.5 text-[12.5px] transition-colors ${lang === l ? "bg-brand text-white" : "bg-brand-secondary/10 text-brand hover:bg-brand-secondary/18"}`}
                >
                  {LANG_LABELS[l]}
                  {draft.review[l]?.trim() ? " ✓" : ""}
                </button>
              ))}
            </div>
            <p className="mb-4 text-[11.5px] text-faint">没填写的语言会在网站上回退到其它语言。标签后带 ✓ 表示该语言已写短评。</p>
            <div className="space-y-3.5">
              <Field label="标题" htmlFor="media-title">
                <input id="media-title" className="field" value={draft.title[lang] ?? ""} maxLength={200} onChange={(e) => setText("title", e.target.value)} />
              </Field>
              <Field label="短评" htmlFor="media-review" hint="你自己的感受，会显示在网站上">
                <textarea id="media-review" rows={5} className="field resize-y leading-relaxed" value={draft.review[lang] ?? ""} maxLength={5000} onChange={(e) => setText("review", e.target.value)} />
              </Field>
              {isMusic ? null : (
                <Field label="简介" htmlFor="media-overview" hint={item.source !== "manual" ? `导入自 ${SOURCE_LABELS[item.source]}，可以修改` : undefined}>
                  <textarea id="media-overview" rows={5} className="field resize-y leading-relaxed" value={draft.overview[lang] ?? ""} maxLength={5000} onChange={(e) => setText("overview", e.target.value)} />
                </Field>
              )}
            </div>
          </section>

          <RelationsPanel subject={{ type: "media", id: item.id, kind: item.kind }} />
        </div>

        <div className="space-y-5">
          <PosterPanel item={item} />

          {isMusic ? (
            <Panel title="试听">
              {item.music?.previewUrl ? (
                <div className="flex items-center gap-3">
                  <PreviewButton url={item.music.previewUrl} preview={preview} />
                  <span className="truncate text-[12.5px] text-subtle">
                    {new URL(item.music.previewUrl).hostname.includes("itunes") ? "来自 iTunes" : "来自 Spotify"}
                    {item.music.durationMs ? ` · 全曲 ${formatDuration(item.music.durationMs)}` : ""}
                  </span>
                </div>
              ) : (
                <p className="text-[12.5px] text-status-warn">没有试听，不能加入播放器。</p>
              )}
              <button type="button" className="btn-secondary w-full" onClick={() => setFixingPreview(true)}>
                {item.music?.previewUrl ? "换一个试听" : "找试听"}
              </button>
              <div className="flex flex-wrap gap-3 text-[12.5px]">
                {item.music?.spotifyUrl ? (
                  <a href={item.music.spotifyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
                    Spotify <ExternalLink aria-hidden="true" className="size-3.5" />
                  </a>
                ) : null}
                {item.music?.appleUrl ? (
                  <a href={item.music.appleUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
                    Apple Music <ExternalLink aria-hidden="true" className="size-3.5" />
                  </a>
                ) : null}
              </div>
            </Panel>
          ) : null}

          <Panel title="发布">
            <div className="flex flex-col items-start gap-2.5">
              <Switch id="media-public" checked={draft.visibility === "public"} onChange={(on) => set("visibility", on ? "public" : "private")} label="公开显示" />
              <Switch id="media-featured" checked={draft.featured} onChange={(on) => set("featured", on)} label="首页精选" />
            </div>
            {draft.status === "want" ? (
              <p className="text-[11.5px] leading-relaxed text-faint">“{statusLabels(kind).want}”的条目还受“显示设置”里的总开关控制。</p>
            ) : null}
          </Panel>

          <Panel title="资料">
            {isMusic ? (
              <Field label="专辑" htmlFor="media-album">
                <input id="media-album" className="field" value={draft.album} maxLength={200} onChange={(e) => set("album", e.target.value)} />
              </Field>
            ) : (
              <Field label="原名" htmlFor="media-original">
                <input id="media-original" className="field" value={draft.originalTitle} maxLength={200} onChange={(e) => set("originalTitle", e.target.value)} />
              </Field>
            )}
            {isRead ? (
              <>
                <Field label="出版社" htmlFor="media-publisher">
                  <input id="media-publisher" className="field" value={draft.publisher} maxLength={200} onChange={(e) => set("publisher", e.target.value)} />
                </Field>
                {kind === "book" ? (
                  <Field label="页数" htmlFor="media-pages">
                    <input id="media-pages" type="number" min={1} className="field w-28" value={draft.pages} onChange={(e) => set("pages", e.target.value)} />
                  </Field>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="卷数" htmlFor="media-volumes">
                      <input id="media-volumes" type="number" min={1} className="field" value={draft.volumes} onChange={(e) => set("volumes", e.target.value)} />
                    </Field>
                    <Field label="连载" htmlFor="media-ongoing">
                      <select id="media-ongoing" className="field" value={draft.ongoing} onChange={(e) => set("ongoing", e.target.value as Draft["ongoing"])}>
                        <option value="">不注明</option>
                        <option value="yes">连载中</option>
                        <option value="no">已完结</option>
                      </select>
                    </Field>
                  </div>
                )}
              </>
            ) : null}
            <Field label="年份" htmlFor="media-year">
              <input id="media-year" type="number" min={1870} max={2100} className="field w-28" value={draft.year} onChange={(e) => set("year", e.target.value)} />
            </Field>
            <ChipsField
              id="media-genres"
              label="类型"
              hint={`回车添加（${LANG_LABELS[lang]}）`}
              values={draft.genres.map((g) => pickText(g))}
              input={genreInput}
              onInput={setGenreInput}
              onAdd={addGenre}
              onRemove={(index) => set("genres", draft.genres.filter((_, i) => i !== index))}
            />
            <ChipsField
              id="media-credits"
              label={isMusic ? "歌手" : isRead ? "作者" : kind === "anime" ? "导演 / 制作" : "导演 / 主创"}
              hint="回车添加"
              values={draft.credits}
              input={creditInput}
              onInput={setCreditInput}
              onAdd={addCredit}
              onRemove={(index) => set("credits", draft.credits.filter((_, i) => i !== index))}
            />
            {item.sourceUrl && !isMusic ? (
              <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] text-brand hover:underline">
                在 {SOURCE_LABELS[item.source]} 查看 <ExternalLink aria-hidden="true" className="size-3.5" />
              </a>
            ) : null}
          </Panel>

          <button type="button" className="btn-danger w-full" onClick={() => setDeleting(true)}>
            <Trash2 aria-hidden="true" className="size-4" /> 删除条目
          </button>
        </div>
      </div>

      {fixingPreview ? <FixPreviewDialog item={item} onClose={() => setFixingPreview(false)} /> : null}

      <Dialog
        open={deleting}
        size="sm"
        title="删除条目"
        onClose={() => setDeleting(false)}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setDeleting(false)}>
              取消
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(item.id, {
                  onSuccess: () => {
                    toast("已删除");
                    navigate(backTo);
                  },
                  onError: (e) => toast(e.message, "error")
                })
              }
            >
              {remove.isPending ? "删除中…" : "删除"}
            </button>
          </>
        }
      >
        <p className="text-[13.5px] leading-relaxed text-muted">确定删除“{title}”吗？海报和你的记录、短评都会删除，此操作无法撤销。</p>
      </Dialog>
    </form>
  );
}

function ChipsField(props: {
  id: string;
  label: string;
  hint: string;
  values: string[];
  input: string;
  onInput: (value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <Field label={props.label} htmlFor={props.id} hint={props.hint}>
      {props.values.length ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {props.values.map((value, index) => (
            <span key={`${value}-${index}`} className="chip inline-flex items-center gap-1">
              {value}
              <button type="button" aria-label={`删除 ${value}`} onClick={() => props.onRemove(index)} className="rounded-full hover:text-status-error">
                <X aria-hidden="true" className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <input
        id={props.id}
        className="field"
        value={props.input}
        maxLength={100}
        onChange={(e) => props.onInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            props.onAdd();
          }
        }}
        onBlur={props.onAdd}
      />
    </Field>
  );
}

/** The poster saves immediately on upload, independent of the text form. */
function PosterPanel({ item }: { item: AdminMediaItem }) {
  const upload = useUploadMediaPoster(item.id);
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  // Songs have square covers; films, series and anime have 2:3 posters.
  const square = item.kind === "track";
  const noun = square || isReadKind(item.kind) ? "封面" : "海报";

  return (
    <Panel title={noun}>
      {item.poster ? (
        <img src={item.poster.variants[item.poster.variants.length - 1].url} alt="" className="mx-auto w-full max-w-[220px] rounded-xl border border-line object-cover" style={{ aspectRatio: square ? "1 / 1" : "2 / 3" }} />
      ) : (
        <span className={`mx-auto flex ${square ? "aspect-square" : "aspect-[2/3]"} w-full max-w-[220px] items-center justify-center rounded-xl bg-line-soft text-faint`}>
          <Clapperboard aria-hidden="true" className="size-8" />
        </span>
      )}
      <button type="button" className="btn-secondary w-full" disabled={upload.isPending} onClick={() => input.current?.click()}>
        <ImagePlus aria-hidden="true" className="size-4" />
        {upload.isPending ? "上传中…" : item.poster ? `更换${noun}` : `上传${noun}`}
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) upload.mutate(file, { onSuccess: () => toast(`${noun}已更新`), onError: (err) => toast(err.message, "error") });
        }}
      />
    </Panel>
  );
}
