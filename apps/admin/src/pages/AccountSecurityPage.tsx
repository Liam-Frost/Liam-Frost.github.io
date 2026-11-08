import { ADMIN_PASSWORD_MIN, type AdminAccountStatus } from "@liam-frost/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";

import LoadingSkeleton from "../../../web/src/components/LoadingSkeleton";
import { SettingsPage, SettingsSection, SettingsState } from "../components/settings/SettingsUI";
import { Field } from "../components/ui/Field";
import { useToast } from "../components/ui/Toast";
import { sessionKey } from "../hooks/useSession";
import { ADMIN_BASE } from "../lib/adminBase";
import { api } from "../lib/api";
import { intlLocale, tr } from "../lib/messages";

const accountKey = ["admin", "account"] as const;
const when = (value: string) =>
  new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = "current-password",
  hint
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  hint?: ReactNode;
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint} className="max-w-sm">
      <input
        id={id}
        type="password"
        className="field"
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function CodeField({
  id,
  value,
  onChange
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={tr("验证码")} htmlFor={id} className="max-w-[160px]">
      <input
        id={id}
        className="field"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
      />
    </Field>
  );
}

/** Shown once: the codes are not stored in a readable form. */
function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  return (
    <div className="space-y-3 rounded-xl border border-status-warn/40 bg-status-warn/5 p-4">
      <p className="text-[13px] font-medium text-brand-dark">
        {tr("请现在保存这些恢复码，它们只显示这一次。每个恢复码只能用一次，手机丢失时用来登录。")}
      </p>
      <ul className="grid grid-cols-2 gap-1.5 font-mono text-[13px] text-brand-dark">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => void navigator.clipboard.writeText(codes.join("\n"))}
        >
          {tr("复制")}
        </button>
        <button type="button" className="btn-primary" onClick={onDone}>
          {tr("我已保存")}
        </button>
      </div>
    </div>
  );
}

function useAccountAction<T>(run: (input: T) => Promise<unknown>, done: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: accountKey });
      void qc.invalidateQueries({ queryKey: sessionKey });
      if (done) toast(done);
    },
    onError: (error: Error) => toast(error.message, "error")
  });
}

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const change = useAccountAction(
    () => api.changePassword(current, next),
    tr("密码已修改，其他设备已退出登录")
  );
  const mismatch = again !== "" && next !== again;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    change.mutate(undefined, {
      onSuccess: () => {
        setCurrent("");
        setNext("");
        setAgain("");
      }
    });
  };
  return (
    <SettingsSection
      title={tr("修改密码")}
      description={tr("修改后，其他设备上的登录会全部失效。")}
    >
      <form onSubmit={submit} className="space-y-3.5" noValidate>
        <PasswordField
          id="pw-current"
          label={tr("当前密码")}
          value={current}
          onChange={setCurrent}
        />
        <PasswordField
          id="pw-new"
          label={tr("新密码")}
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          hint={tr("至少 {0} 个字符。", ADMIN_PASSWORD_MIN)}
        />
        <PasswordField
          id="pw-again"
          label={tr("再次输入新密码")}
          value={again}
          onChange={setAgain}
          autoComplete="new-password"
          hint={mismatch ? tr("两次输入不一致") : undefined}
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={
            change.isPending || !current || next.length < ADMIN_PASSWORD_MIN || next !== again
          }
        >
          {change.isPending ? tr("保存中…") : tr("修改密码")}
        </button>
      </form>
    </SettingsSection>
  );
}

function UsernameSection({ username }: { username: string }) {
  const [current, setCurrent] = useState("");
  const [name, setName] = useState(username);
  const change = useAccountAction(() => api.changeUsername(current, name), tr("用户名已修改"));
  return (
    <SettingsSection title={tr("用户名")}>
      <form
        className="space-y-3.5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          change.mutate(undefined, { onSuccess: () => setCurrent("") });
        }}
      >
        <Field label={tr("用户名")} htmlFor="account-username" className="max-w-sm">
          <input
            id="account-username"
            className="field"
            autoComplete="username"
            value={name}
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <PasswordField
          id="name-current"
          label={tr("当前密码")}
          value={current}
          onChange={setCurrent}
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={change.isPending || !current || !name.trim() || name === username}
        >
          {tr("修改用户名")}
        </button>
      </form>
    </SettingsSection>
  );
}

