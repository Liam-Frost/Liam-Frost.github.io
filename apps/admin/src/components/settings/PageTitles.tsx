import type { LocalizedText, SiteSettingsDocument, SiteSettingsGroups } from "@liam-frost/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { refreshSiteSettings } from "../../../../web/src/data/useSiteSettings";
import { request } from "../../lib/api";
import type { Lang } from "../../lib/i18n";
import { tr } from "../../lib/messages";
import { Field } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { SettingsLanguages, SettingsSection } from "./SettingsUI";

type Identity = SiteSettingsDocument<"identity"> & { value: SiteSettingsGroups["identity"] };
type Titles = { title: LocalizedText; adminTitle: LocalizedText };

const key = ["admin", "site-settings", "identity"];

/** The browser tab titles of the site and the admin, saved on their own next to the site icon. */
export function PageTitles() {
  const qc = useQueryClient();
  const toast = useToast();
  const [lang, setLang] = useState<Lang>("zh");
  const [draft, setDraft] = useState<Titles | null>(null);
  const q = useQuery({
    queryKey: key,
    queryFn: () => request<Identity>("/api/admin/site-settings/identity")
  });
  const saved: Titles = {
    title: q.data?.value.title ?? {},
    adminTitle: q.data?.value.adminTitle ?? {}
  };
  const value = draft ?? saved;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(saved);
  const save = useMutation({
    mutationFn: () =>
      request<Identity>("/api/admin/site-settings/identity", {
        method: "PUT",
        json: { value: { ...q.data!.value, ...value }, revision: q.data!.revision }
      }),
    onSuccess: (result) => {
      qc.setQueryData(key, result);
      setDraft(null);
      refreshSiteSettings();
      toast(tr("页面标题已保存"));
    },
    onError: (error: Error) => {
      toast(error.message, "error");
      void q.refetch();
    }
  });
  const field = (name: keyof Titles, label: string, max: number) => (
    <Field label={label} htmlFor={`page-title-${name}-${lang}`}>
      <input
        id={`page-title-${name}-${lang}`}
        className="field"
        maxLength={max}
        value={value[name][lang] ?? ""}
        onChange={(event) =>
          setDraft({ ...value, [name]: { ...value[name], [lang]: event.target.value } })
        }
      />
    </Field>
  );

  return (
    <SettingsSection
      title={tr("页面标题")}
      description={tr("显示在浏览器标签页上。后台标题也用作侧栏顶部的名称。留空使用默认标题。")}
    >
      <div className="space-y-3.5">
        <SettingsLanguages value={lang} onChange={setLang} />
        {field("title", tr("前台页面标题"), 160)}
        {field("adminTitle", tr("后台页面标题"), 80)}
        <button
          type="button"
          className="btn-primary"
          disabled={!dirty || save.isPending || !q.data}
          onClick={() => save.mutate()}
        >
          {save.isPending ? tr("保存中…") : tr("保存页面标题")}
        </button>
      </div>
    </SettingsSection>
  );
}
