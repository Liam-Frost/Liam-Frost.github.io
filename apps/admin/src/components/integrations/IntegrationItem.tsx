import {
  INTEGRATION_FIELDS,
  type AdminDashboard,
  type IntegrationField,
  type IntegrationProvider,
  type IntegrationStatus,
  type IntegrationUpdate,
  type IntegrationValues
} from "@liam-frost/shared";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";

import { api } from "../../lib/api";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { Time } from "../ui/Time";
import { useToast } from "../ui/Toast";
import { tr } from "../../lib/messages";

export const INTEGRATIONS_KEY = ["admin", "integrations"] as const;

export const PROVIDERS: Record<
  IntegrationProvider,
  { title: string; summary: string; help: ReactNode }
> = {
  tmdb: {
    title: "TMDB",
    summary: tr("电影、剧集和影视人物的搜索与资料"),
    help: tr("填写 v3 API Key 或 v4 Read Access Token，二选一。")
  },
  googlebooks: {
    title: "Google Books",
    summary: tr("图书搜索与资料导入"),
    help: tr("不配置时图书仍可用 Open Library 和 Bangumi 搜索。")
  },
  igdb: {
    title: "Twitch / IGDB",
    summary: tr("游戏搜索与资料导入"),
    help: tr("使用 Twitch 开发者应用的 Client ID 和 Client Secret。")
  },
  spotify: {
    title: "Spotify",
    summary: tr("导入点赞歌曲和歌单，连接 Spotify 账号"),
    help: tr("保存应用配置后，到 收藏 → 音乐 → Spotify 账号 连接账号。更换应用后需要重新连接。")
  },
  steam: {
    title: "Steam",
    summary: tr("连接 Steam 账号，同步游戏库"),
    help: tr("Steam Web API Key。保存后到 收藏 → 游戏 → Steam 游戏库 连接账号并同步。")
  }
};

const LABELS: Record<IntegrationField, string> = {
  apiKey: "API Key / Token",
  clientId: "Client ID",
  clientSecret: "Client Secret",
  redirectUri: "Redirect URI"
};

export type Credential = "configured" | "disabled" | "unset";

/** Disabled: the admin saved an empty override, so server credentials are not used either. */
export function credentialOf(status: IntegrationStatus): Credential {
  if (status.configured) return "configured";
  return status.source === "admin" ? "disabled" : "unset";
}

const CREDENTIAL: Record<Credential, { label: string; className: string }> = {
  configured: { label: tr("已配置"), className: "bg-brand/10 text-brand" },
  disabled: { label: tr("已停用"), className: "bg-status-warn/12 text-status-warn" },
  unset: { label: tr("未配置"), className: "bg-line-soft text-subtle" }
};