function TotpSection({ status }: { status: AdminAccountStatus }) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<Awaited<ReturnType<typeof api.beginTotp>> | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const reset = () => {
    setPassword("");
    setCode("");
  };
  const begin = useAccountAction(
    () => api.beginTotp(password).then((result) => (setSetup(result), reset())),
    ""
  );
  const enable = useAccountAction(
    () =>
      api.enableTotp(code).then((result) => {
        setCodes(result.recoveryCodes);
        setSetup(null);
        reset();
      }),
    tr("两步验证已开启")
  );
  const disable = useAccountAction(
    () => api.disableTotp(password, code).then(reset),
    tr("两步验证已关闭")
  );
  const regenerate = useAccountAction(
    () =>
      api.regenerateRecoveryCodes(password, code).then((result) => {
        setCodes(result.recoveryCodes);
        reset();
      }),
    tr("已生成新的恢复码，旧的已失效")
  );

  return (
    <SettingsSection
      title={tr("两步验证")}
      description={tr(
        "登录时除了密码，还需要手机验证器 App（如 Google Authenticator、1Password）里的动态验证码。"
      )}
    >
      {codes ? <RecoveryCodes codes={codes} onDone={() => setCodes(null)} /> : null}
      {status.totp.enabled ? (
        <div className="space-y-3.5">
          <p className="text-[13px] text-muted">
            {tr(
              "已开启{0}，剩余恢复码 {1} 个。关闭或重新生成恢复码需要当前密码和验证码。",
              status.totp.enabledAt ? `（${when(status.totp.enabledAt)}）` : "",
              status.totp.recoveryCodesLeft
            )}
          </p>
          <PasswordField
            id="totp-password"
            label={tr("当前密码")}
            value={password}
            onChange={setPassword}
          />
          <CodeField id="totp-code" value={code} onChange={setCode} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={regenerate.isPending || !password || code.length !== 6}
              onClick={() => regenerate.mutate(undefined)}
            >
              {tr("重新生成恢复码")}
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={disable.isPending || !password || code.length !== 6}
              onClick={() => disable.mutate(undefined)}
            >
              {tr("关闭两步验证")}
            </button>
          </div>
        </div>
      ) : setup ? (
        <div className="space-y-3.5">
          <p className="text-[13px] text-muted">
            {tr("用验证器 App 扫描二维码，然后输入它显示的 6 位数字。")}
          </p>
          <img
            src={setup.qrCode}
            alt={tr("两步验证二维码")}
            className="size-44 rounded-lg bg-white"
          />
          <p className="break-all text-[12px] text-muted">
            {tr("无法扫描时手动输入密钥：")}
            <code className="font-mono">{setup.secret}</code>
          </p>
          <CodeField id="totp-enable-code" value={code} onChange={setCode} />
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={enable.isPending || code.length !== 6}
              onClick={() => enable.mutate(undefined)}
            >
              {tr("确认并开启")}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setSetup(null)}>
              {tr("取消")}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          <PasswordField
            id="totp-begin"
            label={tr("当前密码")}
            value={password}
            onChange={setPassword}
          />
          <button
            type="button"
            className="btn-primary"
            disabled={begin.isPending || !password}
            onClick={() => begin.mutate(undefined)}
          >
            {tr("开始设置")}
          </button>
        </div>
      )}
    </SettingsSection>
  );
}

function SessionsSection({ status }: { status: AdminAccountStatus }) {
  const revoke = useAccountAction((id: string) => api.revokeAdminSession(id), tr("已退出该设备"));
  const revokeOthers = useAccountAction(
    () => api.revokeOtherAdminSessions(),
    tr("其他设备已全部退出")
  );
  const others = status.sessions.filter((session) => !session.current);
  return (
    <SettingsSection
      title={tr("登录设备")}
      actions={
        others.length ? (
          <button
            type="button"
            className="btn-secondary"
            disabled={revokeOthers.isPending}
            onClick={() => revokeOthers.mutate(undefined)}
          >
            {tr("退出其他设备")}
          </button>
        ) : undefined
      }
    >
      <ul className="divide-y divide-line-soft">
        {status.sessions.map((session) => (
          <li key={session.id} className="flex items-center gap-3 py-2.5 text-[13px]">
            <div className="min-w-0 flex-1">
              <p className="truncate text-brand-dark" title={session.userAgent}>
                {session.userAgent || tr("未知设备")}
              </p>
              <p className="text-[12px] text-muted">
                {tr(
                  "{0} · 登录于 {1} · 最近活动 {2}",
                  session.ip,
                  when(session.createdAt),
                  when(session.lastSeenAt)
                )}
              </p>
            </div>
            {session.current ? (
              <span className="shrink-0 text-[12px] text-brand">{tr("当前设备")}</span>
            ) : (
              <button
                type="button"
                className="btn-secondary shrink-0"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(session.id)}
              >
                {tr("退出")}
              </button>
            )}
          </li>
        ))}
      </ul>
      {!status.sessions.length ? (
        <p className="text-[13px] text-muted">{tr("没有可显示的登录记录。")}</p>
      ) : null}
    </SettingsSection>
  );
}

