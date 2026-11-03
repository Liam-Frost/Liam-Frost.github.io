import {
  INTEGRATION_FIELDS,
  type IntegrationField,
  type IntegrationProvider,
  type IntegrationStatus,
  type IntegrationUpdate,
  type IntegrationValues
} from "@liam-frost/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { PageHeader } from "../components/layout/AdminLayout";
import { Field } from "../components/ui/Field";
import { Panel } from "../components/ui/Panel";
import { Dialog } from "../components/ui/Dialog";
import { useToast } from "../components/ui/Toast";
import { api } from "../lib/api";

const KEY = ["admin", "integrations"] as const;
const PROVIDERS: Record<IntegrationProvider, { title: string; description: string }> = {
  tmdb: {
    title: "TMDB",
    description: "电影、剧集与影视人物。填写 v3 API Key 或 v4 Read Access Token。"
  },
  spotify: {
    title: "Spotify",
    description:
      "配置开发者应用后，到收藏的音乐页连接账号，导入已点赞歌曲和歌单。更换应用配置后需要重新连接。"
  },
  googlebooks: {
    title: "Google Books",
    description: "图书搜索与资料导入。不配置时仍可使用 Open Library。"
  },
  igdb: {
    title: "Twitch / IGDB",
    description: "使用 Twitch 开发者应用的 Client ID 和 Client Secret 搜索、导入游戏资料。"
  },
  steam: { title: "Steam", description: "Steam Web API Key。配置后可连接 Steam 账号并同步游戏库。" }
};
const LABELS: Record<IntegrationField, string> = {
  apiKey: "API Key / Token",
  clientId: "Client ID",
  clientSecret: "Client Secret",
  redirectUri: "Redirect URI"
};

