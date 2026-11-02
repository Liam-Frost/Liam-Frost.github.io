import type {
  AdminDashboard,
  AnalyticsKpis,
  DashboardConnections,
  DashboardContent,
  DashboardEditedType,
  DashboardPart,
  DashboardTask,
  DashboardTaskId,
  DashboardTraffic
} from "@liam-frost/shared";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, CircleAlert, CircleCheck, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { JOBS } from "../components/analytics/HealthView";
import { Card, changeText, MEDIA_KINDS, number } from "../components/analytics/common";
import { PageHeader } from "../components/layout/AdminLayout";
import { DatabaseNotice } from "../components/ui/DatabaseNotice";
import { api } from "../lib/api";
import { SOURCE_LABELS } from "../lib/i18n";

const STEAM_LINK = "/collection?kind=game&open=steam";
const SPOTIFY_LINK = "/collection?kind=track&open=spotify";

const relative = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });
/** "3 天前", "刚刚"; the exact time is in the title. */
function ago(iso: string) {
  const seconds = (Date.parse(iso) - Date.now()) / 1000;
  const abs = Math.abs(seconds);
  if (abs < 60) return "刚刚";
  for (const [unit, size] of [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60]
  ] as const) {
    if (abs >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "刚刚";
}

function Time({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} title={new Date(iso).toLocaleString("zh-CN")}>
      {ago(iso)}
    </time>
  );
}

/** A part of the dashboard, or why it could not be loaded. */
function Part<T>({
  part,
  title,
  children
}: {
  part: DashboardPart<T>;
  title: string;
  children: (data: T) => ReactNode;
}) {
  if (part.ok) return children(part.data);
  return (
    <Card title={title}>
      <p role="alert" className="text-[13px] text-status-error">
        无法加载：{part.error}
      </p>
    </Card>
  );
}

// ---- Today ----

const TRAFFIC: { key: keyof AnalyticsKpis; label: string }[] = [
  { key: "views", label: "今日浏览量" },
  { key: "visitors", label: "今日访客" },
  { key: "sessions", label: "今日访问" }
];

/** Seven small columns: views per day this week. */
function WeekBars({ week }: { week: DashboardTraffic["week"] }) {
  const most = Math.max(1, ...week.map((day) => day.views));
  return (
    <div
      role="img"
      aria-label={`近 7 天浏览量：${week.map((d) => `${d.day.slice(5)} ${d.views}`).join("，")}`}
      className="mt-3 flex h-8 items-end gap-1"
    >
      {week.map((day, i) => (
        <span
          key={day.day}
          className={`flex-1 rounded-t-sm ${i === week.length - 1 ? "bg-brand" : "bg-brand-secondary/35"}`}
          style={{ height: `${Math.max(8, (day.views / most) * 100)}%` }}
        />
      ))}
    </div>
  );
}

function Traffic({ traffic }: { traffic: AdminDashboard["traffic"] }) {
  if (!traffic) {
    return (
      <p className="card p-4 text-[13px] text-muted">访问统计未开启，可在统计页面打开总开关。</p>
    );
  }
  return (
    <Part part={traffic} title="今日速览">
      {(data) => (
        <section aria-label="今日速览" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Link
            to="/analytics?range=today"
            className="card p-4 transition-shadow hover:shadow-card-hover"
          >
            <p className="flex items-center gap-1.5 text-[12px] text-muted">
              <span
                aria-hidden="true"
                className={`size-2 rounded-full ${data.online ? "bg-status-ok" : "bg-line-strong"}`}
              />
              当前在线
            </p>
            <p className="mt-1 text-[22px] font-semibold text-brand-dark">
              {number.format(data.online)}
            </p>
            <p className="mt-1 text-[12px] text-faint">最近 5 分钟有活动的访问</p>
          </Link>
          {TRAFFIC.map(({ key, label }) => {
            const delta = changeText(data.today[key], data.yesterday[key]);
            return (
              <Link
                key={key}
                to="/analytics?range=today"
                className="card p-4 transition-shadow hover:shadow-card-hover"
              >
                <p className="text-[12px] text-muted">{label}</p>
                <p className="mt-1 text-[22px] font-semibold text-brand-dark">
                  {number.format(data.today[key])}
                </p>
                <p
                  className={`mt-1 text-[12px] ${delta.sign > 0 ? "text-status-ok" : delta.sign < 0 ? "text-status-error" : "text-faint"}`}
                >
                  {delta.sign > 0 ? "▲ " : delta.sign < 0 ? "▼ " : ""}
                  {delta.text}
                  <span className="text-faint">
                    {" "}
                    · 昨天此时 {number.format(data.yesterday[key])}
                  </span>
                </p>
                {key === "views" ? <WeekBars week={data.week} /> : null}
              </Link>
            );
          })}
        </section>
      )}
    </Part>
  );
}

