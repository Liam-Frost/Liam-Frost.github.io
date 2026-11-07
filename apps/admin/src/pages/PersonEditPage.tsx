import LoadingSkeleton from "../../../web/src/components/LoadingSkeleton";
import type {
  AdminPerson,
  PersonIdentity,
  PersonKind,
  PersonMembership,
  LocalizedText
} from "@liam-frost/shared";
import { ArrowLeft, ExternalLink, ImagePlus, RefreshCw, Trash2, UserRound, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { MusicCandidatesPanel } from "../components/people/MusicCandidatesPanel";
import { RelationsPanel } from "../components/relations/RelationsPanel";
import { Dialog } from "../components/ui/Dialog";
import { Field, Switch } from "../components/ui/Field";
import { Panel } from "../components/ui/Panel";
import { useToast } from "../components/ui/Toast";
import {
  usePeople,
  useDeletePerson,
  usePerson,
  useUpdatePerson,
  useUploadPersonPhoto
} from "../hooks/usePeople";
import { api, ApiError } from "../lib/api";
import { LANG_LABELS, LANGS, pickText, type Lang } from "../lib/i18n";
import { RecentStats } from "../components/analytics/RecentStats";

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/tiff";

type Draft = {
  members: PersonMembership[];
  kind: PersonKind;
  aliases: string[];
  identities: PersonIdentity[];
  name: LocalizedText;
  originalName: string;
  bio: LocalizedText;
  links: string[];
  featured: boolean;
  visibility: AdminPerson["visibility"];
};

const toDraft = (person: AdminPerson): Draft => ({
  members: person.members ?? [],
  kind: person.kind ?? "person",
  aliases: person.aliases ?? [],
  identities: person.identities ?? [],
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

  if (isPending) return <LoadingSkeleton label="加载中…" variant="form" />;
  if (error || !person) {
    return (
      <div className="card p-6 text-[13.5px]">
        <p role="alert" className="mb-3 text-status-error">
          {error instanceof ApiError && error.status === 404
            ? "人物不存在"
            : (error?.message ?? "无法加载人物")}
        </p>
        <Link to="/collection/people" className="btn-secondary">
          返回人物
        </Link>
      </div>
    );
  }
  return <PersonEditor key={person.id} person={person} />;
}

function PersonEditor({ person }: { person: AdminPerson }) {
  const { data: everyone } = usePeople();
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
  const qc = useQueryClient();
  const sync = useMutation({
    mutationFn: () => api.syncPersonRelations(person.id),
    onSuccess: ({ added }) => {
      toast(added ? `已补齐 ${added} 个关联` : "关联已完整，没有新增关联");
      void qc.invalidateQueries({ queryKey: ["admin", "people"] });
      void qc.invalidateQueries({ queryKey: ["admin", "relations"] });
    },
    onError: (error) => toast(error.message, "error")
  });

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
        members: draft.members,
        kind: draft.kind,
        aliases: draft.aliases.map((s) => s.trim()).filter(Boolean),
        identities: draft.identities,
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
          to="/collection/people"
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
        <RecentStats type="person" id={person.id} />
        <button
          type="button"
          className="btn-secondary"
          disabled={sync.isPending}
          onClick={() => sync.mutate()}
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          {sync.isPending ? "补齐中…" : "补齐作品关联"}
        </button>
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

          {draft.kind !== "person" || draft.members.length ? (
            <Panel title="团体成员">
              <p className="text-xs text-muted">
                成员关系与作品角色独立，不会把成员自动记作乐队全部作品的演唱者。年份可留空。
              </p>
              {draft.members.map((member, index) => (
                <div className="space-y-2 rounded-lg border border-line-soft p-3" key={index}>
                  <label className="block text-xs">
                    成员
                    <select
                      className="field"
                      aria-label={`成员 ${index + 1}`}
                      value={member.personId}
                      onChange={(e) =>
                        set(
                          "members",
                          draft.members.map((m, i) =>
                            i === index ? { ...m, personId: e.target.value } : m
                          )
                        )
                      }
                    >
                      <option value="">请选择人物</option>
                      {(everyone ?? [])
                        .filter((p) => p.id !== person.id && (p.kind ?? "person") === "person")
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {pickText(p.name)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <input
                    className="field"
                    aria-label={`成员 ${index + 1} 职责`}
                    placeholder="职责，如主唱、吉他手"
                    value={member.role ?? ""}
                    maxLength={80}
                    onChange={(e) =>
                      set(
                        "members",
                        draft.members.map((m, i) =>
                          i === index ? { ...m, role: e.target.value || null } : m
                        )
                      )
                    }
                  />
                  <div className="flex gap-2">
                    {(["startYear", "endYear"] as const).map((field) => (
                      <label className="min-w-0 text-xs" key={field}>
                        {field === "startYear" ? "加入年份" : "离开年份"}
                        <input
                          type="number"
                          className="field"
                          min={1000}
                          max={3000}
                          value={member[field] ?? ""}
                          onChange={(e) =>
                            set(
                              "members",
                              draft.members.map((m, i) =>
                                i === index
                                  ? {
                                      ...m,
                                      [field]: e.target.value ? Number(e.target.value) : null
                                    }
                                  : m
                              )
                            )
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      set(
                        "members",
                        draft.members.filter((_, i) => i !== index)
                      )
                    }
                  >
                    移除成员
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary"
                disabled={draft.members.length >= 100}
                onClick={() =>
                  set("members", [
                    ...draft.members,
                    { personId: "", role: null, startYear: null, endYear: null }
                  ])
                }
              >
                添加成员
              </button>
            </Panel>
          ) : null}
          <MusicCandidatesPanel personId={person.id} />
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

          <Panel title="身份与别名">
            <Field label="类型" htmlFor="person-kind">
              <select
                className="field"
                id="person-kind"
                value={draft.kind}
                onChange={(e) => set("kind", e.target.value as PersonKind)}
              >
                <option value="person">人物</option>
                <option value="group">团体 / 乐队</option>
                <option value="organization">机构 / 工作室</option>
              </select>
            </Field>
            <Field
              label="别名"
              htmlFor="person-aliases"
              hint="每行一个，最多 50 个；用于建议匹配，不证明身份"
            >
              <textarea
                className="field"
                rows={3}
                id="person-aliases"
                value={draft.aliases.join("\n")}
                onChange={(e) => set("aliases", e.target.value.split("\n"))}
              />
            </Field>
            <p className="text-xs text-muted">
              确认来源 ID 后才参与音乐自动关联。相同来源身份只能属于一个人物；保存时校验。
            </p>
            {draft.identities.map((identity, index) => (
              <div key={index} className="space-y-2 rounded-lg border border-line-soft p-3">
                <label className="block text-xs">
                  来源
                  <select
                    aria-label={`身份 ${index + 1} 来源`}
                    className="field"
                    value={identity.provider}
                    onChange={(e) =>
                      set(
                        "identities",
                        draft.identities.map((v, i) =>
                          i === index
                            ? {
                                ...v,
                                provider: e.target.value as PersonIdentity["provider"],
                                confirmed: false
                              }
                            : v
                        )
                      )
                    }
                  >
                    {["musicbrainz", "spotify", "itunes", "tmdb"].map((provider) => (
                      <option key={provider}>{provider}</option>
                    ))}
                  </select>
                </label>
                <input
                  className="field"
                  aria-label={`身份 ${index + 1} ID`}
                  placeholder="艺人 ID（不是歌曲或专辑 ID）"
                  value={identity.externalId}
                  maxLength={100}
                  onChange={(e) =>
                    set(
                      "identities",
                      draft.identities.map((v, i) =>
                        i === index ? { ...v, externalId: e.target.value, confirmed: false } : v
                      )
                    )
                  }
                />
                {identity.externalId ? (
                  <a
                    className="text-xs text-brand underline"
                    href={
                      {
                        tmdb: "https://www.themoviedb.org/person/",
                        musicbrainz: "https://musicbrainz.org/artist/",
                        spotify: "https://open.spotify.com/artist/",
                        itunes: "https://music.apple.com/artist/"
                      }[identity.provider] + encodeURIComponent(identity.externalId)
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    打开来源核对
                  </a>
                ) : null}
                <Switch
                  id={`identity-confirm-${index}`}
                  label="已核对，确认是同一人物"
                  checked={identity.confirmed ?? false}
                  onChange={(confirmed) =>
                    set(
                      "identities",
                      draft.identities.map((v, i) => (i === index ? { ...v, confirmed } : v))
                    )
                  }
                />
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() =>
                    set(
                      "identities",
                      draft.identities.filter((_, i) => i !== index)
                    )
                  }
                >
                  移除此身份
                </button>
              </div>
            ))}
            <button
              className="btn-secondary"
              type="button"
              disabled={draft.identities.length >= 20}
              onClick={() =>
                set("identities", [
                  ...draft.identities,
                  { provider: "spotify", externalId: "", confirmed: false }
                ])
              }
            >
              添加来源身份
            </button>
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
                    navigate("/collection/people");
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
