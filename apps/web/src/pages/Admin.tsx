import { FormEvent, useEffect, useState } from "react";

import { apiFetchEnabled, apiUrl } from "../lib/api";

type AdminUser = {
  username: string;
};

type SessionResponse = {
  authenticated: boolean;
  configured?: boolean;
  user?: AdminUser | null;
  message?: string;
};

type Status = "checking" | "ready" | "submitting" | "error";

async function parseJson(response: Response) {
  const data = (await response.json().catch(() => ({}))) as SessionResponse;
  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }
  return data;
}

export default function AdminPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState("");
  const [session, setSession] = useState<SessionResponse>({ authenticated: false });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const apiAvailable = apiFetchEnabled;

  useEffect(() => {
    if (!apiAvailable) {
      setStatus("ready");
      setMessage("Admin API is disabled for this build.");
      return;
    }

    fetch(apiUrl("/api/admin/session"), { credentials: "include" })
      .then(parseJson)
      .then((data) => {
        setSession(data);
        setMessage(data.configured === false ? "Admin authentication is not configured." : "");
        setStatus("ready");
      })
      .catch((error: unknown) => {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Failed to load admin session.");
      });
  }, [apiAvailable]);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    try {
      const data = await fetch(apiUrl("/api/admin/login"), {
        body: JSON.stringify({ username, password }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST"
      }).then(parseJson);

      setPassword("");
      setSession(data);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Login failed.");
    }
  };

  const logout = async () => {
    setStatus("submitting");

    try {
      await fetch(apiUrl("/api/admin/logout"), {
        credentials: "include",
        method: "POST"
      });
      setSession({ authenticated: false, configured: true });
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Logout failed.");
    }
  };

  const disabled = status === "checking" || status === "submitting" || !apiAvailable || session.configured === false;

  return (
    <section className="section adminPage">
      <div className="container adminShell">
        <div className="card adminCard">
          <p className="eyebrow">ADMIN</p>
          <h1 className="sectionTitle">管理后台</h1>
          <p className="sectionSubtitle">用于后续管理摄影作品、项目和书影音条目。</p>

          {session.authenticated ? (
            <div className="adminPanel">
              <div className="adminStatusCard">
                <div className="metaKey">当前用户</div>
                <div className="metaVal">{session.user?.username ?? username}</div>
              </div>
              <div className="adminStatusCard">
                <div className="metaKey">阶段</div>
                <div className="metaVal">认证基础已启用，内容管理功能将在下一阶段接入。</div>
              </div>
              <button className="btn btnSoft" type="button" onClick={logout} disabled={status === "submitting"}>
                退出登录
              </button>
            </div>
          ) : (
            <form className="adminForm" onSubmit={login}>
              <label className="adminField">
                <span>用户名</span>
                <input
                  className="input"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  disabled={disabled}
                />
              </label>

              <label className="adminField">
                <span>密码</span>
                <input
                  className="input"
                  autoComplete="current-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={disabled}
                />
              </label>

              <button className="btn btnPrimary" type="submit" disabled={disabled}>
                {status === "submitting" ? "登录中..." : "登录"}
              </button>
            </form>
          )}

          {status === "checking" ? <p className="hint">正在检查登录状态...</p> : null}
          {message ? <p className="hint adminMessage">{message}</p> : null}
        </div>
      </div>
    </section>
  );
}
