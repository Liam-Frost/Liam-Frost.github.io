import type {
  AdminBatchRequest,
  AdminPerson,
  AdminPersonUpdate,
  PersonSearchResult
} from "@liam-frost/shared";
import { useQueryClient } from "@tanstack/react-query";
import { EyeOff, Plus, Search, Star, Trash2, UserRound } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";

import { PageHeader } from "../components/layout/AdminLayout";
import { BatchBar, describeBatch, SelectMark } from "../components/ui/BatchBar";
import { DatabaseNotice } from "../components/ui/DatabaseNotice";
import { Dialog } from "../components/ui/Dialog";
import { Field } from "../components/ui/Field";
import { useToast } from "../components/ui/Toast";
import { useCollectionSettings } from "../hooks/useMedia";
import { peopleKey, personKey, usePeople, useSetPerson } from "../hooks/usePeople";
import { useSelection, type Selection } from "../hooks/useSelection";
import { api, ApiError } from "../lib/api";
import { guessLang, pickText } from "../lib/i18n";

/** People linked to collection entries: actors, directors, singers, writers, studios. */
export function PeoplePage() {
  const { data: people, isPending, error } = usePeople();
  const { data: settings } = useCollectionSettings();
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState("");

  const needle = filter.trim().toLowerCase();
  const visible = (people ?? []).filter(
    (person) =>
      !needle ||
      [...Object.values(person.name), person.originalName ?? ""].some((text) =>
        text?.toLowerCase().includes(needle)
      )
  );
  const order = useMemo(() => visible.map((person) => person.id), [visible]);
  const selection = useSelection(order);

  return (
    <>
      <PageHeader
        title="人物"
        description="演员、导演、歌手、作家、制作公司……在条目的“关联”里把人物和作品连起来；网站只显示参与了公开条目的公开人物。"
        actions={
          <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" className="size-4" /> 添加人物
          </button>
        }
      />

      {isPending ? <p className="py-10 text-center text-[13px] text-subtle">加载中…</p> : null}
      {error ? <DatabaseNotice error={error} subject="人物" /> : null}

      {people ? (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint"
              />
              <input
                className="field pl-9"
                placeholder="筛选名字"
                aria-label="筛选名字"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            {visible.length && !selection.active ? (
              <button type="button" className="btn-secondary" onClick={selection.start}>
                选择
              </button>
            ) : null}
          </div>
          {visible.length ? (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {visible.map((person) => (
                <li key={person.id}>
                  <PersonCard person={person} selection={selection} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="card p-10 text-center text-[13.5px] text-muted">
              {people.length
                ? "没有符合条件的人物"
                : "还没有人物，点击“添加人物”，或者在条目的“关联”里查找建议"}
            </div>
          )}
          <BatchBar selection={selection} total={visible.length}>
            <PeopleBatchActions selection={selection} />
          </BatchBar>
        </>
      ) : null}

      {adding ? (
        <AddPersonDialog
          tmdbReady={settings?.sources.tmdb ?? false}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </>
  );
}

function PersonCard({ person, selection }: { person: AdminPerson; selection: Selection }) {
  const name = pickText(person.name, "未命名");
  const selected = selection.isSelected(person.id);
  const className = `card group block w-full overflow-hidden text-left transition-shadow hover:shadow-card-hover ${selected ? "ring-2 ring-brand" : ""}`;
  const body = (
    <>
      <div className="relative aspect-square bg-line-soft">
        {selection.active ? (
          <span className="absolute top-2 right-2 z-10">
            <SelectMark checked={selected} />
          </span>
        ) : null}
        {person.photo ? (
          <img
            src={person.photo.variants[0].url}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-faint">
            <UserRound aria-hidden="true" className="size-8" />
          </span>
        )}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {person.visibility === "private" ? (
            <span className="chip inline-flex items-center gap-1 bg-surface/90">
              <EyeOff aria-hidden="true" className="size-3" /> 隐藏
            </span>
          ) : null}
          {person.featured ? (
            <span className="chip inline-flex items-center gap-1 bg-surface/90">
              <Star aria-hidden="true" className="size-3" /> 精选
            </span>
          ) : null}
        </div>
      </div>
      <div className="space-y-0.5 p-3">
        <p
          className="truncate text-[13.5px] font-semibold text-brand-dark group-hover:text-brand"
          title={name}
        >
          {name}
        </p>
        <p className="text-[12px] text-subtle">{person.works} 部作品</p>
      </div>
    </>
  );
  return selection.active ? (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`选择 ${name}`}
      className={className}
      onClick={(e) => selection.toggle(person.id, e.shiftKey)}
    >
      {body}
    </button>
  ) : (
    <Link to={`/people/${person.id}`} className={className}>
      {body}
    </Link>
  );
}

/** Bulk visibility, featured and delete for people. */
function PeopleBatchActions({ selection }: { selection: Selection }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ids = selection.selected;

  const run = async (
    request: AdminBatchRequest<Pick<AdminPersonUpdate, "visibility" | "featured">>,
    verb: string
  ) => {
    setBusy(true);
    try {
      const result = await api.batchPeople(request);
      const { text, ok } = describeBatch(result, verb);
      toast(text, ok ? "success" : "error");
      if (request.action === "delete") {
        for (const id of result.done) qc.removeQueries({ queryKey: personKey(id) });
        selection.clear();
        // Entries listed these people among their links.
        void qc.invalidateQueries({ queryKey: ["admin", "relations"] });
      }
      await qc.invalidateQueries({ queryKey: peopleKey });
    } catch (e) {
      toast(e instanceof Error ? e.message : "操作失败", "error");
    } finally {
      setBusy(false);
    }
  };
  const disabled = busy || ids.length === 0;

  return (
    <>
      <button
        type="button"
        className="btn-secondary"
        disabled={disabled}
        onClick={() => void run({ action: "update", ids, patch: { visibility: "public" } }, "公开")}
      >
        公开
      </button>
      <button
        type="button"
        className="btn-secondary"
        disabled={disabled}
        onClick={() =>
          void run({ action: "update", ids, patch: { visibility: "private" } }, "隐藏")
        }
      >
        隐藏
      </button>
      <button
        type="button"
        className="btn-secondary"
        disabled={disabled}
        onClick={() => void run({ action: "update", ids, patch: { featured: true } }, "设为精选")}
      >
        精选
      </button>
      <button
        type="button"
        className="btn-secondary"
        disabled={disabled}
        onClick={() => void run({ action: "update", ids, patch: { featured: false } }, "取消精选")}
      >
        取消精选
      </button>
      <button
        type="button"
        className="btn-danger"
        disabled={disabled}
        onClick={() => setConfirming(true)}
      >
        <Trash2 aria-hidden="true" className="size-4" /> 删除
      </button>
      <Dialog
        open={confirming}
        size="sm"
        title="批量删除人物"
        onClose={() => setConfirming(false)}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setConfirming(false)}>
              取消
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                void run({ action: "delete", ids }, "删除");
              }}
            >
              删除 {ids.length} 人
            </button>
          </>
        }
      >
        <p className="text-[13.5px] leading-relaxed text-muted">
          确定删除选中的 {ids.length}{" "}
          个人物吗？照片和他们与作品的关联都会删除，作品本身不受影响。此操作无法撤销。
        </p>
      </Dialog>
    </>
  );
}