// ---- To do ----

const TASKS: Record<
  DashboardTaskId,
  (task: DashboardTask) => { text: string; to: string; hint?: string }
> = {
  "photos-referenced": (t) => ({
    text: `${t.count} 张照片还在引用外链`,
    to: "/photos?show=referenced",
    hint: "链接失效时照片会坏；在编辑照片里可以「转为本站托管」。"
  }),
  "photos-missing-en": (t) => ({
    text: `${t.count} 张公开照片缺少英文标题`,
    to: "/photos"
  }),
  "projects-missing-en": (t) => ({
    text: `${t.count} 个公开项目缺少英文标题`,
    to: "/projects"
  }),
  "projects-no-cover": (t) => ({ text: `${t.count} 个公开项目没有封面`, to: "/projects" }),
  "media-unrated": (t) => ({
    text: `${t.count} 条看完、读完或玩过的收藏还没有评分`,
    to: "/collection?status=done"
  }),
  "steam-stale": () => ({
    text: "Steam 游戏库超过 30 天没有同步",
    to: STEAM_LINK,
    hint: "同步会更新游戏时长和最近游玩日期。"
  }),
  "source-failing": (t) => ({
    text: `${SOURCE_LABELS[t.subject as keyof typeof SOURCE_LABELS] ?? t.subject} 最近一次请求失败`,
    to: "/analytics/health",
    hint: "可能是 key 失效、额度用完或网络不通；在 统计 → 体验与运行 查看错误信息。"
  })
};

