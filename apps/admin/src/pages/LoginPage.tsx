import { Lock } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { usePresentation } from "../../../web/src/data/usePresentation";
import SiteMark from "../../../web/src/components/SiteMark";

import { Field } from "../components/ui/Field";
import { useLogin } from "../hooks/useSession";
import { ApiError } from "../lib/api";
import { LanguageSwitch } from "../components/ui/LanguageSwitch";
import { tr } from "../lib/messages";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);
  const [code, setCode] = useState("");
  const login = useLogin();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate(
      {
        username,
        password,
        second: needsCode ? (useRecovery ? { recoveryCode: code } : { totp: code }) : undefined
      },
      {
        onSuccess: () => {
          setPassword("");
          setCode("");
        },
        onError: (failed) => {
          if (failed instanceof ApiError && failed.code === "TOTP_REQUIRED") setNeedsCode(true);
          if (failed instanceof ApiError && failed.code === "INVALID_CREDENTIALS") {
            setNeedsCode(false);
            setCode("");
          }
        }
      }
    );
  };

  // Being asked for the code is the next step, not a failure.
  const error =
    login.error instanceof ApiError && login.error.code === "TOTP_REQUIRED"
      ? undefined
      : login.error?.message;

  return (
    <CenteredCard>
      <form onSubmit={submit} noValidate>
        <div className="mb-5 flex items-center gap-2.5">
          <SiteMark admin />
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-brand-secondary/12 text-brand">
            <Lock aria-hidden="true" className="size-4" />
          </span>
          <div>
            <h1 className="text-[17px] font-semibold text-brand-dark">{tr("管理员登录")}</h1>
            <p className="text-[12px] text-muted">{tr("登录后可以管理照片与项目")}</p>
          </div>
        </div>

        <Field label={tr("用户名")} htmlFor="admin-username" className="mb-3.5">
          <input
            id="admin-username"
            className="field"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>
        <Field label={tr("密码")} htmlFor="admin-password">
          <input
            id="admin-password"
            type="password"
            className="field"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "login-error" : undefined}
          />
        </Field>

        {needsCode ? (
          <div className="mt-3.5">
            <Field
              label={useRecovery ? tr("恢复码") : tr("验证码")}
              htmlFor="admin-code"
              hint={
                useRecovery
                  ? tr("每个恢复码只能使用一次。")
                  : tr("输入手机验证器 App 显示的 6 位数字。")
              }
            >
              <input
                id="admin-code"
                className="field"
                autoFocus
                autoComplete="one-time-code"
                inputMode={useRecovery ? "text" : "numeric"}
                maxLength={useRecovery ? 20 : 6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </Field>
            <button
              type="button"
              className="mt-2 text-[12px] text-brand underline"
              onClick={() => {
                setUseRecovery((value) => !value);
                setCode("");
              }}
            >
              {useRecovery ? tr("使用验证码") : tr("手机不在身边？使用恢复码")}
            </button>
          </div>
        ) : null}

        <div className="mt-3 flex justify-end text-muted">
          <LanguageSwitch />
        </div>

        {error ? (
          <p id="login-error" role="alert" className="mt-3 text-[12.5px] text-status-error">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={login.isPending || !username || !password || (needsCode && !code)}
          className="btn-primary mt-5 w-full"
        >
          {login.isPending ? tr("登录中…") : tr("登录")}
        </button>
      </form>
    </CenteredCard>
  );
}

export function NotConfiguredPage() {
  return (
    <CenteredCard>
      <h1 className="mb-2 text-[17px] font-semibold text-brand-dark">{tr("管理功能尚未启用")}</h1>
      <p className="text-[13.5px] leading-relaxed text-muted">
        {tr("服务端未配置管理员凭据。请在")} <code className="chip">apps/api/.env</code>{" "}
        {tr("中设置")} <code className="chip">ADMIN_PASSWORD_HASH</code> {tr("和")}{" "}
        <code className="chip">ADMIN_SESSION_SECRET</code> {tr("后重启 API（见")}{" "}
        <code className="chip">docs/admin.md</code>）。
      </p>
    </CenteredCard>
  );
}

export function CenteredCard({ children }: { children: React.ReactNode }) {
  const settings = usePresentation();
  const background = settings?.loginBackground;
  const images =
    background?.photoIds.map((id) => settings?.images[id]).filter((v): v is string => Boolean(v)) ??
    [];
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const validImages = images.filter((src) => !failed.includes(src));
  const image = validImages[index % Math.max(1, validImages.length)];
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setInterval> | undefined;
    const update = () => {
      clearInterval(timer);
      if (background?.mode === "rotate" && !motion.matches && images.length > 1)
        timer = setInterval(
          () => setIndex((i) => (i + 1) % images.length),
          background.intervalSeconds * 1000
        );
      else setIndex(0);
    };
    update();
    motion.addEventListener("change", update);
    return () => {
      clearInterval(timer);
      motion.removeEventListener("change", update);
    };
  }, [background?.mode, background?.intervalSeconds, images.length]);
  return (
    <div className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      {background?.mode !== "none" && image ? (
        <>
          <img
            key={image}
            src={image}
            alt=""
            className="absolute inset-0 -z-20 size-full object-cover"
            onError={() => setFailed((v) => [...v, image])}
          />
          <div className="absolute inset-0 -z-10 bg-black/40" />
        </>
      ) : null}
      <div className="w-full max-w-[400px] rounded-[var(--radius-feature)] border border-line bg-surface p-6 shadow-feature">
        {children}
      </div>
    </div>
  );
}