export function IntegrationsPage() {
  const { data, isPending, error } = useQuery({ queryKey: KEY, queryFn: api.integrations });
  return (
    <>
      <PageHeader
        title="API 配置"
        description="管理第三方服务的访问凭据。保存后即时生效，无需修改服务器或重启。"
      />
      {isPending ? <p className="py-10 text-center text-[13px] text-subtle">加载中…</p> : null}
      {error ? (
        <p role="alert" className="text-[13px] text-status-error">
          {error.message}
        </p>
      ) : null}
      {data ? (
        <>
          <div className="mb-5 rounded-xl border border-line-soft bg-surface px-4 py-3 text-[12.5px] leading-relaxed text-muted">
            凭据加密保存，仅服务端使用，不显示已保存的原值。输入框留空会保留现有配置；停用后不会自动使用服务器上的旧凭据。配置仅作用于当前站点，预发布与正式环境分别保存。
          </div>
          {!data.editable ? (
            <p role="alert" className="mb-5 text-[13px] text-status-warn">
              需要先配置数据库与管理员密钥，才能保存 API 配置。
            </p>
          ) : null}
          <div className="grid items-start gap-5 xl:grid-cols-2">
            {(Object.keys(PROVIDERS) as IntegrationProvider[]).map((provider) => (
              <ProviderForm
                key={provider}
                provider={provider}
                status={data.providers[provider]}
                editable={data.editable}
              />
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

function ProviderForm({
  provider,
  status,
  editable
}: {
  provider: IntegrationProvider;
  status: IntegrationStatus;
  editable: boolean;
}) {
  const [values, setValues] = useState<IntegrationValues>({});
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<"disable" | "use-environment" | null>(null);
  const client = useQueryClient();
  const toast = useToast();
  const { title, description } = PROVIDERS[provider];
  const mutation = useMutation({
    mutationFn: (update: IntegrationUpdate) => api.updateIntegration(provider, update),
    onSuccess: (data, update) => {
      client.setQueryData(KEY, data);
      // Do not retain submitted secrets in the mutation cache after saving.
      if (update.values)
        for (const field of Object.keys(update.values) as IntegrationField[])
          delete update.values[field];
      setValues({});
      setError("");
      setConfirm(null);
      void client.invalidateQueries({ queryKey: ["admin"] });
      toast(
        update.action === "save"
          ? "已保存，配置已生效"
          : update.action === "disable"
            ? "已停用"
            : "已恢复使用服务器配置"
      );
    },
    onError: (e, update) => {
      if (update.values)
        for (const field of Object.keys(update.values) as IntegrationField[])
          delete update.values[field];
      setError(e.message);
    },
    gcTime: 0
  });
  const busy = mutation.isPending;
  const save = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const next = { ...values };
    if (provider === "spotify" && !status.fields.redirectUri && !next.redirectUri?.trim())
      next.redirectUri = `${window.location.origin}/api/admin/spotify/callback`;
    mutation.mutate({ action: "save", values: next });
  };
  const source =
    status.source === "admin"
      ? "后台配置"
      : status.source === "environment"
        ? "服务器配置"
        : "尚未配置";
  return (
    <Panel title={title}>
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span
          className={`rounded-full px-2 py-1 ${status.configured ? "bg-brand/10 text-brand" : "bg-line-soft text-subtle"}`}
        >
          {status.configured ? "已配置" : "未启用"}
        </span>
        <span className="text-faint">{source}</span>
      </div>
      <p className="text-[12.5px] leading-relaxed text-muted">{description}</p>
      <form onSubmit={save} className="space-y-3.5">
        <fieldset disabled={!editable || busy} className="space-y-3.5 disabled:opacity-60">
          {INTEGRATION_FIELDS[provider].map((field) => {
            const id = `integration-${provider}-${field}`;
            const redirect = field === "redirectUri";
            const placeholder = redirect
              ? (status.redirectUri ?? `${window.location.origin}/api/admin/spotify/callback`)
              : status.fields[field]
                ? "已配置 · 留空保留，输入新值替换"
                : "尚未配置";
            return (
              <Field
                key={field}
                label={LABELS[field]}
                htmlFor={id}
                hint={
                  redirect ? (
                    <>
                      在 Spotify Developer Dashboard 中登记完全相同的地址。
                      <a
                        href="https://developer.spotify.com/dashboard"
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand underline"
                      >
                        开发者后台
                      </a>
                    </>
                  ) : undefined
                }
              >
                <input
                  id={id}
                  name={id}
                  type={redirect ? "url" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  value={values[field] ?? ""}
                  placeholder={placeholder}
                  onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))}
                  className="field"
                  maxLength={4096}
                />
              </Field>
            );
          })}
          {error ? (
            <p role="alert" className="text-[12.5px] text-status-error">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary">
              {busy ? "处理中…" : "保存配置"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={!status.configured}
              onClick={() => setConfirm("disable")}
            >
              停用
            </button>
            {status.source === "admin" ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setConfirm("use-environment")}
              >
                恢复服务器配置
              </button>
            ) : null}
          </div>
        </fieldset>
      </form>
      {confirm ? (
        <Dialog
          open
          title={confirm === "disable" ? `停用 ${title}` : `恢复 ${title} 服务器配置`}
          onClose={() => {
            if (!busy) setConfirm(null);
          }}
        >
          <p className="text-[13px] leading-relaxed text-muted">
            {confirm === "disable"
              ? "停用后无法使用此服务搜索或同步，已导入的内容不受影响。"
              : "将删除后台保存的这组配置，改为使用服务器配置；服务器未配置时服务会停用。"}
            {provider === "spotify" ? " 配置改变后需要重新连接 Spotify。" : ""}
          </p>
          {error ? (
            <p role="alert" className="mt-3 text-[12.5px] text-status-error">
              {error}
            </p>
          ) : null}
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => mutation.mutate({ action: confirm })}
            >
              {busy ? "处理中…" : "确认"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              取消
            </button>
          </div>
        </Dialog>
      ) : null}
    </Panel>
  );
}
