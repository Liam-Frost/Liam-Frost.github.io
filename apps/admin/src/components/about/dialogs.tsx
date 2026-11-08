import {
  ABOUT_LIMITS,
  splitEmphasis,
  type AboutGearCategory,
  type AboutManifesto,
  type LocalizedText
} from "@liam-frost/shared";
import { useState, type FormEvent, type ReactNode } from "react";

import { LANG_LABELS, LANGS, type Lang } from "../../lib/i18n";
import { DiscardBar } from "../stack/DiscardBar";
import { Dialog } from "../ui/Dialog";
import { Field, Switch } from "../ui/Field";
import { tr } from "../../lib/messages";

/** Text per language without empty or padded entries. */
export const trimmed = (text: LocalizedText) =>
  Object.fromEntries(
    Object.entries(text)
      .map(([lang, value]) => [lang, value?.trim() ?? ""])
      .filter(([, value]) => value)
  ) as LocalizedText;

/** `*…*` shown as the site shows it: the marked words in the accent colour. */
export function Emphasis({ text }: { text: string }) {
  return (
    <>
      {splitEmphasis(text).map((part, i) =>
        part.em ? (
          <em key={i} className="text-brand-secondary not-italic">
            {part.text}
          </em>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  );
}

/** Language tabs; a dot marks a language with nothing filled in yet. */
function LangTabs({
  lang,
  onChange,
  filled
}: {
  lang: Lang;
  onChange: (lang: Lang) => void;
  filled: (lang: Lang) => boolean;
}) {
  return (
    <div role="tablist" aria-label={tr("语言")} className="flex flex-wrap gap-1.5">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          role="tab"
          aria-selected={lang === l}
          onClick={() => onChange(l)}
          className={`rounded-full px-2.5 py-1 text-[12px] whitespace-nowrap transition-colors ${
            lang === l
              ? "bg-brand text-white"
              : "bg-brand-secondary/10 text-brand hover:bg-brand-secondary/18"
          }`}
        >
          {LANG_LABELS[l]}
          {filled(l) ? "" : " ·"}
        </button>
      ))}
    </div>
  );
}

function EditDialog({
  title,
  formId,
  dirty,
  submitLabel,
  size = "sm",
  onClose,
  children
}: {
  title: string;
  formId: string;
  dirty: boolean;
  submitLabel: string;
  size?: "sm" | "lg";
  onClose: () => void;
  children: ReactNode;
}) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const requestClose = () => (dirty ? setConfirmDiscard(true) : onClose());
  return (
    <Dialog
      open
      size={size}
      title={title}
      onClose={requestClose}
      footer={
        confirmDiscard ? (
          <DiscardBar onDiscard={onClose} onKeep={() => setConfirmDiscard(false)} />
        ) : (
          <>
            <button type="button" className="btn-secondary" onClick={requestClose}>
              {tr("取消")}
            </button>
            <button type="submit" form={formId} className="btn-primary">
              {submitLabel}
            </button>
          </>
        )
      }
    >
      {children}
    </Dialog>
  );
}

