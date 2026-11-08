import type {
  AdminStackCategory,
  AdminStackCategoryDelete,
  LocalizedText
} from "@liam-frost/shared";
import { useState, type FormEvent, useId } from "react";

import { useStackMutation } from "../../hooks/useStack";
import { api } from "../../lib/api";
import { pickText, type Lang } from "../../lib/i18n";
import { Dialog } from "../ui/Dialog";
import { Field, Switch } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { DiscardBar } from "./DiscardBar";
import { tr } from "../../lib/messages";
import { Select } from "../ui/Select";
import { LanguageTabPanel, LanguageTabs } from "../ui/LanguageTabs";

const trimmed = (text: LocalizedText) =>
  Object.fromEntries(
    Object.entries(text)
      .map(([lang, value]) => [lang, value?.trim() ?? ""])
      .filter(([, value]) => value)
  ) as LocalizedText;

const same = (a: LocalizedText, b: LocalizedText) =>
  JSON.stringify(trimmed(a)) === JSON.stringify(trimmed(b));

/** Adds a category or edits one: name and one-line description per language, shown or hidden. */
export function CategoryDialog({
  category,
  onClose
}: {
  category?: AdminStackCategory;
  onClose: () => void;
}) {
  const [name, setName] = useState<LocalizedText>(category?.name ?? {});
  const [description, setDescription] = useState<LocalizedText>(category?.description ?? {});
  const [visible, setVisible] = useState(category?.visible ?? true);
  const [lang, setLang] = useState<Lang>("zh");
  const languageTabs = useId();
  const [error, setError] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const toast = useToast();
  const save = useStackMutation(() => {
    const body = { name: trimmed(name), description: trimmed(description), visible };
    return category ? api.updateStackCategory(category.id, body) : api.createStackCategory(body);
  });

  const dirty =
    !same(name, category?.name ?? {}) ||
    !same(description, category?.description ?? {}) ||
    visible !== (category?.visible ?? true);
  const requestClose = () => (dirty && !save.isPending ? setConfirmDiscard(true) : onClose());

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!Object.keys(trimmed(name)).length) return setError(tr("请至少填写一种语言的分类名称"));
    setError("");
    save.mutate(undefined, {
      onSuccess: () => {
        toast(category ? tr("已保存") : tr("已添加分类"));
        onClose();
      },
      onError: (e) => setError(e.message)
    });
  };

  return (
    <Dialog
      open
      size="sm"
      title={category ? tr("编辑分类") : tr("添加分类")}
      onClose={requestClose}
      footer={
        confirmDiscard ? (
          <DiscardBar onDiscard={onClose} onKeep={() => setConfirmDiscard(false)} />
        ) : (
          <>
            <button type="button" className="btn-secondary" onClick={requestClose}>
              {tr("取消")}
            </button>
            <button
              type="submit"
              form="stack-category"
              className="btn-primary"
              disabled={save.isPending}
            >
              {save.isPending ? tr("保存中…") : category ? tr("保存") : tr("添加")}
            </button>
          </>
        )
      }
    >
      <form id="stack-category" onSubmit={submit} noValidate className="space-y-3.5">
        <LanguageTabs
          id={languageTabs}
          value={lang}
          onChange={setLang}
          isFilled={(l) => Boolean(name[l]?.trim())}
          mark="missing"
        />
        <p className="text-[11.5px] text-faint">
          {tr("没填写的语言在网站上回退到其它语言；带 · 的语言还没有名称。")}
        </p>
        <LanguageTabPanel id={languageTabs} lang={lang} className="space-y-3.5">
          <Field label={tr("分类名称")} htmlFor="category-name">
            <input
              id="category-name"
              className="field"
              data-autofocus
              value={name[lang] ?? ""}
              maxLength={40}
              placeholder={tr("例如 Frontend")}
              onChange={(e) => setName((n) => ({ ...n, [lang]: e.target.value }))}
            />
          </Field>
          <Field
            label={tr("说明（可选）")}
            htmlFor="category-description"
            hint={tr("一句话，显示在网站上的分类名下方")}
          >
            <input
              id="category-description"
              className="field"
              value={description[lang] ?? ""}
              maxLength={200}
              onChange={(e) => setDescription((d) => ({ ...d, [lang]: e.target.value }))}
            />
          </Field>
        </LanguageTabPanel>
        <Switch
          id="category-visible"
          checked={visible}
          onChange={setVisible}
          label={tr("在网站上显示")}
        />
        {error ? (
          <p role="alert" className="text-[12.5px] text-status-error">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

/**
 * Deletes a category. One with technologies asks what happens to them: move them to another
 * category (default), or delete them too — never silently.
 */
export function DeleteCategoryDialog({
  category,
  categories,
  onClose
}: {
  category: AdminStackCategory;
  categories: AdminStackCategory[];
  onClose: () => void;
}) {
  const others = categories.filter((c) => c.id !== category.id);
  const count = category.technologies.length;
  const [mode, setMode] = useState<"move" | "delete">(others.length ? "move" : "delete");
  const [target, setTarget] = useState(others[0]?.id ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const toast = useToast();
  const remove = useStackMutation((choice: AdminStackCategoryDelete | undefined) =>
    api.deleteStackCategory(category.id, choice)
  );
  const title = pickText(category.name, tr("未命名分类"));
  const canDelete = count === 0 || (mode === "move" ? Boolean(target) : confirmed);

  const run = () =>
    remove.mutate(
      count === 0
        ? undefined
        : mode === "move"
          ? { technologies: "move", to: target }
          : { technologies: "delete" },
      {
        onSuccess: () => {
          toast(tr("已删除分类 {0}", title));
          onClose();
        },
        onError: (e) => toast(e.message, "error")
      }
    );

  return (
    <Dialog
      open
      size="sm"
      title={tr("删除分类")}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {tr("取消")}
          </button>
          <button
            type="button"
            className="btn-danger"
            disabled={!canDelete || remove.isPending}
            onClick={run}
          >
            {remove.isPending
              ? tr("删除中…")
              : count && mode === "move"
                ? tr("移动并删除")
                : tr("删除")}
          </button>
        </>
      }
    >
      {count === 0 ? (
        <p className="text-[13.5px] leading-relaxed text-muted">
          {tr("确定删除空分类“{0}”吗？", title)}
        </p>
      ) : (
        <div className="space-y-3 text-[13.5px] leading-relaxed text-muted">
          <p>{tr("“{0}”里还有 {1} 项技术。请选择它们的去处：", title, count)}</p>
          {others.length ? (
            <label className="flex items-start gap-2.5">
              <input
                type="radio"
                name="delete-mode"
                className="mt-1"
                checked={mode === "move"}
                onChange={() => setMode("move")}
              />
              <span className="min-w-0 flex-1">
                {tr("移到另一个分类末尾")}
                <Select
                  aria-label={tr("移到哪个分类")}
                  value={target}
                  disabled={mode !== "move"}
                  onChange={(value) => setTarget(value)}
                  className="mt-1.5"
                  options={[
                    ...others.map((c) => ({
                      value: c.id,
                      label: pickText(c.name, tr("未命名分类"))
                    }))
                  ]}
                />
              </span>
            </label>
          ) : null}
          <label className="flex items-start gap-2.5">
            <input
              type="radio"
              name="delete-mode"
              className="mt-1"
              checked={mode === "delete"}
              onChange={() => setMode("delete")}
            />
            <span>{tr("连同这些技术一起删除")}</span>
          </label>
          {mode === "delete" ? (
            <label className="flex items-start gap-2.5 rounded-xl bg-status-error/6 p-2.5 text-status-error">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>
                {tr(
                  "我确认删除 {0} 项技术（{1}）及其上传的图标，此操作无法撤销。",
                  count,
                  category.technologies.map((t) => t.name).join("、")
                )}
              </span>
            </label>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
