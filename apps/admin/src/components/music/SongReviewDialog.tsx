import type { AdminMediaItem, LocalizedText } from "@liam-frost/shared";
import { useState } from "react";

import { useUpdateMedia } from "../../hooks/useMedia";
import { LANG_LABELS, LANGS, pickText, type Lang } from "../../lib/i18n";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { StarRating } from "../ui/StarRating";
import { useToast } from "../ui/Toast";
import { tr } from "../../lib/messages";
import { Select } from "../ui/Select";

export function SongReviewDialog({ item, onClose }: { item: AdminMediaItem; onClose: () => void }) {
  const [rating, setRating] = useState(item.rating);
  const [review, setReview] = useState<LocalizedText>({ ...item.review });
  const [lang, setLang] = useState<Lang>("zh");
  const update = useUpdateMedia(item.id);
  const toast = useToast();
  const dirty = rating !== item.rating || JSON.stringify(review) !== JSON.stringify(item.review);
  return (
    <Dialog
      open
      title={tr("评分与短评 · {0}", pickText(item.title, tr("未命名")))}
      onClose={() => {
        if (!update.isPending) onClose();
      }}
      size="sm"
      footer={
        <>
          <button
            className="btn-secondary"
            type="button"
            disabled={update.isPending}
            onClick={onClose}
          >
            {tr("取消")}
          </button>
          <button
            className="btn-primary"
            type="submit"
            form="song-review"
            disabled={update.isPending || !dirty}
          >
            {update.isPending ? tr("保存中…") : tr("保存")}
          </button>
        </>
      }
    >
      <form
        id="song-review"
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          update.mutate(
            { rating, review },
            {
              onSuccess: () => {
                toast(tr("评分与短评已保存"));
                onClose();
              }
            }
          );
        }}
      >
        <div>
          <p className="mb-2 text-[12.5px] font-medium text-brand-dark">{tr("我的评分")}</p>
          <StarRating value={rating} onChange={setRating} />
        </div>
        <Field label={tr("短评语言")} htmlFor="song-review-lang">
          <Select
            id="song-review-lang"
            value={lang}
            onChange={(value) => setLang(value as Lang)}
            options={[
              ...LANGS.map((value) => ({
                value: value,
                label: `${LANG_LABELS[value]}${review[value]?.trim() ? " ✓" : ""}`
              }))
            ]}
          />
        </Field>
        <Field
          label={tr("个人短评")}
          htmlFor="song-review-text"
          hint={tr("会显示在网站上。其他语言的内容会保留。")}
        >
          <textarea
            id="song-review-text"
            className="field resize-y leading-relaxed"
            rows={5}
            maxLength={5000}
            value={review[lang] ?? ""}
            onChange={(event) => setReview({ ...review, [lang]: event.target.value })}
            placeholder={tr("这首歌打动你的地方…")}
          />
        </Field>
        {update.error ? (
          <p role="alert" className="text-[12.5px] text-status-error">
            {update.error.message}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