/** Adds a manifesto or edits one: text and attribution per language, shown or hidden. */
export function ManifestoDialog({
  manifesto,
  onSave,
  onClose
}: {
  manifesto?: AboutManifesto;
  onSave: (manifesto: AboutManifesto) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState<LocalizedText>(manifesto?.text ?? {});
  const [attribution, setAttribution] = useState<LocalizedText>(manifesto?.attribution ?? {});
  const [visible, setVisible] = useState(manifesto?.visible ?? true);
  const [weight, setWeight] = useState(manifesto?.weight ?? 1);
  const [lang, setLang] = useState<Lang>("zh");
  const [error, setError] = useState("");
  const dirty =
    JSON.stringify([trimmed(text), trimmed(attribution), visible, weight]) !==
    JSON.stringify([
      trimmed(manifesto?.text ?? {}),
      trimmed(manifesto?.attribution ?? {}),
      manifesto?.visible ?? true,
      manifesto?.weight ?? 1
    ]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!Object.keys(trimmed(text)).length) return setError(tr("请至少填写一种语言的宣言"));
    onSave({
      id: manifesto?.id ?? crypto.randomUUID(),
      text: trimmed(text),
      attribution: trimmed(attribution),
      visible,
      weight
    });
  };

  const current = text[lang]?.trim() ?? "";
  return (
    <EditDialog
      title={manifesto ? tr("编辑宣言") : tr("添加宣言")}
      formId="about-manifesto"
      dirty={dirty}
      submitLabel={manifesto ? tr("完成") : tr("添加")}
      size="lg"
      onClose={onClose}
    >
      <form id="about-manifesto" onSubmit={submit} noValidate className="space-y-3.5">
        <LangTabs lang={lang} onChange={setLang} filled={(l) => !!text[l]?.trim()} />
        <p className="text-[11.5px] text-faint">
          {tr("没填写的语言在网站上回退到其它语言；带 · 的语言还没有宣言。")}
        </p>
        <Field
          label={tr("宣言")}
          htmlFor="manifesto-text"
          hint={
            <>
              {tr("用")} <code>{tr("*星号*")}</code>{" "}
              {tr(
                "包住要强调的词，网站上会用强调色显示。最多 {0} 字。",
                ABOUT_LIMITS.manifestoText
              )}
            </>
          }
        >
          <textarea
            id="manifesto-text"
            className="field min-h-24"
            data-autofocus
            value={text[lang] ?? ""}
            maxLength={ABOUT_LIMITS.manifestoText}
            placeholder={tr("例如：变则善，*常变则至善*。")}
            onChange={(e) => setText((t) => ({ ...t, [lang]: e.target.value }))}
          />
        </Field>
        <Field
          label={tr("署名（可选）")}
          htmlFor="manifesto-attribution"
          hint={tr("引用别人的话时填写，例如 温斯顿·丘吉尔；自己的话留空")}
        >
          <input
            id="manifesto-attribution"
            className="field"
            value={attribution[lang] ?? ""}
            maxLength={ABOUT_LIMITS.attribution}
            onChange={(e) => setAttribution((a) => ({ ...a, [lang]: e.target.value }))}
          />
        </Field>
        <div className="rounded-xl border border-line-soft bg-brand-secondary/5 p-4">
          <p className="mb-2 text-[11px] font-bold tracking-[1px] text-brand-secondary">
            {tr("预览")}
          </p>
          {current ? (
            <p className="text-[22px] leading-snug font-bold text-brand-dark">
              <Emphasis text={current} />
            </p>
          ) : (
            <p className="text-[13px] text-faint">{tr("这个语言还没有宣言")}</p>
          )}
          {attribution[lang]?.trim() ? (
            <p className="mt-2 text-[13px] text-muted">— {attribution[lang]!.trim()}</p>
          ) : null}
        </div>
        <Field
          label={tr("出现权重")}
          htmlFor="manifesto-weight"
          hint={tr(
            "非固定模式下，概率为本条权重 ÷ 所有可见宣言总权重。0表示不参与抽取；固定模式忽略权重。"
          )}
        >
          <input
            id="manifesto-weight"
            className="field"
            type="number"
            min={0}
            max={10000}
            step={1}
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
          />
        </Field>
        <Switch
          id="manifesto-visible"
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
    </EditDialog>
  );
}

/** Adds a gear category or renames one, per language. */
export function GearCategoryDialog({
  category,
  onSave,
  onClose
}: {
  category?: AboutGearCategory;
  onSave: (name: LocalizedText) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState<LocalizedText>(category?.name ?? {});
  const [lang, setLang] = useState<Lang>("zh");
  const [error, setError] = useState("");
  const dirty = JSON.stringify(trimmed(name)) !== JSON.stringify(trimmed(category?.name ?? {}));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!Object.keys(trimmed(name)).length) return setError(tr("请至少填写一种语言的分类名称"));
    onSave(trimmed(name));
  };

  return (
    <EditDialog
      title={category ? tr("重命名分类") : tr("添加设备分类")}
      formId="about-gear-category"
      dirty={dirty}
      submitLabel={category ? tr("完成") : tr("添加")}
      onClose={onClose}
    >
      <form id="about-gear-category" onSubmit={submit} noValidate className="space-y-3.5">
        <LangTabs lang={lang} onChange={setLang} filled={(l) => !!name[l]?.trim()} />
        <Field label={tr("分类名称")} htmlFor="gear-category-name">
          <input
            id="gear-category-name"
            className="field"
            data-autofocus
            value={name[lang] ?? ""}
            maxLength={ABOUT_LIMITS.gearCategoryName}
            placeholder={tr("例如 相机、镜头、后期")}
            onChange={(e) => setName((n) => ({ ...n, [lang]: e.target.value }))}
          />
        </Field>
        {error ? (
          <p role="alert" className="text-[12.5px] text-status-error">
            {error}
          </p>
        ) : null}
      </form>
    </EditDialog>
  );
}
