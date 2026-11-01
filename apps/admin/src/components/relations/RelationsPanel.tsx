import {
  PERSON_ROLES,
  SOUNDTRACK_ROLES,
  type AdminRelation,
  type AdminRelationCreate,
  type LocalizedText,
  type MediaKind,
  type PersonRole,
  type RelationSuggestion,
  type RelationType,
  type SoundtrackRole
} from "@liam-frost/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clapperboard, Lightbulb, Pencil, Plus, Search, Trash2, UserRound } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { useMediaList } from "../../hooks/useMedia";
import { peopleKey, relationsKey, usePeople } from "../../hooks/usePeople";
import { api, ApiError } from "../../lib/api";
import {
  COLLECTION_KIND_LABELS,
  guessLang,
  isReadKind,
  LANG_LABELS,
  LANGS,
  PERSON_ROLE_LABELS,
  pickText,
  RELATION_LABELS,
  SOUNDTRACK_ROLE_LABELS,
  type CollectionKind
} from "../../lib/i18n";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { Panel } from "../ui/Panel";
import { useToast } from "../ui/Toast";

type Subject = { type: "media"; id: string; kind: MediaKind } | { type: "person"; id: string };

const MUSIC: MediaKind[] = ["track", "album"];

const roleLabel = (type: RelationType, role: string | null) =>
  !role ? "" : type === "credit" ? (PERSON_ROLE_LABELS[role as PersonRole] ?? role) : (SOUNDTRACK_ROLE_LABELS[role as SoundtrackRole] ?? role);

/** Group heading for a relation as seen from the subject; credits on a person read by role. */
const groupOf = (relation: AdminRelation) => RELATION_LABELS[relation.type][relation.direction];

