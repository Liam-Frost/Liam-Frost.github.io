import type { AnalyticsPreferences, AnalyticsPreferencesStatus } from "@liam-frost/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Database,
  FileCheck2,
  Globe2,
  LoaderCircle,
  ShieldCheck,
  Upload,
  X
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { api } from "../../lib/api";
import { Field } from "../ui/Field";
import { Panel } from "../ui/Panel";
import { useToast } from "../ui/Toast";
import { tr } from "../../lib/messages";

export function SettingsView() {
  const query = useQuery({
    queryKey: ["admin", "analytics-preferences"],
    queryFn: api.analyticsPreferences
  });
  if (query.error)
    return (
      <p role="alert" className="text-status-error">
        {query.error.message}
      </p>
    );
  return query.data ? (
    <SettingsForm key={query.data.revision} data={query.data} />
  ) : (
    <div className="card h-72 animate-pulse bg-brand/5" aria-label={tr("正在加载统计设置")} />
  );
}

const MODES = [
  {
    value: "header",
    title: tr("可信代理请求头"),
    description: tr("使用 Cloudflare 提供的国家代码，无需维护数据库。"),
    icon: Globe2
  },
  {
    value: "database",
    title: tr("本地地理数据库"),
    description: tr("上传 Country MMDB，由服务器根据 IP 查询国家。"),
    icon: Database
  },
  {
    value: "environment",
    title: tr("服务器默认"),
    description: tr("沿用部署时的国家识别配置。"),
    icon: ShieldCheck
  },
  {
    value: "none",
    title: tr("关闭国家识别"),
    description: tr("保留访问统计，不记录国家和地区。"),
    icon: X
  }
] as const;