function Tasks({ tasks }: { tasks: DashboardTask[] }) {
  return (
    <Card title="待处理" hint="按规则自动检查；处理完后刷新这里就会消失。">
      {tasks.length ? (
        <ul className="divide-y divide-line-soft">
          {tasks.map((task) => {
            const { text, to, hint } = TASKS[task.id](task);
            return (
              <li key={`${task.id}:${task.subject ?? ""}`} className="py-2.5 first:pt-0 last:pb-0">
                <Link to={to} className="group flex items-start gap-2">
                  <CircleAlert
                    aria-hidden="true"
                    className={`mt-0.5 size-4 shrink-0 ${task.severity === "warning" ? "text-status-warn" : "text-brand-secondary"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] text-ink group-hover:text-brand">
                      {text}
                    </span>
                    {hint ? (
                      <span className="mt-0.5 block text-[12px] text-faint">{hint}</span>
                    ) : null}
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-faint group-hover:text-brand"
                  />
                </Link>
                {task.examples.length ? (
                  <p className="mt-1 pl-6 text-[12px] text-muted">
                    如：
                    {task.examples.map((example, i) => (
                      <span key={example.id}>
                        {i ? "、" : ""}
                        {example.to ? (
                          <Link to={example.to} className="text-brand hover:underline">
                            {example.name}
                          </Link>
                        ) : (
                          example.name
                        )}
                      </span>
                    ))}
                    {task.count > task.examples.length ? " 等" : ""}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-[13px] text-muted">
          <CircleCheck aria-hidden="true" className="size-4 text-status-ok" />
          暂无待处理，一切正常。
        </p>
      )}
    </Card>
  );
}

// ---- Accounts and services ----

type State = "ok" | "warn" | "error" | "off";
const STATES: Record<State, { dot: string; label: string }> = {
  ok: { dot: "bg-status-ok", label: "正常" },
  warn: { dot: "bg-status-warn", label: "需要注意" },
  error: { dot: "bg-status-error", label: "出错" },
  off: { dot: "bg-line-strong", label: "未启用" }
};

function ServiceRow({
  state,
  name,
  detail,
  action
}: {
  state: State;
  name: string;
  detail: ReactNode;
  action?: { label: string; to: string };
}) {
  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${STATES[state].dot}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] text-ink">
          {name}
          <span className="sr-only">：{STATES[state].label}</span>
        </span>
        <span className="block truncate text-[12px] text-muted">{detail}</span>
      </span>
      {action ? (
        <Link to={action.to} className="btn-secondary shrink-0 !px-3 !py-1.5 !text-[12px]">
          {action.label}
        </Link>
      ) : null}
    </li>
  );
}

function Connections({ data }: { data: DashboardConnections }) {
  const { steam, spotify } = data;
  return (
    <Card title="账号与服务" hint="只显示是否配置了 key，不会显示 key 本身。">
      <ul className="divide-y divide-line-soft">
        <ServiceRow
          name="Steam"
          state={!steam.configured ? "off" : !steam.account || steam.account.stale ? "warn" : "ok"}
          detail={
            !steam.configured ? (
              "未配置 STEAM_WEB_API_KEY"
            ) : !steam.account ? (
              "未连接账号"
            ) : (
              <>
                {steam.account.name} · 上次同步{" "}
                {steam.account.lastSyncedAt ? <Time iso={steam.account.lastSyncedAt} /> : "从未"}
              </>
            )
          }
          action={
            steam.configured
              ? { label: steam.account ? "同步" : "连接", to: STEAM_LINK }
              : undefined
          }
        />
        <ServiceRow
          name="Spotify"
          state={!spotify.configured ? "off" : spotify.account ? "ok" : "warn"}
          detail={
            !spotify.configured
              ? "未配置 Spotify 应用"
              : spotify.account
                ? `已连接 ${spotify.account.displayName}`
                : "未连接账号"
          }
          action={
            spotify.configured
              ? { label: spotify.account ? "管理" : "连接", to: SPOTIFY_LINK }
              : undefined
          }
        />
      </ul>
      <h3 className="mt-3 mb-2 border-t border-line-soft pt-3 text-[12px] font-medium text-muted">
        资料来源
      </h3>
      {/* Compact: six sources would make the column much longer than the one beside it. */}
      <ul className="grid grid-cols-2 gap-x-3 gap-y-2">
        {data.sources.map((source) => {
          const failing = source.lastError && (!source.lastOk || source.lastOk < source.lastError);
          const state: State = !source.configured ? "off" : failing ? "error" : "ok";
          return (
            <li key={source.name} className="flex min-w-0 items-start gap-2">
              <span
                aria-hidden="true"
                className={`mt-1.5 size-2 shrink-0 rounded-full ${STATES[state].dot}`}
              />
              <span className="min-w-0">
                <span className="block text-[13px] text-ink">
                  {SOURCE_LABELS[source.name]}
                  <span className="sr-only">：{STATES[state].label}</span>
                </span>
                <span
                  className={`block truncate text-[11.5px] ${failing ? "text-status-error" : "text-faint"}`}
                  title={failing ? (source.lastErrorMessage ?? undefined) : undefined}
                >
                  {!source.configured ? (
                    "未配置 key"
                  ) : failing ? (
                    <>
                      <Time iso={source.lastError!} />
                      失败
                    </>
                  ) : source.lastOk ? (
                    <>
                      <Time iso={source.lastOk} />
                      成功
                    </>
                  ) : source.needsKey ? (
                    "已配置，暂无请求"
                  ) : (
                    "无需 key，暂无请求"
                  )}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ---- Content ----

function Content({ data }: { data: DashboardContent }) {
  const kinds = data.media.byKind
    .map(({ kind, count }) => `${MEDIA_KINDS[kind] ?? kind} ${number.format(count)}`)
    .join(" · ");
  const tiles = [
    {
      to: "/photos",
      label: "照片",
      total: data.photos.total,
      detail: `隐藏 ${data.photos.hidden} · 精选 ${data.photos.featured} · 引用 ${data.photos.referenced}`
    },
    {
      to: "/projects",
      label: "项目",
      total: data.projects.total,
      detail: `隐藏 ${data.projects.hidden} · 精选 ${data.projects.featured}`
    },
    {
      to: "/collection",
      label: "收藏",
      total: data.media.total,
      detail: [kinds, `在看 ${data.media.watching}`].filter(Boolean).join(" · ")
    },
    {
      to: "/people",
      label: "人物",
      total: data.people.total,
      detail: `隐藏 ${data.people.hidden}`
    },
    {
      to: "/collection?kind=track&view=playlists",
      label: "歌单",
      total: data.playlists.total,
      detail: `隐藏 ${data.playlists.hidden}`
    }
  ];
  return (
    <Card title="内容概况">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map((tile) => (
          <li key={tile.label} className={tile.label === "收藏" ? "col-span-2 sm:col-span-1" : ""}>
            <Link
              to={tile.to}
              className="block h-full rounded-xl px-3 py-2.5 ring-1 ring-line-soft transition-colors hover:bg-brand-secondary/6"
            >
              <span className="block text-[12px] text-muted">{tile.label}</span>
              <span className="block text-[20px] font-semibold text-brand-dark">
                {number.format(tile.total)}
              </span>
              <span className="block text-[11.5px] leading-relaxed text-faint">{tile.detail}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---- Recent activity ----

const EDITED_TYPES: Record<DashboardEditedType, string> = {
  photo: "照片",
  project: "项目",
  media: "收藏",
  person: "人物",
  playlist: "歌单"
};

function Activity({ data }: { data: AdminDashboard["activity"] }) {
  return (
    <Part part={data} title="最近动态">
      {({ jobs, edited }) => (
        <Card title="最近动态">
          <h3 className="mb-1.5 text-[12px] font-medium text-muted">最近编辑</h3>
          {edited.length ? (
            <ul className="space-y-1.5 text-[13px]">
              {edited.map((item) => (
                <li key={`${item.type}:${item.id}`} className="flex items-baseline gap-2">
                  <span className="shrink-0 text-[11.5px] text-faint">
                    {item.kind ? (MEDIA_KINDS[item.kind] ?? item.kind) : EDITED_TYPES[item.type]}
                  </span>
                  <Link to={item.to} className="min-w-0 flex-1 truncate text-ink hover:text-brand">
                    {item.name}
                  </Link>
                  <span className="shrink-0 text-[12px] text-faint">
                    <Time iso={item.updatedAt} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">还没有内容。</p>
          )}

          <h3 className="mt-4 mb-1.5 text-[12px] font-medium text-muted">导入与同步</h3>
          {jobs.length ? (
            <ul className="space-y-1.5 text-[13px]">
              {jobs.map((job) => (
                <li key={`${job.at}:${job.name}`} className="flex items-start gap-2">
                  {job.ok ? (
                    <CircleCheck
                      aria-label="成功"
                      className="mt-0.5 size-3.5 shrink-0 text-status-ok"
                    />
                  ) : (
                    <CircleAlert
                      aria-label="失败"
                      className="mt-0.5 size-3.5 shrink-0 text-status-error"
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="text-ink">{JOBS[job.name] ?? job.name}</span>
                    {job.message ? (
                      <span className="block truncate text-[12px] text-muted" title={job.message}>
                        {job.message}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-[12px] text-faint">
                    <Time iso={job.at} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">最近没有导入或同步任务。</p>
          )}
        </Card>
      )}
    </Part>
  );
}

// ---- Page ----

const QUICK = [
  { to: "/photos?open=add", label: "添加照片" },
  { to: "/projects?open=new", label: "新建项目" },
  { to: "/collection?open=add", label: "添加收藏" }
];

export function OverviewPage() {
  const { data, error, isPending } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: api.dashboard,
    refetchInterval: 60_000
  });

  return (
    <>
      <PageHeader
        title="概览"
        description="网站现在的情况、账号和服务的状态，以及需要处理的事。"
        actions={QUICK.map(({ to, label }) => (
          <Link key={to} to={to} className="btn-secondary">
            <Plus aria-hidden="true" className="size-4" /> {label}
          </Link>
        ))}
      />
      {error ? (
        <DatabaseNotice error={error} subject="概览" />
      ) : isPending || !data ? (
        <p className="py-10 text-center text-[13px] text-subtle">加载中…</p>
      ) : (
        <div className="space-y-4">
          <Traffic traffic={data.traffic} />
          {/* Phones: to do, accounts, content, activity. Wide screens: two columns. */}
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <Part part={data.tasks} title="待处理">
                {(tasks) => <Tasks tasks={tasks} />}
              </Part>
              <div className="lg:hidden">
                <Part part={data.connections} title="账号与服务">
                  {(connections) => <Connections data={connections} />}
                </Part>
              </div>
              <Part part={data.content} title="内容概况">
                {(content) => <Content data={content} />}
              </Part>
            </div>
            <div className="space-y-4">
              <div className="hidden lg:block">
                <Part part={data.connections} title="账号与服务">
                  {(connections) => <Connections data={connections} />}
                </Part>
              </div>
              <Activity data={data.activity} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Unknown route inside the signed-in admin. */
export function SectionNotFound() {
  return (
    <>
      <PageHeader title="页面不存在" />
      <Link to="/" className="btn-secondary">
        返回概览
      </Link>
    </>
  );
}

/** Shown when the page was not served as the admin app; reveals nothing about the admin. */
export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 px-4 text-center">
      <h1 className="text-[40px] font-semibold text-brand-dark">404</h1>
      <p className="text-[13px] text-muted">页面不存在</p>
    </div>
  );
}