/** Links of an entry or a person: grouped list, add / edit / remove, and (for entries) suggestions. */
export function RelationsPanel({ subject }: { subject: Subject }) {
  const key = relationsKey(subject);
  const { data, isPending, error } = useQuery({ queryKey: key, queryFn: () => api.relations(subject), select: (r) => r.relations });
  const qc = useQueryClient();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AdminRelation | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  // A link shows on both ends, and people's work counts change.
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "relations"] });
    void qc.invalidateQueries({ queryKey: peopleKey });
  };

  const remove = async (relation: AdminRelation) => {
    try {
      await api.deleteRelation(relation.id);
      refresh();
      toast("已删除关联");
    } catch (e) {
      toast(e instanceof Error ? e.message : "删除失败", "error");
    }
  };

  const groups = new Map<string, AdminRelation[]>();
  for (const relation of data ?? []) groups.set(groupOf(relation), [...(groups.get(groupOf(relation)) ?? []), relation]);

  return (
    <Panel title={subject.type === "person" ? "作品" : "关联"}>
      {isPending ? <p className="text-[12.5px] text-subtle">加载中…</p> : null}
      {error ? <p className="text-[12.5px] text-status-error">{error.message}</p> : null}
      {data && !data.length ? (
        <p className="text-[12.5px] text-subtle">{subject.type === "person" ? "还没有关联作品。" : "还没有关联。可以关联主题曲、原作、续作和参与的人物。"}</p>
      ) : null}

      {[...groups].map(([group, relations]) => (
        <div key={group}>
          <p className="mb-1.5 text-[12px] font-medium text-subtle">{group}</p>
          <ul className="divide-y divide-line-soft rounded-xl border border-line-soft">
            {relations.map((relation) => (
              <RelationRow key={relation.id} relation={relation} onEdit={() => setEditing(relation)} onRemove={() => void remove(relation)} />
            ))}
          </ul>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" className="size-4" /> {subject.type === "person" ? "添加作品" : "添加关联"}
        </button>
        {subject.type === "media" ? (
          <button type="button" className="btn-secondary" onClick={() => setSuggesting(true)}>
            <Lightbulb aria-hidden="true" className="size-4" /> 查找建议
          </button>
        ) : null}
      </div>

      {adding ? <AddRelationDialog subject={subject} onDone={refresh} onClose={() => setAdding(false)} /> : null}
      {editing ? <EditRelationDialog relation={editing} onDone={refresh} onClose={() => setEditing(null)} /> : null}
      {suggesting && subject.type === "media" ? <SuggestionsDialog mediaId={subject.id} onDone={refresh} onClose={() => setSuggesting(false)} /> : null}
    </Panel>
  );
}

function Thumb({ src, person }: { src: string | null | undefined; person?: boolean }) {
  if (src) return <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className={`size-10 shrink-0 bg-line-soft object-cover ${person ? "rounded-full" : "rounded-md"}`} />;
  const Icon = person ? UserRound : Clapperboard;
  return (
    <span className={`flex size-10 shrink-0 items-center justify-center bg-line-soft text-faint ${person ? "rounded-full" : "rounded-md"}`}>
      <Icon aria-hidden="true" className="size-4" />
    </span>
  );
}

function RelationRow({ relation, onEdit, onRemove }: { relation: AdminRelation; onEdit: () => void; onRemove: () => void }) {
  const { other } = relation;
  const name = other.type === "media" ? pickText(other.title, "未命名") : pickText(other.name, "未命名");
  const note = pickText(relation.note);
  const meta = other.type === "media" ? [COLLECTION_KIND_LABELS[other.kind as CollectionKind] ?? other.kind, other.year].filter(Boolean).join(" · ") : "";

  return (
    <li className="flex items-center gap-3 p-2.5">
      <Thumb src={other.type === "media" ? other.poster?.variants[0].url : other.photo?.variants[0].url} person={other.type === "person"} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-brand-dark">
          <Link to={other.type === "media" ? `/collection/${other.id}` : `/people/${other.id}`} className="hover:text-brand hover:underline">
            {name}
          </Link>
          {relation.role ? <span className="chip ml-1.5">{roleLabel(relation.type, relation.role)}</span> : null}
          {other.visibility === "private" ? <span className="chip ml-1.5">隐藏</span> : null}
        </p>
        <p className="truncate text-[12px] text-subtle">{[meta, note].filter(Boolean).join(" · ")}</p>
      </div>
      <button type="button" className="rounded-full p-1.5 text-faint hover:bg-brand-secondary/12 hover:text-brand" aria-label={`编辑与“${name}”的关联`} onClick={onEdit}>
        <Pencil aria-hidden="true" className="size-4" />
      </button>
      <button type="button" className="rounded-full p-1.5 text-faint hover:bg-status-error/10 hover:text-status-error" aria-label={`删除与“${name}”的关联`} onClick={onRemove}>
        <Trash2 aria-hidden="true" className="size-4" />
      </button>
    </li>
  );
}

/** Note per language; empty languages fall back on the site. */
function NoteFields({ value, onChange }: { value: LocalizedText; onChange: (value: LocalizedText) => void }) {
  return (
    <Field label="备注（可选）" hint="例如“第 12 集插曲”“饰 某某”。没填的语言会回退到其它语言。">
      <div className="grid gap-2 sm:grid-cols-2">
        {LANGS.map((lang) => (
          <input
            key={lang}
            className="field"
            aria-label={`备注（${LANG_LABELS[lang]}）`}
            placeholder={LANG_LABELS[lang]}
            maxLength={200}
            value={value[lang] ?? ""}
            onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
          />
        ))}
      </div>
    </Field>
  );
}

function RoleSelect({ type, value, onChange }: { type: "credit" | "soundtrack"; value: string | null; onChange: (role: string | null) => void }) {
  const roles = type === "credit" ? PERSON_ROLES : SOUNDTRACK_ROLES;
  return (
    <Field label={type === "credit" ? "身份" : "歌曲类型"} htmlFor="relation-role">
      <select id="relation-role" className="field" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        {type === "soundtrack" ? <option value="">不注明</option> : null}
        {roles.map((role) => (
          <option key={role} value={role}>
            {roleLabel(type, role)}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** The kinds of links an entry can get; each says what the picked end is and builds the request. */
type Choice = {
  id: string;
  label: string;
  /** What to pick: a person, a song or a work (film, series, anime). */
  pick: "person" | "song" | "work";
  type: RelationType;
  /** The picked end is where the relation starts. */
  pickedIsFrom: boolean;
};

function choicesFor(subject: Subject): Choice[] {
  if (subject.type === "person") return [{ id: "work", label: "参与的作品", pick: "work", type: "credit", pickedIsFrom: false }];
  if (subject.kind === "track") {
    return [
      { id: "person", label: "参与者（歌手、作曲等）", pick: "person", type: "credit", pickedIsFrom: true },
      { id: "soundtrack", label: "出自作品（这首歌是它的主题曲、插曲……）", pick: "work", type: "soundtrack", pickedIsFrom: false }
    ];
  }
  return [
    { id: "person", label: "参与者（导演、演员、作者等）", pick: "person", type: "credit", pickedIsFrom: true },
    { id: "song", label: "原声歌曲", pick: "song", type: "soundtrack", pickedIsFrom: true },
    { id: "source", label: "改编自（原作）", pick: "work", type: "adaptation", pickedIsFrom: false },
    { id: "adaptation", label: "被改编为", pick: "work", type: "adaptation", pickedIsFrom: true },
    { id: "prequel", label: "前作", pick: "work", type: "sequel", pickedIsFrom: false },
    { id: "sequel", label: "续作", pick: "work", type: "sequel", pickedIsFrom: true },
    { id: "related", label: "相关作品（外传、同系列……）", pick: "work", type: "related", pickedIsFrom: false }
  ];
}

type Picked = { type: "media" | "person"; id: string; name: string };

function AddRelationDialog({ subject, onDone, onClose }: { subject: Subject; onDone: () => void; onClose: () => void }) {
  const choices = choicesFor(subject);
  const [choiceId, setChoiceId] = useState(choices[0].id);
  const choice = choices.find((c) => c.id === choiceId)!;
  const [picked, setPicked] = useState<Picked | null>(null);
  const [role, setRole] = useState<string | null>(choice.type === "credit" ? defaultRole(subject) : null);
  const [note, setNote] = useState<LocalizedText>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const select = (id: string) => {
    const next = choices.find((c) => c.id === id)!;
    setChoiceId(id);
    setPicked(null);
    setRole(next.type === "credit" ? defaultRole(subject) : null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!picked) return setError(choice.pick === "person" ? "请选择人物" : "请选择条目");
    setSaving(true);
    setError("");
    const self = { type: subject.type, id: subject.id };
    const [from, to] = choice.pickedIsFrom ? [{ type: picked.type, id: picked.id }, self] : [self, { type: picked.type, id: picked.id }];
    const body: AdminRelationCreate = { from, toId: to.id, type: choice.type, role, note };
    try {
      await api.createRelation(body);
      onDone();
      toast("已添加关联");
      onClose();
    } catch (e) {
      setError(e instanceof ApiError && e.code === "RELATION_EXISTS" ? "这个关联已经存在" : e instanceof Error ? e.message : "添加失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      title={subject.type === "person" ? "添加作品" : "添加关联"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            取消
          </button>
          <button type="submit" form="add-relation" className="btn-primary" disabled={saving || !picked}>
            {saving ? "添加中…" : "添加"}
          </button>
        </>
      }
    >
      <form id="add-relation" onSubmit={submit} className="space-y-4">
        {choices.length > 1 ? (
          <Field label="关联类型" htmlFor="relation-choice">
            <select id="relation-choice" className="field" value={choiceId} onChange={(e) => select(e.target.value)}>
              {choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {choice.pick === "person" ? (
          <PersonPicker picked={picked} onPick={setPicked} />
        ) : (
          <MediaPicker pick={choice.pick} excludeId={subject.type === "media" ? subject.id : null} picked={picked} onPick={setPicked} />
        )}

        {choice.type === "credit" || choice.type === "soundtrack" ? <RoleSelect type={choice.type} value={role} onChange={setRole} /> : null}
        <NoteFields value={note} onChange={setNote} />

        {error ? (
          <p role="alert" className="text-[12.5px] text-status-error">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

/** Songs are usually sung, books and comics written; other works usually start with their director. */
const defaultRole = (subject: Subject) =>
  subject.type === "media" && subject.kind === "track" ? "singer" : subject.type === "media" && isReadKind(subject.kind) ? "author" : "director";

function PickedChip({ picked, onClear }: { picked: Picked; onClear: () => void }) {
  return (
    <p className="flex items-center gap-2 text-[13px]">
      已选择：<span className="font-semibold text-brand-dark">{picked.name}</span>
      <button type="button" className="text-[12px] text-brand hover:underline" onClick={onClear}>
        重新选择
      </button>
    </p>
  );
}

function MediaPicker({ pick, excludeId, picked, onPick }: { pick: "song" | "work"; excludeId: string | null; picked: Picked | null; onPick: (picked: Picked | null) => void }) {
  const { data: items } = useMediaList();
  const [filter, setFilter] = useState("");
  if (picked) return <PickedChip picked={picked} onClear={() => onPick(null)} />;

  const needle = filter.trim().toLowerCase();
  const matches = (items ?? [])
    .filter((item) => item.id !== excludeId && (pick === "song" ? item.kind === "track" : !MUSIC.includes(item.kind)))
    .filter((item) => !needle || [...Object.values(item.title), item.originalTitle ?? "", ...item.credits].some((text) => text?.toLowerCase().includes(needle)))
    .slice(0, 30);

  return (
    <div>
      <Field label={pick === "song" ? "选择歌曲" : "选择作品"} htmlFor="relation-media-filter">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <input id="relation-media-filter" className="field pl-9" placeholder="筛选收藏里的标题" value={filter} onChange={(e) => setFilter(e.target.value)} data-autofocus />
        </div>
      </Field>
      <ul className="mt-2 max-h-64 divide-y divide-line-soft overflow-y-auto rounded-xl border border-line-soft">
        {matches.map((item) => {
          const name = pickText(item.title, "未命名");
          return (
            <li key={item.id}>
              <button type="button" className="flex w-full items-center gap-3 p-2 text-left hover:bg-brand-secondary/8" onClick={() => onPick({ type: "media", id: item.id, name })}>
                <Thumb src={item.poster?.variants[0].url} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-brand-dark">{name}</span>
                  <span className="block truncate text-[12px] text-subtle">
                    {[COLLECTION_KIND_LABELS[item.kind as CollectionKind] ?? item.kind, item.year, item.kind === "track" || isReadKind(item.kind) ? item.credits.join("、") : ""]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {!matches.length ? <li className="p-3 text-[12.5px] text-subtle">收藏里没有符合的{pick === "song" ? "歌曲" : "作品"}。</li> : null}
      </ul>
    </div>
  );
}

function PersonPicker({ picked, onPick }: { picked: Picked | null; onPick: (picked: Picked | null) => void }) {
  const { data: people } = usePeople();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  if (picked) return <PickedChip picked={picked} onClear={() => onPick(null)} />;

  const needle = filter.trim().toLowerCase();
  const matches = (people ?? []).filter((person) => !needle || [...Object.values(person.name), person.originalName ?? ""].some((text) => text?.toLowerCase().includes(needle))).slice(0, 30);

  // A new person by name; details, photo and other languages can be added on their page.
  const create = async () => {
    const name = filter.trim();
    setCreating(true);
    setError("");
    try {
      const { person } = await api.createPerson({ name: { [guessLang(name)]: name } });
      void qc.invalidateQueries({ queryKey: peopleKey });
      onPick({ type: "person", id: person.id, name });
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <Field label="选择人物" htmlFor="relation-person-filter" hint="要从 TMDB 导入资料和照片，先在“人物”页添加，或者用“查找建议”。">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <input id="relation-person-filter" className="field pl-9" placeholder="名字" value={filter} maxLength={120} onChange={(e) => setFilter(e.target.value)} data-autofocus />
        </div>
      </Field>
      <ul className="mt-2 max-h-64 divide-y divide-line-soft overflow-y-auto rounded-xl border border-line-soft">
        {matches.map((person) => {
          const name = pickText(person.name, "未命名");
          return (
            <li key={person.id}>
              <button type="button" className="flex w-full items-center gap-3 p-2 text-left hover:bg-brand-secondary/8" onClick={() => onPick({ type: "person", id: person.id, name })}>
                <Thumb src={person.photo?.variants[0].url} person />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-brand-dark">{name}</span>
                <span className="text-[12px] text-subtle">{person.works} 部作品</span>
              </button>
            </li>
          );
        })}
        {filter.trim() ? (
          <li>
            <button type="button" className="flex w-full items-center gap-2 p-2.5 text-left text-[13px] text-brand hover:bg-brand-secondary/8" disabled={creating} onClick={() => void create()}>
              <Plus aria-hidden="true" className="size-4" /> {creating ? "创建中…" : `新建人物“${filter.trim()}”`}
            </button>
          </li>
        ) : !matches.length ? (
          <li className="p-3 text-[12.5px] text-subtle">还没有人物，输入名字新建。</li>
        ) : null}
      </ul>
      {error ? <p className="mt-2 text-[12.5px] text-status-error">{error}</p> : null}
    </div>
  );
}

function EditRelationDialog({ relation, onDone, onClose }: { relation: AdminRelation; onDone: () => void; onClose: () => void }) {
  const [role, setRole] = useState(relation.role);
  const [note, setNote] = useState<LocalizedText>(relation.note);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await api.updateRelation(relation.id, relation.type === "credit" || relation.type === "soundtrack" ? { role, note } : { note });
      onDone();
      toast("已保存");
      onClose();
    } catch (e) {
      setError(e instanceof ApiError && e.code === "RELATION_EXISTS" ? "已经有相同身份的关联" : e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      size="sm"
      title="编辑关联"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>
            {saving ? "保存中…" : "保存"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {relation.type === "credit" || relation.type === "soundtrack" ? <RoleSelect type={relation.type} value={role} onChange={setRole} /> : null}
        <NoteFields value={note} onChange={setNote} />
        {error ? (
          <p role="alert" className="text-[12.5px] text-status-error">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

const suggestionKey = (s: RelationSuggestion) =>
  s.kind === "tmdb-person" ? `tmdb:${s.sourceId}:${s.role}` : s.kind === "name" ? `name:${s.name}:${s.role}` : `media:${s.relation.from.id}:${s.relation.toId}:${s.relation.type}`;

/** Suggested links from the entry's source data; each is added on its own, nothing automatically. */
function SuggestionsDialog({ mediaId, onDone, onClose }: { mediaId: string; onDone: () => void; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const queryKey = ["admin", "relations", "suggestions", mediaId];
  const { data, isPending, error } = useQuery({ queryKey, queryFn: () => api.suggestions(mediaId), select: (r) => r.suggestions });
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<Set<string>>(new Set());
  // People added from this list, so a second role of the same person does not import them again.
  const added = useRef(new Map<string, string>());

  const accept = async (suggestion: RelationSuggestion) => {
    const key = suggestionKey(suggestion);
    setBusy((b) => new Set(b).add(key));
    try {
      if (suggestion.kind === "media") {
        await api.createRelation(suggestion.relation);
      } else {
        const personKey = suggestion.kind === "tmdb-person" ? `tmdb:${suggestion.sourceId}` : `name:${suggestion.name}`;
        let personId = suggestion.personId ?? added.current.get(personKey) ?? null;
        if (!personId) {
          personId =
            suggestion.kind === "tmdb-person"
              ? (await api.importPerson(suggestion.sourceId)).person.id
              : (await api.createPerson({ name: { [guessLang(suggestion.name)]: suggestion.name } })).person.id;
          added.current.set(personKey, personId);
        }
        const note = suggestion.kind === "tmdb-person" && suggestion.character ? { en: suggestion.character } : {};
        await api.createRelation({
          from: { type: "person", id: personId },
          toId: mediaId,
          type: "credit",
          role: suggestion.role,
          note
        });
      }
      setDone((d) => new Set(d).add(key));
      void qc.invalidateQueries({ queryKey: peopleKey });
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : "添加失败", "error");
      // Someone may have been imported meanwhile; the next list knows them.
      void qc.invalidateQueries({ queryKey });
    } finally {
      setBusy((b) => {
        const next = new Set(b);
        next.delete(key);
        return next;
      });
    }
  };

  const open = (data ?? []).filter((s) => !done.has(suggestionKey(s)));

  return (
    <Dialog open title="关联建议" onClose={onClose}>
      <p className="mb-3 text-[12px] leading-relaxed text-faint">
        来自 TMDB 的演职员、歌曲的歌手、图书和漫画的作者，以及 AniList 上和这部作品有关、并且已在收藏里的作品（动漫、漫画、轻小说）。只有你点“添加”才会建立关联；从 TMDB 添加的人物会一起导入资料和照片。
      </p>
      {isPending ? <p className="text-[13px] text-subtle">查找中…</p> : null}
      {error ? <p className="text-[13px] text-status-error">{error.message}</p> : null}
      {data && !open.length ? <p className="text-[13px] text-subtle">{data.length ? "建议都已添加。" : "没有找到建议。"}</p> : null}
      {open.length ? (
        <ul className="divide-y divide-line-soft rounded-xl border border-line-soft">
          {open.map((suggestion) => {
            const key = suggestionKey(suggestion);
            const { name, detail, thumb, person } =
              suggestion.kind === "tmdb-person"
                ? {
                    name: suggestion.name,
                    detail: [PERSON_ROLE_LABELS[suggestion.role], suggestion.character, suggestion.personId ? "已在人物中" : "将从 TMDB 导入"].filter(Boolean).join(" · "),
                    thumb: suggestion.photoUrl,
                    person: true
                  }
                : suggestion.kind === "name"
                  ? { name: suggestion.name, detail: [PERSON_ROLE_LABELS[suggestion.role], suggestion.personId ? "已在人物中" : "将新建人物"].join(" · "), thumb: null, person: true }
                  : {
                      name: pickText(suggestion.other.title, "未命名"),
                      detail: RELATION_LABELS[suggestion.relation.type][suggestion.relation.from.id === mediaId ? "from" : "to"],
                      thumb: suggestion.other.poster?.variants[0].url,
                      person: false
                    };
            return (
              <li key={key} className="flex items-center gap-3 p-2.5">
                <Thumb src={thumb} person={person} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-brand-dark">{name}</p>
                  <p className="truncate text-[12px] text-subtle">{detail}</p>
                </div>
                <button type="button" className="btn-secondary shrink-0" disabled={busy.has(key)} onClick={() => void accept(suggestion)}>
                  {busy.has(key) ? "添加中…" : "添加"}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Dialog>
  );
}
