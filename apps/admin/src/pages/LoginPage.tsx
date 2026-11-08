import { Lock } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { usePresentation } from "../../../web/src/data/usePresentation";
import SiteMark from "../../../web/src/components/SiteMark";

import { Field } from "../components/ui/Field";
import { useLogin } from "../hooks/useSession";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate({ username, password }, { onSuccess: () => setPassword("") });
  };

  const error = login.error?.message;

  return (
    <CenteredCard>
      <form onSubmit={submit} noValidate>
        <div className="mb-5 flex items-center gap-2.5">
          <SiteMark admin />
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-brand-secondary/12 text-brand">
            <Lock aria-hidden="true" className="size-4" />
          </span>
          <div>
            <h1 className="text-[17px] font-semibold text-brand-dark">管理员登录</h1>
            <p className="text-[12px] text-muted">登录后可以管理照片与项目</p>
          </div>
        </div>

        <Field label="用户名" htmlFor="admin-username" className="mb-3.5">
          <input
            id="admin-username"
            className="field"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>
        <Field label="密码" htmlFor="admin-password">
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

        {error ? (
          <p id="login-error" role="alert" className="mt-3 text-[12.5px] text-status-error">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={login.isPending || !username || !password}
          className="btn-primary mt-5 w-full"
        >
          {login.isPending ? "登录中…" : "登录"}
        </button>
      </form>
    </CenteredCard>
  );
}

export function NotConfiguredPage() {
  return (
    <CenteredCard>
      <h1 className="mb-2 text-[17px] font-semibold text-brand-dark">管理功能尚未启用</h1>
      <p className="text-[13.5px] leading-relaxed text-muted">
        服务端未配置管理员凭据。请在 <code className="chip">apps/api/.env</code> 中设置{" "}
        <code className="chip">ADMIN_PASSWORD_HASH</code> 和{" "}
        <code className="chip">ADMIN_SESSION_SECRET</code> 后重启 API（见{" "}
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
