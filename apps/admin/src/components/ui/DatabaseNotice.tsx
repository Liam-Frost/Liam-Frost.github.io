import { ApiError } from "../../lib/api";

/** Explains a failed list load, with setup steps when the database is missing or unreachable. */
export function DatabaseNotice({ error, subject }: { error: Error; subject: string }) {
  const code = error instanceof ApiError ? error.code : "";
  return (
    <div className="card p-6 text-[13.5px] leading-relaxed text-muted">
      {code === "DATABASE_NOT_CONFIGURED" ? (
        <>
          {subject}需要数据库。请在 <code className="chip">apps/api/.env</code> 中设置{" "}
          <code className="chip">DATABASE_URL</code>，运行{" "}
          <code className="chip">npm run db:migrate</code> 后重启 API（见{" "}
          <code className="chip">docs/database.md</code>）。
        </>
      ) : code === "DATABASE_UNAVAILABLE" ? (
        <>
          <p role="alert" className="font-medium text-status-error">
            数据库连接失败
          </p>
          <p className="mt-1.5">
            API 连不上 <code className="chip">DATABASE_URL</code>{" "}
            指向的数据库。请确认数据库已经启动（本地可在 <code className="chip">apps/api</code>{" "}
            中运行 <code className="chip">npx prisma dev</code>），地址和密码正确，然后刷新页面（见{" "}
            <code className="chip">docs/database.md</code>）。
          </p>
        </>
      ) : (
        <span role="alert" className="text-status-error">
          {error.message}
        </span>
      )}
    </div>
  );
}
