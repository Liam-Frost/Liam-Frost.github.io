import type { AdminPerson, LocalizedText } from "@liam-frost/shared";
import { ArrowLeft, ExternalLink, ImagePlus, Trash2, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { RelationsPanel } from "../components/relations/RelationsPanel";
import { Dialog } from "../components/ui/Dialog";
import { Field, Switch } from "../components/ui/Field";
import { Panel } from "../components/ui/Panel";
import { useToast } from "../components/ui/Toast";
import {
  useDeletePerson,
  usePerson,
  useUpdatePerson,
  useUploadPersonPhoto
} from "../hooks/usePeople";
import { ApiError } from "../lib/api";
import { LANG_LABELS, LANGS, pickText, type Lang } from "../lib/i18n";

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/tiff";

type Draft = {
  name: LocalizedText;
  originalName: string;
  bio: LocalizedText;
  links: string[];
  featured: boolean;
  visibility: AdminPerson["visibility"];
};

const toDraft = (person: AdminPerson): Draft => ({
  name: person.name,
  originalName: person.originalName ?? "",
  bio: person.bio,
  links: person.links,
  featured: person.featured,
  visibility: person.visibility
});

export function PersonEditPage() {
  const { id = "" } = useParams();
  const { data: person, isPending, error } = usePerson(id);

  if (isPending) return <p className="py-10 text-center text-[13px] text-subtle">加载中…</p>;
  if (error || !person) {
    return (
      <div className="card p-6 text-[13.5px]">
        <p role="alert" className="mb-3 text-status-error">
          {error instanceof ApiError && error.status === 404
            ? "人物不存在"
            : (error?.message ?? "无法加载人物")}
        </p>
        <Link to="/people" className="btn-secondary">
          返回人物
        </Link>
      </div>
    );
  }
  return <PersonEditor key={person.id} person={person} />;
}

function PersonEditor({ person }: { person: AdminPerson }) {
  const [draft, setDraft] = useState(() => toDraft(person));
  const [saved, setSaved] = useState(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const [lang, setLang] = useState<Lang>("zh");
  const [linkInput, setLinkInput] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const update = useUpdatePerson(person.id);
  const remove = useDeletePerson();
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const setText = (field: "name" | "bio", value: string) =>
    setDraft((d) => ({ ...d, [field]: { ...d[field], [lang]: value } }));

  const addLink = () => {
    const value = linkInput.trim();
    if (!value) return;
    if (!/^https:\/\/\S+$/.test(value)) return setError("链接需要以 https:// 开头");
    if (draft.links.length < 10 && !draft.links.includes(value))
      set("links", [...draft.links, value]);
    setLinkInput("");
    setError("");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!Object.values(draft.name).some((t) => t?.trim()))
      return setError("请至少用一种语言填写名字");
    setError("");
    update.mutate(
      {
        name: draft.name,
        originalName: draft.originalName,
        bio: draft.bio,
        links: draft.links,
        featured: draft.featured,
        visibility: draft.visibility
      },
      {
        onSuccess: ({ person: next }) => {
          const normalized = toDraft(next);
          setDraft(normalized);
          setSaved(normalized);
          toast("已保存");
        },
        onError: (e) => setError(e.message)
      }
    );
  };

  const name = pickText(draft.name, "未命名");

  return (
    <form onSubmit={submit} noValidate>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          to="/people"
          className="rounded-full p-1.5 text-subtle hover:bg-brand-secondary/12 hover:text-brand"
          aria-label="返回人物"
          onClick={(e) => {
            if (dirty && !window.confirm("有未保存的修改，确定离开吗？")) e.preventDefault();
          }}
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-[22px] font-semibold text-brand-dark">
          {name}
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
        <p
          role="alert"
          className="mb-4 rounded-xl border border-status-error/30 bg-status-error/8 px-4 py-2.5 text-[12.5px] text-status-error"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
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
                  {draft.name[l]?.trim() ? " ✓" : ""}
                </button>
              ))}
            </div>
            <p className="mb-4 text-[11.5px] text-faint">
              没填写的语言会在网站上回退到其它语言。标签后带 ✓ 表示该语言已有名字。
            </p>
            <div className="space-y-3.5">
              <Field label="名字" htmlFor="person-name">
                <input
                  id="person-name"
                  className="field"
                  value={draft.name[lang] ?? ""}
                  maxLength={120}
                  onChange={(e) => setText("name", e.target.value)}
                />
              </Field>
              <Field
                label="简介"
                htmlFor="person-bio"
                hint={person.source === "tmdb" ? "导入自 TMDB，可以修改" : undefined}
              >
                <textarea
                  id="person-bio"
                  rows={6}
                  className="field resize-y leading-relaxed"
                  value={draft.bio[lang] ?? ""}
                  maxLength={5000}
                  onChange={(e) => setText("bio", e.target.value)}
                />
              </Field>
            </div>
          </section>

          <RelationsPanel subject={{ type: "person", id: person.id }} />
        </div>

        <div className="space-y-5">
          <PhotoPanel person={person} />

          <Panel title="发布">
            <div className="flex flex-col items-start gap-2.5">
              <Switch
                id="person-public"
                checked={draft.visibility === "public"}
                onChange={(on) => set("visibility", on ? "public" : "private")}
                label="公开显示"
              />
              <Switch
                id="person-featured"
                checked={draft.featured}
                onChange={(on) => set("featured", on)}
                label="精选"
              />
            </div>
            <p className="text-[11.5px] leading-relaxed text-faint">
              网站只显示参与了公开条目的人物。
            </p>
          </Panel>

          <Panel title="资料">
            <Field label="原名" htmlFor="person-original" hint="母语写法，例如“宮崎駿”">
              <input
                id="person-original"
                className="field"
                value={draft.originalName}
                maxLength={120}
                onChange={(e) => set("originalName", e.target.value)}
              />
            </Field>
            <Field label="链接" htmlFor="person-links" hint="官网、维基百科、Spotify 等，回车添加">
              {draft.links.length ? (
                <ul className="mb-2 space-y-1">
                  {draft.links.map((link) => (
                    <li key={link} className="flex items-center gap-2 text-[12.5px]">
                      <a
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 flex-1 truncate text-brand hover:underline"
                      >
                        {link}
                      </a>
                      <button
                        type="button"
                        aria-label={`删除 ${link}`}
                        className="rounded-full p-0.5 text-faint hover:text-status-error"
                        onClick={() =>
                          set(
                            "links",
                            draft.links.filter((l) => l !== link)
                          )
                        }
                      >
                        <X aria-hidden="true" className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <input
                id="person-links"
                className="field"
                value={linkInput}
                maxLength={2048}
                placeholder="https://"
                onChange={(e) => setLinkInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLink();
                  }
                }}
                onBlur={addLink}
              />
            </Field>
            {person.sourceUrl ? (
              <a
                href={person.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[12.5px] text-brand hover:underline"
              >
                在 TMDB 查看 <ExternalLink aria-hidden="true" className="size-3.5" />
              </a>
            ) : null}
          </Panel>

          <button type="button" className="btn-danger w-full" onClick={() => setDeleting(true)}>
            <Trash2 aria-hidden="true" className="size-4" /> 删除人物
          </button>
        </div>
      </div>

      <Dialog
        open={deleting}
        size="sm"
        title="删除人物"
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
                remove.mutate(person.id, {
                  onSuccess: () => {
                    toast("已删除");
                    navigate("/people");
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
        <p className="text-[13.5px] leading-relaxed text-muted">
          确定删除“{name}”吗？照片和 TA 与作品的关联都会删除，作品本身不受影响。此操作无法撤销。
        </p>
      </Dialog>
    </form>
  );
}

/** The photo saves immediately on upload, independent of the text form. */
function PhotoPanel({ person }: { person: AdminPerson }) {
  const upload = useUploadPersonPhoto(person.id);
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);

  return (
    <Panel title="照片">
      {person.photo ? (
        <img
          src={person.photo.variants[person.photo.variants.length - 1].url}
          alt=""
          className="mx-auto aspect-square w-full max-w-[220px] rounded-xl border border-line object-cover"
        />
      ) : (
        <span className="mx-auto flex aspect-square w-full max-w-[220px] items-center justify-center rounded-xl bg-line-soft text-faint">
          <UserRound aria-hidden="true" className="size-8" />
        </span>
      )}
      <button
        type="button"
        className="btn-secondary w-full"
        disabled={upload.isPending}
        onClick={() => input.current?.click()}
      >
        <ImagePlus aria-hidden="true" className="size-4" />
        {upload.isPending ? "上传中…" : person.photo ? "更换照片" : "上传照片"}
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file)
            upload.mutate(file, {
              onSuccess: () => toast("照片已更新"),
              onError: (err) => toast(err.message, "error")
            });
        }}
      />
    </Panel>
  );
}
