import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "../../lib/api";
import { pickText } from "../../lib/i18n";
import { Panel } from "../ui/Panel";
import { useToast } from "../ui/Toast";
import { tr } from "../../lib/messages";

/** Every checkbox is explicit: ambiguous names must never be preselected. */
export function MusicCandidatesPanel({ personId }: { personId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { data, error, isPending } = useQuery({
    queryKey: ["admin", "music-candidates", personId],
    queryFn: () => api.personMusicCandidates(personId)
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const candidates = (data?.candidates ?? []).filter((c) => !ignored.includes(c.id));
  const chosen = candidates.filter((c) => selected.includes(c.id));
  const confirm = async () => {
    setBusy(true);
    const done: string[] = [];
    for (const item of chosen) {
      try {
        await api.createRelation({
          from: { type: "person", id: personId },
          toId: item.id,
          type: "credit",
          role: "singer"
        });
        done.push(item.id);
      } catch (e) {
        if (e instanceof ApiError && e.code === "RELATION_EXISTS") done.push(item.id);
      }
    }
    setSelected((ids) => ids.filter((id) => !done.includes(id)));
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["admin", "music-candidates"] }),
      qc.invalidateQueries({ queryKey: ["admin", "relations"] }),
      qc.invalidateQueries({ queryKey: ["admin", "people"] })
    ]);
    toast(
      tr(
        "已确认 {0} 个关联{1}",
        done.length,
        done.length < chosen.length ? tr("；{0} 个失败，可重试", chosen.length - done.length) : ""
      ),
      done.length < chosen.length ? "error" : "success"
    );
    setBusy(false);
  };
  return (
    <Panel title={tr("已有音乐 · 待确认关联")}>
      <p className="text-xs leading-relaxed text-muted">
        {tr(
          "只关联收藏中已有作品。同名、别名与身份冲突须逐项核对，不会自动合并人物或导入整个唱片目录。忽略仅在本次打开期间生效；其他角色可在下方关联中编辑。"
        )}
      </p>
      {isPending ? <p role="status">{tr("正在查找建议…")}</p> : null}
      {error ? (
        <p role="alert" className="text-status-error">
          {error.message}
        </p>
      ) : null}
      {!isPending && !error && !candidates.length ? (
        <p className="text-xs text-faint">{tr("暂无待确认音乐。")}</p>
      ) : null}
      <ul className="max-h-96 overflow-auto divide-y divide-line-soft">
        {candidates.map((item) => (
          <li key={item.id} className="flex items-start gap-3 py-3">
            <input
              type="checkbox"
              className="mt-1"
              aria-label={tr("确认关联 {0}", pickText(item.title))}
              disabled={busy}
              checked={selected.includes(item.id)}
              onChange={(e) =>
                setSelected((ids) =>
                  e.target.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id)
                )
              }
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-brand-dark">
                {pickText(item.title)} {item.year ?? ""}
              </p>
              <p className={`text-xs ${item.ambiguous ? "text-status-warn" : "text-faint"}`}>
                {item.reason === "identity"
                  ? tr("已确认来源 ID 一致")
                  : item.reason === "conflict"
                    ? tr("同名但来源 ID 冲突，请谨慎核对")
                    : item.ambiguous
                      ? tr("同名候选不止一个，请核对")
                      : tr("名字或别名相同，尚未核验身份")}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !chosen.length}
          onClick={() => void confirm()}
        >
          {busy ? tr("确认中…") : tr("确认所选 {0} 项", chosen.length)}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy || !chosen.length}
          onClick={() => {
            setIgnored((ids) => [...ids, ...chosen.map((c) => c.id)]);
            setSelected([]);
          }}
        >
          {tr("本次忽略所选")}
        </button>
      </div>
    </Panel>
  );
}
