import { Lock } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { usePresentation } from "../../../web/src/data/usePresentation";
import { rotationTurn } from "../../../web/src/lib/rotation";

import { Field } from "../components/ui/Field";
import { useLogin } from "../hooks/useSession";
import { ApiError } from "../lib/api";
import { tr } from "../lib/messages";

export function LoginPage() {
  return (
    <CenteredCard>
      <LoginForm />
    </CenteredCard>
  );
}

/** With `preview`, the form is only drawn: nothing in it can be used or filled in. */
export function LoginForm({ preview = false }: { preview?: boolean }) {
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
    <form onSubmit={submit} noValidate>
      <fieldset disabled={preview} className="min-w-0">
        <div className="mb-5 flex items-center gap-2.5">
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
            id={preview ? undefined : "admin-username"}
            className="field"
            autoComplete={preview ? "off" : "username"}
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>
        <Field label={tr("密码")} htmlFor="admin-password">
          <input
            id={preview ? undefined : "admin-password"}
            type={preview ? "text" : "password"}
            className="field"
            autoComplete={preview ? "off" : "current-password"}
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
      </fieldset>
    </form>
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
  // Only currently public photos have an image. This visit's photo comes first, the rest stand by.
  const images = useMemo(() => {
    if (!settings) return [];
    const { mode, photoIds } = settings.loginBackground;
    const ids = photoIds.filter((id) => settings.images[id]);
    const turn = mode === "fixed" ? 0 : rotationTurn(ids, mode, "login-background");
    return [...ids.slice(turn), ...ids.slice(0, turn)].map((id) => settings.images[id]!);
  }, [settings]);
  const [failed, setFailed] = useState<string[]>([]);
  const image = images.find((src) => !failed.includes(src));
  return (
    <LoginStage image={image} onImageError={() => setFailed((v) => [...v, image!])}>
      {children}
    </LoginStage>
  );
}

/** What the login page looks like: also drawn, scaled down, as the preview in 登录外观. */
export function LoginStage({
  image,
  fill = false,
  onImageError,
  children
}: {
  image?: string;
  /** Fills its parent instead of the window. */
  fill?: boolean;
  onImageError?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`relative isolate flex items-center justify-center overflow-hidden px-4 py-10 ${fill ? "h-full" : "min-h-dvh"}`}
    >
      {image ? (
        <>
          <img
            key={image}
            src={image}
            alt=""
            className="absolute inset-0 -z-20 size-full object-cover"
            onError={onImageError}
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
