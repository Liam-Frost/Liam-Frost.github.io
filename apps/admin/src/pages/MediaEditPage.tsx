import type { AdminMediaItem, AdminMediaUpdate, LocalizedText, MediaStatus } from "@liam-frost/shared";
import { ArrowLeft, Clapperboard, ExternalLink, ImagePlus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { Dialog } from "../components/ui/Dialog";
import { Field, Switch } from "../components/ui/Field";
import { Panel } from "../components/ui/Panel";
import { StarRating } from "../components/ui/StarRating";
import { useToast } from "../components/ui/Toast";
import { useDeleteMedia, useMediaItem, useUpdateMedia, useUploadMediaPoster } from "../hooks/useMedia";
import { ApiError } from "../lib/api";
import { KIND_LABELS, LANG_LABELS, LANGS, MEDIA_STATUS_LABELS, pickText, SOURCE_LABELS, type Lang, type WatchKind } from "../lib/i18n";

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
  const kind = item.kind as WatchKind;
  const hasEpisodes = kind !== "movie";
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
      return setError("集数进度无效");
    }
    if (watched !== null && total !== null && watched > total) return setError("已看集数超过总集数");
    setError("");

    const body: AdminMediaUpdate = {
      title: draft.title,
      originalTitle: draft.originalTitle,
      year,
      genres: draft.genres,
      credits: draft.credits,
      overview: draft.overview,
      status: draft.status,
      rating: draft.rating,
      review: draft.review,
      watchedOn: draft.watchedOn || null,
      rewatchCount,
      progress: hasEpisodes && (watched !== null || total !== null) ? { watched: watched ?? 0, total } : null,
      featured: draft.featured,
      visibility: draft.visibility
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
          <span className="chip ml-2 align-middle">{KIND_LABELS[kind]}</span>
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
          <Panel title="我的记录">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="状态" htmlFor="media-status">
                <select id="media-status" className="field" value={draft.status} onChange={(e) => set("status", e.target.value as MediaStatus)}>
                  {(Object.keys(MEDIA_STATUS_LABELS) as MediaStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {MEDIA_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </Field>
              <div>
                <p className="mb-1.5 text-[12.5px] font-medium text-brand-dark">评分</p>
                <StarRating value={draft.rating} onChange={(value) => set("rating", value)} />
              </div>
              <Field label="看完的日期" htmlFor="media-watched-on">
                <div className="flex gap-2">
                  <input id="media-watched-on" type="date" className="field" value={draft.watchedOn} max={today()} onChange={(e) => set("watchedOn", e.target.value)} />
                  <button type="button" className="btn-secondary shrink-0" onClick={() => set("watchedOn", today())}>
                    今天
                  </button>
                </div>
              </Field>
              <Field label="重看次数" htmlFor="media-rewatch">
                <input id="media-rewatch" type="number" min={0} max={999} className="field w-28" value={draft.rewatchCount} onChange={(e) => set("rewatchCount", e.target.value)} />
              </Field>
              {hasEpisodes ? (
                <Field label="集数进度" htmlFor="media-watched" hint="已看 / 总集数，总集数未知可留空">
                  <div className="flex items-center gap-2">
                    <input id="media-watched" type="number" min={0} className="field w-24" aria-label="已看集数" value={draft.watched} onChange={(e) => set("watched", e.target.value)} />
                    <span className="text-subtle">/</span>
                    <input type="number" min={1} className="field w-24" aria-label="总集数" value={draft.total} onChange={(e) => set("total", e.target.value)} />
                  </div>
                </Field>
              ) : null}
            </div>
          </Panel>

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
              <Field label="简介" htmlFor="media-overview" hint={item.source !== "manual" ? `导入自 ${SOURCE_LABELS[item.source]}，可以修改` : undefined}>
                <textarea id="media-overview" rows={5} className="field resize-y leading-relaxed" value={draft.overview[lang] ?? ""} maxLength={5000} onChange={(e) => setText("overview", e.target.value)} />
              </Field>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <PosterPanel item={item} />

          <Panel title="发布">
            <div className="flex flex-col items-start gap-2.5">
              <Switch id="media-public" checked={draft.visibility === "public"} onChange={(on) => set("visibility", on ? "public" : "private")} label="公开显示" />
              <Switch id="media-featured" checked={draft.featured} onChange={(on) => set("featured", on)} label="首页精选" />
            </div>
            {draft.status === "want" ? <p className="text-[11.5px] leading-relaxed text-faint">“想看”的条目还受“显示设置”里的总开关控制。</p> : null}
          </Panel>

          <Panel title="资料">
            <Field label="原名" htmlFor="media-original">
              <input id="media-original" className="field" value={draft.originalTitle} maxLength={200} onChange={(e) => set("originalTitle", e.target.value)} />
            </Field>
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
              label={kind === "anime" ? "导演 / 制作" : "导演 / 主创"}
              hint="回车添加"
              values={draft.credits}
              input={creditInput}
              onInput={setCreditInput}
              onAdd={addCredit}
              onRemove={(index) => set("credits", draft.credits.filter((_, i) => i !== index))}
            />
            {item.sourceUrl ? (
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

  return (
    <Panel title="海报">
      {item.poster ? (
        <img src={item.poster.variants[item.poster.variants.length - 1].url} alt="" className="mx-auto w-full max-w-[220px] rounded-xl border border-line object-cover" style={{ aspectRatio: "2 / 3" }} />
      ) : (
        <span className="mx-auto flex aspect-[2/3] w-full max-w-[220px] items-center justify-center rounded-xl bg-line-soft text-faint">
          <Clapperboard aria-hidden="true" className="size-8" />
        </span>
      )}
      <button type="button" className="btn-secondary w-full" disabled={upload.isPending} onClick={() => input.current?.click()}>
        <ImagePlus aria-hidden="true" className="size-4" />
        {upload.isPending ? "上传中…" : item.poster ? "更换海报" : "上传海报"}
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) upload.mutate(file, { onSuccess: () => toast("海报已更新"), onError: (err) => toast(err.message, "error") });
        }}
      />
    </Panel>
  );
}