function AddPersonDialog({ tmdbReady, onClose }: { tmdbReady: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [manualName, setManualName] = useState("");
  const setPerson = useSetPerson();
  const navigate = useNavigate();

  const search = async (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim() || !tmdbReady) return;
    setSearching(true);
    setError("");
    try {
      setResults((await api.searchPeople(query.trim())).results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "搜索失败");
    } finally {
      setSearching(false);
    }
  };

  const add = async (result: PersonSearchResult) => {
    setImporting(result.sourceId);
    setError("");
    try {
      const { person } = await api.importPerson(result.sourceId);
      setPerson(person);
      navigate(`/people/${person.id}`);
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === "PERSON_EXISTS"
          ? "这个人物已在人物中"
          : e instanceof Error
            ? e.message
            : "添加失败"
      );
    } finally {
      setImporting(null);
    }
  };

  const addManually = async (event: FormEvent) => {
    event.preventDefault();
    const name = manualName.trim();
    if (!name) return;
    try {
      const { person } = await api.createPerson({ name: { [guessLang(name)]: name } });
      setPerson(person);
      navigate(`/people/${person.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    }
  };

  return (
    <Dialog open title="添加人物" onClose={onClose}>
      <form onSubmit={search} className="flex flex-wrap items-end gap-2">
        <Field label="在 TMDB 搜索" htmlFor="person-query" className="min-w-0 flex-1">
          <input
            id="person-query"
            className="field"
            value={query}
            maxLength={100}
            placeholder="名字，英文或原名都可以"
            disabled={!tmdbReady}
            onChange={(e) => setQuery(e.target.value)}
            data-autofocus
          />
        </Field>
        <button
          type="submit"
          className="btn-primary"
          disabled={searching || !query.trim() || !tmdbReady}
        >
          <Search aria-hidden="true" className="size-4" />
          {searching ? "搜索中…" : "搜索"}
        </button>
      </form>
      {!tmdbReady ? (
        <p className="mt-3 text-[12.5px] text-status-warn">
          未配置 TMDB_API_KEY，暂时只能手动添加。
        </p>
      ) : null}
      <p className="mt-2 text-[11.5px] text-faint">
        TMDB 主要收录影视人物；歌手、作家、漫画家可以手动添加。
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-[12.5px] text-status-error">
          {error}
        </p>
      ) : null}

      {results ? (
        results.length ? (
          <ul className="mt-4 divide-y divide-line-soft rounded-xl border border-line-soft">
            {results.map((result) => (
              <li key={result.sourceId} className="flex items-center gap-3 p-3">
                {result.photoUrl ? (
                  <img
                    src={result.photoUrl}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="size-14 shrink-0 rounded-full bg-line-soft object-cover"
                  />
                ) : (
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-line-soft text-faint">
                    <UserRound aria-hidden="true" className="size-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-brand-dark">{result.name}</p>
                  <p className="truncate text-[12px] text-subtle">
                    {[result.department, result.knownFor.join("、")].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {result.existingId ? (
                  <Link to={`/people/${result.existingId}`} className="btn-secondary shrink-0">
                    已添加，打开
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="btn-primary shrink-0"
                    disabled={importing !== null}
                    onClick={() => void add(result)}
                  >
                    {importing === result.sourceId ? "添加中…" : "添加"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[13px] text-muted">
            没有找到，换个写法试试，或者在下面手动添加。
          </p>
        )
      ) : null}

      <form
        onSubmit={(e) => void addManually(e)}
        className="mt-5 flex flex-wrap items-end gap-2 border-t border-line-soft pt-4"
      >
        <Field
          label="手动添加"
          htmlFor="person-manual-name"
          hint="之后在人物页补充其它语言的名字、照片和简介"
          className="min-w-0 flex-1"
        >
          <input
            id="person-manual-name"
            className="field"
            value={manualName}
            maxLength={120}
            placeholder="名字"
            onChange={(e) => setManualName(e.target.value)}
          />
        </Field>
        <button type="submit" className="btn-secondary" disabled={!manualName.trim()}>
          手动添加
        </button>
      </form>
    </Dialog>
  );
}
