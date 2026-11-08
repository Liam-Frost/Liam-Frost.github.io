import type { AdminBranding, BrandSlot } from "@liam-frost/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Upload } from "lucide-react";
import { useId, useRef, type ChangeEvent } from "react";

import { refreshPresentation } from "../../../../web/src/data/usePresentation";
import { refreshSiteSettings } from "../../../../web/src/data/useSiteSettings";
import { api } from "../../lib/api";
import { useConfirm } from "../ui/Confirm";
import { useToast } from "../ui/Toast";
import { tr } from "../../lib/messages";
import { ImmediateBadge } from "./SettingsUI";

const brandingKey = ["admin", "branding"] as const;

export function useBranding() {
  return useQuery({ queryKey: brandingKey, queryFn: api.branding });
}

/** Choose or remove the image of a slot. It takes effect at once; there is nothing else to save. */
export function BrandUpload({
  slot,
  label,
  hint
}: {
  slot: BrandSlot;
  label: string;
  hint: string;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const { data } = useBranding();
  const done = (result: AdminBranding, message: string) => {
    qc.setQueryData(brandingKey, result);
    refreshPresentation();
    refreshSiteSettings();
    toast(message);
  };
  const upload = useMutation({
    mutationFn: (file: File) => api.uploadBranding(slot, file),
    onSuccess: (result) => done(result, tr("已上传，网站上马上生效")),
    onError: (error: Error) => toast(error.message, "error")
  });
  const remove = useMutation({
    mutationFn: () => api.removeBranding(slot),
    onSuccess: (result) => done(result, tr("已恢复默认")),
    onError: (error: Error) => toast(error.message, "error")
  });
  const busy = upload.isPending || remove.isPending;
  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) upload.mutate(file);
  };

  const restore = async () => {
    if (
      await confirm({
        title: tr("恢复默认？"),
        message: tr("当前图片会被删除，网站上立刻改回默认，无法撤销。"),
        confirmLabel: tr("恢复默认"),
        danger: true
      })
    )
      remove.mutate();
  };

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-[12.5px] font-medium text-brand-dark">
        {label}
        <ImmediateBadge />
      </label>
      <input
        ref={input}
        id={inputId}
        type="file"
        accept="image/svg+xml,image/png,image/webp,image/jpeg"
        className="sr-only"
        disabled={busy}
        onChange={choose}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <Upload aria-hidden="true" className="size-4" />
          {upload.isPending ? tr("上传中…") : data?.[slot] ? tr("更换图片") : tr("上传图片")}
        </button>
        {data?.[slot] ? (
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => void restore()}
          >
            <Trash2 aria-hidden="true" className="size-4" />
            {remove.isPending ? tr("移除中…") : tr("恢复默认")}
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-[11.5px] leading-relaxed text-faint">{hint}</p>
    </div>
  );
}

/** The home page avatar: a small preview beside its upload controls. */
export function AvatarUpload() {
  const { data } = useBranding();
  return (
    <div className="flex items-start gap-4">
      <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-canvas text-[11px] text-faint">
        {data?.avatar ? (
          <img src={data.avatar} alt="" className="size-full object-cover" />
        ) : (
          tr("现有默认头像")
        )}
      </span>
      <div className="min-w-0">
        <BrandUpload
          slot="avatar"
          label={tr("头像图片")}
          hint={tr("建议使用正方形图片。SVG、PNG、WebP 或 JPEG，不超过 2 MB。")}
        />
      </div>
    </div>
  );
}