export function CredentialBadge({ credential }: { credential: Credential }) {
  const { label, className } = CREDENTIAL[credential];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] leading-4 whitespace-nowrap ${className}`}
    >
      {label}
    </span>
  );
}

export const hasDraft = (values: IntegrationValues | undefined) =>
  Boolean(values && Object.values(values).some((value) => value?.trim()));

const defaultRedirect = () => `${window.location.origin}/api/admin/spotify/callback`;

/**
 * What the site last saw from this service. This page tests nothing: sources show the result of their
 * last request from the job log, Spotify and Steam whether an account is connected.
 */
function Connection({
  provider,
  credential,
  dashboard
}: {
  provider: IntegrationProvider;
  credential: Credential;
  dashboard: AdminDashboard | undefined;
}) {
  if (credential !== "configured") return <>—</>;
  const connections = dashboard?.connections.ok ? dashboard.connections.data : null;
  if (!connections) return <>{tr("未检测")}</>;
  if (provider === "spotify") {
    const account = connections.spotify.account;
    return account ? (
      <>{tr("已连接账号 {0}", account.displayName)}</>
    ) : (
      <>
        {tr("未连接账号 ·")}{" "}
        <Link to="/collection?kind=track&open=spotify" className="text-brand hover:underline">
          {tr("去连接")}
        </Link>
      </>
    );
  }
  if (provider === "steam") {
    const account = connections.steam.account;
    return account ? (
      <>
        {tr("已连接 {0} · 上次同步", account.name)}{" "}
        {account.lastSyncedAt ? <Time iso={account.lastSyncedAt} /> : tr("从未")}
      </>
    ) : (
      <>
        {tr("未连接账号 ·")}{" "}
        <Link to="/collection?kind=game&open=steam" className="text-brand hover:underline">
          {tr("去连接")}
        </Link>
      </>
    );
  }
  const source = connections.sources.find((s) => s.name === provider);
  if (!source || (!source.lastOk && !source.lastError))
    return <>{tr("未检测（还没有请求记录）")}</>;
  const failing = source.lastError && (!source.lastOk || source.lastOk < source.lastError);
  return failing ? (
    <span className="text-status-error">
      {tr("最近一次请求失败 ·")} <Time iso={source.lastError!} />
      {source.lastErrorMessage ? `：${source.lastErrorMessage}` : ""}
    </span>
  ) : (
    <>
      {tr("最近一次请求成功 ·")} <Time iso={source.lastOk!} />
    </>
  );
}

/**
 * One service in the list: a row that opens its settings below. The draft lives in the page, so it
 * survives switching to another service; secrets are only ever sent, never read back.
 */
export function IntegrationItem({
  provider,
  status,
  editable,
  open,
  onToggle,
  draft,
  onDraft,
  dashboard
}: {
  provider: IntegrationProvider;
  status: IntegrationStatus;
  editable: boolean;
  open: boolean;
  onToggle: () => void;
  draft: IntegrationValues;
  onDraft: (values: IntegrationValues) => void;
  dashboard: AdminDashboard | undefined;
}) {
  const id = useId();
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<"disable" | "use-environment" | null>(null);
  const client = useQueryClient();
  const toast = useToast();
  const { title, summary, help } = PROVIDERS[provider];
  const credential = credentialOf(status);
  const dirty = hasDraft(draft);

  const mutation = useMutation({
    mutationKey: ["admin", "integration-save", provider],
    mutationFn: (update: IntegrationUpdate) => api.updateIntegration(provider, update),
    onSuccess: (data, update) => {
      client.setQueryData(INTEGRATIONS_KEY, data);
      // Do not retain submitted secrets in the mutation cache after saving.
      if (update.values)
        for (const field of Object.keys(update.values) as IntegrationField[])
          delete update.values[field];
      onDraft({});
      setError("");
      setConfirm(null);
      void client.invalidateQueries({ queryKey: ["admin"] });
      toast(
        update.action === "save"
          ? tr("{0} 已保存，配置已生效", title)
          : update.action === "disable"
            ? tr("{0} 已停用", title)
            : tr("{0} 已恢复使用服务器配置", title)
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
  const busy = useIsMutating({ mutationKey: ["admin", "integration-save", provider] }) > 0;

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (busy || !dirty) return;
    setError("");
    const next = { ...draft };
    if (provider === "spotify" && !status.fields.redirectUri && !next.redirectUri?.trim())
      next.redirectUri = defaultRedirect();
    mutation.mutate({ action: "save", values: next });
  };

  const source =
    status.source === "admin"
      ? tr("后台配置（覆盖服务器上的配置）")
      : status.source === "environment"
        ? tr("服务器配置（环境变量）")
        : tr("无");

  return (
    <li>
      <h3>
        <button
          type="button"
          id={`${id}-button`}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={onToggle}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-brand-secondary/5 focus-visible:bg-brand-secondary/5 sm:px-5"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-brand-dark">{title}</span>
            <span className="block text-[12.5px] leading-snug text-muted">{summary}</span>
          </span>
          {dirty ? (
            <span className="hidden text-[11.5px] whitespace-nowrap text-status-warn sm:inline">
              {tr("未保存")}
            </span>
          ) : null}
          {dirty ? (
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full bg-status-warn sm:hidden"
            />
          ) : null}
          <CredentialBadge credential={credential} />
          <span className="sr-only">{dirty ? tr("，有未保存的修改") : ""}</span>
          <ChevronDown
            aria-hidden="true"
            className={`size-4 shrink-0 text-faint transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          />
        </button>
      </h3>
      {/* Grows from 0fr to 1fr; inert while closed so its fields are not focusable. */}
      <div
        id={`${id}-panel`}
        role="region"
        aria-labelledby={`${id}-button`}
        inert={!open}
        className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-line-soft bg-canvas/50 px-4 py-4 sm:px-5">
            <dl className="mb-4 grid gap-x-4 gap-y-1.5 text-[12.5px] sm:grid-cols-[6.5rem_minmax(0,1fr)]">
              <dt className="text-faint">{tr("配置来源")}</dt>
              <dd className="text-ink">{source}</dd>
              <dt className="text-faint">{tr("连接情况")}</dt>
              <dd className="text-ink">
                <Connection provider={provider} credential={credential} dashboard={dashboard} />
              </dd>
            </dl>
            <p className="mb-4 text-[12.5px] leading-relaxed text-muted">{help}</p>
            {credential === "disabled" ? (
              <p className="mb-4 text-[12.5px] text-status-warn">
                {tr("已停用：不使用后台和服务器上的凭据。填写完整凭据并保存即可重新启用。")}
              </p>
            ) : null}

            <form onSubmit={save} noValidate>
              <fieldset disabled={!editable || busy} className="space-y-3.5">
                <legend className="sr-only">{tr("{0} 凭据", title)}</legend>
                {INTEGRATION_FIELDS[provider].map((field) => {
                  const fieldId = `integration-${provider}-${field}`;
                  const redirect = field === "redirectUri";
                  const placeholder = redirect
                    ? (status.redirectUri ?? defaultRedirect())
                    : status.fields[field]
                      ? tr("已保存 · 留空保留，输入新值替换")
                      : tr("尚未配置");
                  return (
                    <Field
                      key={field}
                      label={LABELS[field]}
                      htmlFor={fieldId}
                      hint={
                        redirect ? (
                          <>
                            {tr("须为本站的")}{" "}
                            <span className="break-all">/api/admin/spotify/callback</span>
                            {tr("，并在")}{" "}
                            <a
                              href="https://developer.spotify.com/dashboard"
                              target="_blank"
                              rel="noreferrer"
                              className="text-brand underline"
                            >
                              {tr("Spotify 开发者后台")}
                            </a>
                            {tr(
                              "登记完全相同的地址。{0}",
                              status.fields.redirectUri
                                ? tr("留空保留已保存的地址。")
                                : tr("留空使用当前站点的地址。")
                            )}
                          </>
                        ) : status.fields[field] ? (
                          tr("已保存的值不会显示。")
                        ) : undefined
                      }
                    >
                      <input
                        id={fieldId}
                        name={fieldId}
                        type={redirect ? "url" : "password"}
                        autoComplete="off"
                        spellCheck={false}
                        value={draft[field] ?? ""}
                        placeholder={placeholder}
                        onChange={(e) => onDraft({ ...draft, [field]: e.target.value })}
                        className="field min-w-0 text-ellipsis"
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
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button type="submit" className="btn-primary" disabled={!dirty || busy}>
                    {busy && !confirm ? tr("保存中…") : tr("保存配置")}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={!dirty || busy}
                    onClick={() => {
                      onDraft({});
                      setError("");
                    }}
                  >
                    {tr("取消修改")}
                  </button>
                </div>
              </fieldset>
            </form>

            {status.configured || status.source === "admin" ? (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line-soft pt-3 text-[12.5px]">
                <span className="text-faint">{tr("管理配置")}</span>
                {status.configured ? (
                  <button
                    type="button"
                    disabled={!editable || busy}
                    onClick={() => setConfirm("disable")}
                    className="text-muted underline-offset-2 hover:text-brand hover:underline disabled:opacity-50"
                  >
                    {tr("停用")}
                  </button>
                ) : null}
                {status.source === "admin" ? (
                  <button
                    type="button"
                    disabled={!editable || busy}
                    onClick={() => setConfirm("use-environment")}
                    className="text-subtle underline-offset-2 hover:text-brand hover:underline disabled:opacity-50"
                  >
                    {tr("恢复服务器配置")}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {confirm ? (
        <Dialog
          open
          size="sm"
          title={confirm === "disable" ? tr("停用 {0}", title) : tr("恢复 {0} 的服务器配置", title)}
          onClose={() => {
            if (!busy) setConfirm(null);
          }}
          footer={
            <>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => setConfirm(null)}
              >
                {tr("取消")}
              </button>
              <button
                type="button"
                className={confirm === "disable" ? "btn-danger" : "btn-primary"}
                disabled={busy}
                onClick={() => mutation.mutate({ action: confirm })}
              >
                {busy ? tr("处理中…") : confirm === "disable" ? tr("停用") : tr("恢复")}
              </button>
            </>
          }
        >
          <p className="text-[13px] leading-relaxed text-muted">
            {confirm === "disable"
              ? tr(
                  "停用后不再使用 {0} 的任何凭据（包括服务器上的配置），也无法用它搜索或同步；已导入的内容不受影响。之后填写凭据保存，或恢复服务器配置，都能重新启用。",
                  title
                )
              : tr(
                  "将删除后台保存的 {0} 配置（{1}），改用服务器环境变量里的配置；服务器没有配置时，{2} 会变成未配置。服务器上的配置不会被修改。",
                  title,
                  INTEGRATION_FIELDS[provider].map((f) => LABELS[f]).join("、"),
                  title
                )}
            {provider === "spotify" ? tr(" 配置改变后需要重新连接 Spotify 账号。") : ""}
          </p>
          {error ? (
            <p role="alert" className="mt-3 text-[12.5px] text-status-error">
              {error}
            </p>
          ) : null}
        </Dialog>
      ) : null}
    </li>
  );
}