function SettingsForm({ data }: { data: AnalyticsPreferencesStatus }) {
  const [values, setValues] = useState<AnalyticsPreferences>(data.values);
  const [ips, setIps] = useState(data.values.excludeIps.join("\n"));
  const [confirmRetention, setConfirmRetention] = useState(false);
  const [database, setDatabase] = useState(data.database);
  const [uploadError, setUploadError] = useState("");
  const client = useQueryClient();
  const toast = useToast();
  const nextValues = { ...values, excludeIps: ips.split(/[\s,]+/).filter(Boolean) };
  const dirty = JSON.stringify(nextValues) !== JSON.stringify(data.values);
  const save = useMutation({
    mutationFn: () =>
      api.saveAnalyticsPreferences({
        values: nextValues,
        revision: data.revision,
        confirmRetention
      }),
    onSuccess: async () => {
      toast(tr("统计设置已保存，立即生效"));
      await client.invalidateQueries({ queryKey: ["admin"] });
    }
  });
  const upload = useMutation({
    mutationFn: api.uploadAnalyticsDatabase,
    onSuccess: (result) => {
      setDatabase(result);
      setValues((old) => ({ ...old, countryMode: "database", databaseId: result.id }));
      toast(tr("数据库校验通过，保存设置后启用"));
    }
  });
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const pending = save.isPending || upload.isPending;
  const error = uploadError || (upload.error ?? save.error)?.message;
  const takeFile = (file: File) => {
    if (pending || !data.editable) return;
    setUploadError("");
    if (!/\.mmdb$/i.test(file.name))
      return setUploadError(tr("请选择 .mmdb 格式的 Country 数据库。"));
    if (file.size > 32 * 1024 ** 2 || file.size === 0)
      return setUploadError(tr("数据库不能为空，且不能超过 32 MiB。"));
    upload.mutate(file);
  };
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {data.error ? (
        <p role="alert" className="card border-status-error/30 p-4 text-[13px] text-status-error">
          {data.error}
        </p>
      ) : null}
      <fieldset
        disabled={pending || !data.editable}
        className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"
      >
        <div className="min-w-0 space-y-5">
          <Panel title={tr("采集与隐私")}>
            <p className="text-[13px] leading-relaxed text-muted">
              {tr("控制记录保留时间和隐私边界。统计总开关仍在页面右上方。")}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={tr("原始记录保留天数")}
                htmlFor="analytics-retention"
                hint={tr("7–730 天；过期后只保留按天汇总。")}
              >
                <input
                  id="analytics-retention"
                  className="field"
                  type="number"
                  min={7}
                  max={730}
                  required
                  value={values.retentionDays}
                  onChange={(e) => setValues({ ...values, retentionDays: Number(e.target.value) })}
                />
              </Field>
              <Field
                label={tr("分组最少访客数")}
                htmlFor="analytics-group"
                hint={tr("不足此人数时隐藏分组的具体数字。")}
              >
                <input
                  id="analytics-group"
                  className="field"
                  type="number"
                  min={1}
                  max={50}
                  required
                  value={values.minGroupSize}
                  onChange={(e) => setValues({ ...values, minGroupSize: Number(e.target.value) })}
                />
              </Field>
            </div>
            <Field
              label={tr("每 IP 每分钟事件请求上限")}
              htmlFor="analytics-rate"
              hint={tr("仍受全站安全限流约束；不影响普通页面浏览。")}
            >
              <input
                id="analytics-rate"
                className="field"
                type="number"
                min={1}
                max={10000}
                required
                value={values.rateLimitPerMinute}
                onChange={(e) =>
                  setValues({ ...values, rateLimitPerMinute: Number(e.target.value) })
                }
              />
            </Field>
            <Field
              label={tr("排除的 IP / CIDR")}
              htmlFor="analytics-exclude"
              hint={tr(
                "每行一项，支持 IPv4 / IPv6。规则仅管理员可见，这些来源不会被计入访问统计。"
              )}
            >
              <textarea
                id="analytics-exclude"
                className="field min-h-28 resize-y font-mono text-[12px]"
                rows={3}
                value={ips}
                onChange={(e) => setIps(e.target.value)}
                placeholder="203.0.113.8&#10;2001:db8::/32"
                spellCheck={false}
              />
            </Field>
          </Panel>
          <Panel title={tr("国家和地区识别")}>
            <div
              className="grid gap-2.5 sm:grid-cols-2"
              role="group"
              aria-label={tr("国家识别方式")}
            >
              {MODES.map(({ value, title, description, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={values.countryMode === value}
                  onClick={() => {
                    setUploadError("");
                    upload.reset();
                    setValues({ ...values, countryMode: value });
                  }}
                  className={`flex min-w-0 items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${values.countryMode === value ? "border-brand-secondary bg-brand-secondary/8 ring-1 ring-brand-secondary/20" : "border-line hover:border-brand-secondary/50 hover:bg-brand/3"}`}
                >
                  <Icon
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-brand-secondary"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-semibold text-brand-dark">
                      {title}
                    </span>
                    <span className="mt-1 block text-[11.5px] leading-relaxed text-muted">
                      {description}
                    </span>
                  </span>
                  {values.countryMode === value ? (
                    <Check aria-hidden="true" className="size-3.5 shrink-0 text-brand" />
                  ) : null}
                </button>
              ))}
            </div>
            {values.countryMode === "environment" ? (
              <p className="rounded-xl bg-brand-secondary/6 px-3 py-2.5 text-[12px] text-muted">
                {tr(
                  "当前默认：{0}。",
                  data.environmentCountrySource === "header"
                    ? tr("代理请求头")
                    : data.environmentCountrySource === "geoip"
                      ? tr("地理数据库")
                      : tr("未配置国家识别")
                )}
              </p>
            ) : null}
            {values.countryMode === "header" ? (
              <Field
                label={tr("国家代码请求头")}
                htmlFor="analytics-country-header"
                hint={tr(
                  "仅在可信代理覆盖请求头、源站受保护时使用；这不会修改代理信任范围或防火墙。"
                )}
              >
                <input
                  id="analytics-country-header"
                  className="field font-mono text-[12px]"
                  required
                  pattern="[A-Za-z0-9-]+"
                  maxLength={100}
                  value={values.countryHeader}
                  onChange={(e) => setValues({ ...values, countryHeader: e.target.value })}
                />
                <button
                  type="button"
                  className="mt-2 text-[12px] font-medium text-brand hover:underline"
                  onClick={() => setValues({ ...values, countryHeader: "cf-ipcountry" })}
                >
                  {tr("使用 Cloudflare 默认值：cf-ipcountry")}
                </button>
              </Field>
            ) : null}
            {values.countryMode === "database" ? (
              <>
                <DatabaseUpload
                  busy={upload.isPending}
                  disabled={pending || !data.editable}
                  onFile={takeFile}
                />
                {database ? (
                  <div className="flex items-start gap-3 rounded-xl border border-status-ok/20 bg-status-ok/5 p-3">
                    <FileCheck2
                      aria-hidden="true"
                      className="mt-0.5 size-5 shrink-0 text-status-ok"
                    />
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-semibold text-brand-dark">{database.type}</p>
                      <p className="mt-1 text-[11.5px] text-muted">
                        {tr(
                          "数据日期 {0} · {1}",
                          database.builtAt.slice(0, 10),
                          database.bytes < 1024 ** 2
                            ? `${Math.ceil(database.bytes / 1024)} KiB`
                            : `${(database.bytes / 1024 ** 2).toFixed(1)} MiB`
                        )}
                      </p>
                      <p className="mt-1 text-[11.5px] text-muted">
                        {database.id === data.values.databaseId &&
                        data.values.countryMode === "database"
                          ? tr("当前正在使用")
                          : tr("校验通过，保存设置后启用")}
                      </p>
                    </div>
                  </div>
                ) : null}
                <p className="text-[11.5px] leading-relaxed text-faint">
                  {tr(
                    "数据库只在服务器使用，不提供公开下载。更新时上传新版本；请确认来源和使用许可。"
                  )}
                </p>
              </>
            ) : null}
          </Panel>
        </div>
        <aside className="space-y-5">
          <Panel title={tr("生效方式")}>
            <div className="flex items-start gap-2.5 text-[13px] leading-relaxed text-muted">
              <ShieldCheck
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-brand-secondary"
              />
              <p>{tr("保存后立即生效，无需重启。设置仅属于当前环境，预发布与正式环境独立。")}</p>
            </div>
            <p className="border-t border-line-soft pt-3 text-[12px] leading-relaxed text-muted">
              {tr(
                "{0}更改国家识别方式只影响之后的新访问，已有数据保留。",
                data.saved
                  ? tr("当前使用后台保存的配置。")
                  : tr("尚未保存，当前沿用服务器默认配置。")
              )}
            </p>
          </Panel>
          <Panel title={tr("统计时区")}>
            <p className="font-mono text-[13px] text-brand-dark">{data.timezone}</p>
            <p className="text-[12px] leading-relaxed text-muted">
              {tr("历史数据已按此时区汇总。更改时区需要先处理历史日期口径，由运维完成。")}
            </p>
          </Panel>
        </aside>
      </fieldset>
      {values.retentionDays < data.values.retentionDays ? (
        <label className="flex items-start gap-2.5 rounded-xl border border-status-warn/30 bg-status-warn/5 p-4 text-[12.5px] leading-relaxed text-status-warn">
          <input
            className="mt-1 shrink-0 accent-current"
            type="checkbox"
            required
            checked={confirmRetention}
            onChange={(e) => setConfirmRetention(e.target.checked)}
          />
          {tr("我确认：下一次维护将永久删除新保留期之外的原始记录；已有按天汇总保留。")}
        </label>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-status-error/30 bg-status-error/5 p-3 text-[12.5px] text-status-error"
        >
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p
          className={`text-[12px] ${dirty || data.error ? "text-status-warn" : "text-faint"}`}
          role="status"
        >
          {data.error
            ? tr("修正后保存，可恢复统计采集")
            : dirty
              ? tr("有未保存的修改")
              : tr("当前设置已同步")}
        </p>
        <button
          className="btn-primary"
          disabled={pending || !data.editable || (!dirty && !data.error)}
          type="submit"
        >
          {save.isPending ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Check aria-hidden="true" className="size-4" />
          )}
          {save.isPending ? tr("保存中…") : tr("保存统计设置")}
        </button>
      </div>
    </form>
  );
}

function DatabaseUpload({
  busy,
  disabled,
  onFile
}: {
  busy: boolean;
  disabled: boolean;
  onFile: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(event) => {
        if (disabled || !event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        if (!disabled && event.dataTransfer.files[0]) onFile(event.dataTransfer.files[0]);
      }}
      className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${over ? "border-brand-secondary bg-brand-secondary/8" : "border-line bg-brand-secondary/3"} ${disabled ? "opacity-60" : ""}`}
      aria-busy={busy}
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-brand-secondary/10 text-brand-secondary">
        {busy ? (
          <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
        ) : (
          <Upload aria-hidden="true" className="size-5" />
        )}
      </span>
      <div>
        <p className="text-[13px] font-medium text-brand-dark">
          {busy ? tr("正在上传并校验数据库…") : tr("将 Country MMDB 拖到这里")}
        </p>
        <p className="mt-1 text-[11.5px] text-faint">
          {tr(".mmdb 格式 · 最大 32 MiB · 通过校验后可启用")}
        </p>
      </div>
      <button
        className="btn-secondary"
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        {busy ? tr("校验中…") : tr("选择数据库文件")}
      </button>
      <input
        ref={input}
        hidden
        type="file"
        accept=".mmdb"
        aria-label={tr("上传 Country MMDB")}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
