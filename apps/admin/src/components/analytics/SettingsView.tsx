import type { AnalyticsPreferences, AnalyticsPreferencesStatus } from "@liam-frost/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "../../lib/api";

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
  return query.data ? <SettingsForm key={query.data.revision} data={query.data} /> : <p>加载中…</p>;
}

function SettingsForm({ data }: { data: AnalyticsPreferencesStatus }) {
  const [values, setValues] = useState<AnalyticsPreferences>(data.values);
  const [ips, setIps] = useState(data.values.excludeIps.join("\n"));
  const [confirmRetention, setConfirmRetention] = useState(false);
  const [database, setDatabase] = useState(data.database);
  const [message, setMessage] = useState("");
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: () =>
      api.saveAnalyticsPreferences({
        values: { ...values, excludeIps: ips.split(/[\s,]+/).filter(Boolean) },
        revision: data.revision,
        confirmRetention
      }),
    onSuccess: async () => {
      setMessage("已保存，立即生效。");
      await client.invalidateQueries({ queryKey: ["admin"] });
    }
  });
  const upload = useMutation({
    mutationFn: api.uploadAnalyticsDatabase,
    onSuccess: (result) => {
      setDatabase(result);
      setValues((old) => ({ ...old, countryMode: "database", databaseId: result.id }));
      setMessage("数据库已校验；保存设置后启用。");
    }
  });
  const pending = save.isPending || upload.isPending;
  const field = "field mt-1 w-full";
  return (
    <form
      className="card max-w-[760px] space-y-5 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div>
        <h2 className="font-semibold">采集与隐私</h2>
        <p className="mt-1 text-[13px] text-muted">
          统计总开关在页面右上方。这里的设置只影响当前环境；未保存时沿用服务器默认值。
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          原始记录保留天数
          <input
            className={field}
            type="number"
            min={7}
            max={730}
            required
            value={values.retentionDays}
            onChange={(e) => setValues({ ...values, retentionDays: Number(e.target.value) })}
          />
        </label>
        <label>
          分组展示的最少访客数
          <input
            className={field}
            type="number"
            min={1}
            max={50}
            required
            value={values.minGroupSize}
            onChange={(e) => setValues({ ...values, minGroupSize: Number(e.target.value) })}
          />
          <span className="text-[12px] text-muted">少于此人数的分组隐藏具体数字。</span>
        </label>
        <label>
          每 IP 每分钟事件请求上限
          <input
            className={field}
            type="number"
            min={1}
            max={10000}
            required
            value={values.rateLimitPerMinute}
            onChange={(e) => setValues({ ...values, rateLimitPerMinute: Number(e.target.value) })}
          />
        </label>
        <div>
          统计时区<div className="mt-2 text-muted">{data.timezone}</div>
          <p className="text-[12px] text-muted">
            历史数据已按此时区汇总。更改需评估历史口径后由运维操作。
          </p>
        </div>
      </div>
      <label className="block">
        排除的 IP / CIDR
        <textarea
          className={field}
          rows={3}
          value={ips}
          onChange={(e) => setIps(e.target.value)}
          placeholder="每行一项，支持 IPv4 和 IPv6"
        />
        <span className="text-[12px] text-muted">
          不记录这些来源的访问。规则仅管理员可见；访客原始 IP 不写入统计。
        </span>
      </label>
      <div className="border-t border-line pt-4">
        <h2 className="font-semibold">国家和地区识别</h2>
        <label className="mt-3 block">
          识别方式
          <select
            className={field}
            value={values.countryMode}
            onChange={(e) =>
              setValues({
                ...values,
                countryMode: e.target.value as AnalyticsPreferences["countryMode"]
              })
            }
          >
            <option value="environment">
              沿用服务器默认（
              {data.environmentCountrySource === "header"
                ? "代理请求头"
                : data.environmentCountrySource === "geoip"
                  ? "地理数据库"
                  : "未配置"}
              ）
            </option>
            <option value="none">关闭国家识别</option>
            <option value="header">可信代理请求头（推荐 Cloudflare）</option>
            <option value="database">本地 Country MMDB 数据库</option>
          </select>
        </label>
        {values.countryMode === "header" ? (
          <label className="mt-3 block">
            国家代码请求头
            <input
              className={field}
              required
              pattern="[A-Za-z0-9-]+"
              maxLength={100}
              value={values.countryHeader}
              onChange={(e) => setValues({ ...values, countryHeader: e.target.value })}
            />
            <span className="text-[12px] text-muted">
              Cloudflare 使用
              cf-ipcountry。只在代理会覆盖此请求头、源站已受保护时使用；此项不会修改可信代理或防火墙。
            </span>
          </label>
        ) : null}
        {values.countryMode === "database" ? (
          <div className="mt-3 space-y-2">
            <label className="block">
              上传 Country MMDB（最大 32 MiB）
              <input
                className="mt-2 block w-full"
                type="file"
                accept=".mmdb"
                disabled={pending || !data.editable}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload.mutate(file);
                  e.target.value = "";
                }}
              />
            </label>
            {database ? (
              <p className="text-[12px] text-muted">
                {database.type} · 数据日期 {database.builtAt.slice(0, 10)} ·{" "}
                {(database.bytes / 1024 ** 2).toFixed(1)} MiB
              </p>
            ) : (
              <p className="text-[12px] text-muted">尚未上传数据库。</p>
            )}
            <p className="text-[12px] text-muted">
              文件仅供服务端识别国家，不对外开放下载。请自行确认数据来源和使用许可，更新时上传新文件。
            </p>
          </div>
        ) : null}
      </div>
      {values.retentionDays < data.values.retentionDays ? (
        <label className="flex gap-2 text-[13px] text-status-warn">
          <input
            type="checkbox"
            required
            checked={confirmRetention}
            onChange={(e) => setConfirmRetention(e.target.checked)}
          />
          我确认：下一次维护将永久删除新保留期之外的原始记录；已有按天汇总保留。
        </label>
      ) : null}
      {save.error || upload.error ? (
        <p role="alert" className="text-status-error">
          {(save.error ?? upload.error)?.message}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-[13px] text-muted">
          {message}
        </p>
      ) : null}
      <button className="btn-primary" disabled={pending || !data.editable} type="submit">
        {save.isPending ? "保存中…" : "保存统计设置"}
      </button>
    </form>
  );
}