function PathSection({ status }: { status: AdminAccountStatus }) {
  const { current, pending, retiring } = status.path;
  const [path, setPath] = useState("");
  const [password, setPassword] = useState("");
  const start = useAccountAction(
    () => api.beginAdminPath(password, path).then(() => (setPassword(""), setPath(""))),
    tr("新地址已可以访问，请打开确认")
  );
  const confirm = useAccountAction(
    () => api.confirmAdminPath(ADMIN_BASE ?? ""),
    tr("后台地址已切换")
  );
  const cancel = useAccountAction(() => api.cancelAdminPath(), tr("已取消切换"));
  const onNewAddress = pending !== null && ADMIN_BASE === pending;
  return (
    <SettingsSection
      title={tr("后台地址")}
      description={tr(
        "先试用新地址，确认能打开后才会停用旧地址。隐藏地址只能减少暴露，不能代替密码和两步验证。"
      )}
    >
      <p className="text-[13px] text-muted">
        {tr("当前地址：")}
        <code className="font-mono text-brand-dark">{current}</code>
      </p>
      {retiring ? (
        <p className="text-[12px] text-muted">
          {tr("旧地址")} <code className="font-mono">{retiring.path}</code>{" "}
          {tr(
            "在 {0} 前只会把已登录的你转到新地址，其他人看到的是不存在的页面。",
            when(retiring.until)
          )}
        </p>
      ) : null}
      {pending ? (
        <div className="space-y-3 rounded-xl border border-line-soft p-4">
          <p className="text-[13px] text-brand-dark">
            {tr("正在试用新地址")} <code className="font-mono">{pending}</code>
            {tr("，旧地址仍然有效。")}
          </p>
          {onNewAddress ? (
            <p className="text-[12px] text-muted">
              {tr("你正在新地址上，页面能正常打开。确认后旧地址停用；请先收藏新地址。")}
            </p>
          ) : (
            <a className="btn-secondary" href={`${pending}/settings/admin/security`}>
              {tr("打开新地址")}
            </a>
          )}
          <div className="flex gap-2">
            {onNewAddress ? (
              <button
                type="button"
                className="btn-primary"
                disabled={confirm.isPending}
                onClick={() => confirm.mutate(undefined)}
              >
                {tr("确认切换")}
              </button>
            ) : null}
            <button
              type="button"
              className="btn-secondary"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate(undefined)}
            >
              {tr("取消切换")}
            </button>
          </div>
        </div>
      ) : (
        <form
          className="space-y-3.5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            start.mutate(undefined);
          }}
        >
          <Field
            label={tr("新地址")}
            htmlFor="admin-new-path"
            className="max-w-sm"
            hint={tr("只能使用字母、数字、- 和 _，例如 /studio-7f3a。不能与网站已有的页面相同。")}
          >
            <input
              id="admin-new-path"
              className="field"
              autoComplete="off"
              maxLength={100}
              value={path}
              onChange={(event) => setPath(event.target.value)}
            />
          </Field>
          <PasswordField
            id="path-password"
            label={tr("当前密码")}
            value={password}
            onChange={setPassword}
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={start.isPending || !password || !path.trim()}
          >
            {tr("试用新地址")}
          </button>
        </form>
      )}
    </SettingsSection>
  );
}

export function AccountSecurityPage() {
  const q = useQuery({ queryKey: accountKey, queryFn: api.account });
  return (
    <SettingsPage
      title={tr("账号与安全")}
      description={tr("管理登录账号、两步验证、登录设备和后台地址。")}
    >
      {q.isPending ? (
        <LoadingSkeleton label={tr("读取安全状态…")} variant="rows" count={3} />
      ) : q.error ? (
        <SettingsState error={q.error.message} onRetry={() => void q.refetch()} />
      ) : q.data ? (
        <div className="space-y-5">
          <SettingsSection title={tr("当前状态")}>
            <dl className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
              {(
                [
                  [tr("登录账号"), q.data.username],
                  [
                    tr("登录尝试限制"),
                    tr(
                      "每 {0} 分钟 {1} 次（按 IP）",
                      q.data.protections.loginWindowMinutes,
                      q.data.protections.maxLoginAttempts
                    )
                  ],
                  [tr("登录有效期"), tr("{0} 小时", q.data.protections.sessionTtlHours)],
                  [tr("可信代理"), q.data.protections.trustProxy ? tr("已配置") : tr("未配置")],
                  [
                    tr("IP 白名单"),
                    q.data.protections.allowedIps
                      ? tr("{0} 个地址", q.data.protections.allowedIps)
                      : tr("未启用")
                  ],
                  [
                    tr("密码最近修改"),
                    q.data.passwordChangedAt
                      ? when(q.data.passwordChangedAt)
                      : tr("使用服务器配置的密码")
                  ]
                ] as const
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between gap-3 border-b border-line-soft pb-2"
                >
                  <dt className="text-muted">{label}</dt>
                  <dd className="min-w-0 break-all text-right font-medium text-brand-dark">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            {!q.data.editable ? (
              <p className="mt-3 text-[12px] text-muted">
                {tr("当前没有数据库，账号只能在服务器配置中修改，下面的操作不可用。")}
              </p>
            ) : null}
          </SettingsSection>
          {q.data.editable ? (
            <>
              <PasswordSection />
              <UsernameSection key={q.data.username} username={q.data.username} />
              <TotpSection status={q.data} />
              <SessionsSection status={q.data} />
              <PathSection status={q.data} />
            </>
          ) : null}
        </div>
      ) : null}
    </SettingsPage>
  );
}
