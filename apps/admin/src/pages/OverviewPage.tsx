import type {
  AdminDashboard,
  AnalyticsKpis,
  DashboardActivity,
  DashboardConnections,
  DashboardContent,
  DashboardEditedType,
  DashboardPart,
  DashboardSource,
  DashboardTask,
  DashboardTaskId,
  DashboardTraffic
} from "@liam-frost/shared";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Download,
  Pencil,
  Plus,
  RefreshCw,
  type LucideIcon
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { JOBS } from "../components/analytics/HealthView";
import { KPIS } from "../components/analytics/OverviewView";
import { changeText, MEDIA_KINDS, number } from "../components/analytics/common";
import { PageHeader } from "../components/layout/AdminLayout";
import { DatabaseNotice } from "../components/ui/DatabaseNotice";
import { Time } from "../components/ui/Time";
import { InfoTip, Tooltip } from "../components/ui/Tooltip";
import { api } from "../lib/api";
import { SOURCE_LABELS } from "../lib/i18n";

const STEAM_LINK = "/collection?kind=game&open=steam";
const SPOTIFY_LINK = "/collection?kind=track&open=spotify";

/** One block of the dashboard: a titled white surface, the same everywhere on the page. */
function Section({
  title,
  hint,
  action,
  className = "",
  children
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className={`card min-w-0 p-4 sm:p-5 ${className}`}>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="flex flex-1 items-center gap-1 text-[14px] font-semibold text-brand-dark">
          {title}
          {hint ? <InfoTip text={hint} label={`${title}：说明`} /> : null}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A part of the dashboard, or why it could not be loaded (the others still show). */
function Part<T>({
  part,
  title,
  className,
  children
}: {
  part: DashboardPart<T>;
  title: string;
  className?: string;
  children: (data: T) => ReactNode;
}) {
  if (part.ok) return children(part.data);
  return (
    <Section title={title} className={className}>
      <p role="alert" className="text-[13px] text-status-error">
        无法加载：{part.error}
      </p>
    </Section>
  );
}

// ---- KPIs ----

const KPI_LABELS: Partial<Record<keyof AnalyticsKpis, string>> = {
  views: "今日浏览量",
  visitors: "今日访客",
  sessions: "今日访问"
};
const hintOf = (key: keyof AnalyticsKpis) => KPIS.find((k) => k.key === key)!.hint;

function KpiCard({
  label,
  hint,
  value,
  children
}: {
  label: string;
  hint: string;
  value: number;
  children?: ReactNode;
}) {
  return (
    <div className="card flex min-w-0 flex-col p-4">
      <p className="flex items-center gap-1 text-[12px] text-muted">
        {label}
        <InfoTip text={hint} label={`${label}：口径`} />
      </p>
      <p className="mt-1 text-[26px] leading-tight font-semibold text-brand-dark tabular-nums">
        {number.format(value)}
      </p>
      {children}
    </div>
  );
}

/** Views per day over the last seven days, with the dates; hidden when there were none. */
function WeekBars({ week }: { week: DashboardTraffic["week"] }) {
  const most = Math.max(...week.map((day) => day.views));
  if (!most || week.length < 2) return null;
  return (
    <figure className="mt-auto pt-3">
      <div className="flex h-7 items-end gap-1">
        {week.map((day, i) => (
          <Tooltip
            key={day.day}
            content={`${day.day}：${number.format(day.views)} 次浏览`}
            className="flex h-full flex-1 items-end"
          >
            <span
              tabIndex={0}
              aria-label={`${day.day}：${day.views} 次浏览`}
              className={`block w-full rounded-t-sm outline-offset-1 ${i === week.length - 1 ? "bg-brand" : "bg-brand-secondary/35"}`}
              style={{ height: `${Math.max(6, (day.views / most) * 100)}%` }}
            />
          </Tooltip>
        ))}
      </div>
      <figcaption className="mt-1 flex justify-between text-[11px] text-faint tabular-nums">
        <span>{week[0]!.day.slice(5)}</span>
        <span>近 7 天浏览量</span>
        <span>今天</span>
      </figcaption>
    </figure>
  );
}

function Kpis({ traffic }: { traffic: AdminDashboard["traffic"] }) {
  if (!traffic) {
    return (
      <p className="card p-4 text-[13px] text-muted">
        访问统计未开启，可在
        <Link to="/analytics" className="text-brand hover:underline">
          统计
        </Link>
        页面打开总开关。
      </p>
    );
  }
  return (
    <Part part={traffic} title="今日访问">
      {(data) => (
        <section aria-labelledby="kpi-title">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 id="kpi-title" className="text-[12px] font-medium text-faint">
              今天 · 与昨天同一时段比较
            </h2>
            <Link to="/analytics?range=today" className="text-[12px] text-brand hover:underline">
              查看统计
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="当前在线" hint="最近 5 分钟内有活动的访问数。" value={data.online}>
              <p className="mt-1 text-[12px] text-faint">最近 5 分钟</p>
            </KpiCard>
            {(["views", "visitors", "sessions"] as const).map((key) => {
              const delta = changeText(data.today[key], data.yesterday[key]);
              return (
                <KpiCard
                  key={key}
                  label={KPI_LABELS[key]!}
                  hint={hintOf(key)}
                  value={data.today[key]}
                >
                  <p className="mt-1 text-[12px] text-faint tabular-nums">
                    <span
                      className={
                        delta.sign > 0
                          ? "text-status-ok"
                          : delta.sign < 0
                            ? "text-status-error"
                            : undefined
                      }
                    >
                      {delta.sign > 0 ? "▲ " : delta.sign < 0 ? "▼ " : ""}
                      {delta.text}
                    </span>{" "}
                    · 昨天 {number.format(data.yesterday[key])}
                  </p>
                  {key === "views" ? <WeekBars week={data.week} /> : null}
                </KpiCard>
              );
            })}
          </div>
        </section>
      )}
    </Part>
  );
}

// ---- To do ----

/** Each task's title and where it is fixed, with that page's filter applied. */
const TASKS: Record<
  DashboardTaskId,
  (task: DashboardTask) => { title: ReactNode; detail: string; to: string }
> = {
  "photos-referenced": (t) => ({
    title: (
      <>
        <b>{t.count}</b> 张照片还在引用外链
      </>
    ),
    detail: "链接失效时照片会坏，可在编辑照片里转为本站托管",
    to: "/photos?show=referenced"
  }),
  "photos-missing-en": (t) => ({
    title: (
      <>
        <b>{t.count}</b> 张公开照片缺少英文标题
      </>
    ),
    detail: "英文访客会看到其他语言的标题",
    to: "/photos?show=missing-en"
  }),
  "projects-missing-en": (t) => ({
    title: (
      <>
        <b>{t.count}</b> 个公开项目缺少英文标题
      </>
    ),
    detail: "英文访客会看到其他语言的标题",
    to: "/projects?show=missing-en"
  }),
  "projects-no-cover": (t) => ({
    title: (
      <>
        <b>{t.count}</b> 个公开项目没有封面
      </>
    ),
    detail: "项目列表和首页会显示占位图",
    to: "/projects?show=no-cover"
  }),
  "media-unrated": (t) => ({
    title: (
      <>
        <b>{t.count}</b> 条已完成的收藏还没有评分
      </>
    ),
    detail: "看完、读完或玩过的条目（不含音乐）",
    to: `/collection?kind=${t.kind ?? "movie"}&status=done&rating=none`
  }),
  "steam-stale": () => ({
    title: "Steam 游戏库超过 30 天没有同步",
    detail: "同步会更新游戏时长和最近游玩日期",
    to: STEAM_LINK
  }),
  "source-failing": (t) => ({
    title: `${SOURCE_LABELS[t.subject as keyof typeof SOURCE_LABELS] ?? t.subject} 最近一次请求失败`,
    detail: "可能是 key 失效、额度用完或网络不通",
    to: "/analytics/health"
  })
};

function Tasks({ tasks, className }: { tasks: DashboardTask[]; className: string }) {
  return (
    <Section
      title="待处理"
      hint="按规则自动检查，处理完后这里会消失。点击进入已筛选好的列表。"
      className={className}
      action={
        tasks.length ? (
          <span className="text-[12px] text-faint tabular-nums">{tasks.length} 项</span>
        ) : null
      }
    >
      {tasks.length ? (
        <ul className="-mx-2">
          {tasks.map((task) => {
            const { title, detail, to } = TASKS[task.id](task);
            return (
              <li key={`${task.id}:${task.subject ?? ""}`}>
                <Link
                  to={to}
                  className="group flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-brand-secondary/6 focus-visible:bg-brand-secondary/6"
                >
                  <CircleAlert
                    aria-label={task.severity === "warning" ? "需要处理" : "建议处理"}
                    className={`mt-0.5 size-4 shrink-0 ${task.severity === "warning" ? "text-status-warn" : "text-brand-secondary"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] text-ink group-hover:text-brand [&_b]:font-semibold [&_b]:tabular-nums">
                      {title}
                    </span>
                    <span className="block text-[12px] text-faint">{detail}</span>
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-faint group-hover:text-brand"
                  />
                </Link>
                {task.examples.length ? (
                  <p className="truncate pr-2 pb-1 pl-9 text-[12px] text-muted">
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
        <p className="flex items-center gap-2 py-2 text-[13px] text-muted">
          <CircleCheck aria-hidden="true" className="size-4 text-status-ok" />
          没有需要处理的事项。
        </p>
      )}
    </Section>
  );
}

// ---- Content ----

function Content({ data, className }: { data: DashboardContent; className: string }) {
  const rows = [
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
      detail: `隐藏 ${data.media.hidden} · 进行中 ${data.media.watching}`
    },
    {
      to: "/collection/people",
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
    <Section title="内容概况" className={className}>
      <ul className="-mx-2 divide-y divide-line-soft">
        {rows.map((row) => (
          <li key={row.label}>
            <Link
              to={row.to}
              className="grid grid-cols-[3rem_auto_minmax(0,1fr)] items-baseline gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-brand-secondary/6 focus-visible:bg-brand-secondary/6"
            >
              <span className="text-[13px] text-muted">{row.label}</span>
              <span className="min-w-[2.5ch] text-right text-[17px] font-semibold text-brand-dark tabular-nums">
                {number.format(row.total)}
              </span>
              <span className="truncate text-right text-[12px] text-faint">{row.detail}</span>
            </Link>
          </li>
        ))}
      </ul>
      {data.media.byKind.length ? (
        <details className="group mt-2 text-[12.5px]">
          <summary className="cursor-pointer list-none text-brand hover:underline [&::-webkit-details-marker]:hidden">
            <ChevronRight
              aria-hidden="true"
              className="mr-0.5 inline size-3.5 align-[-2px] transition-transform group-open:rotate-90 motion-reduce:transition-none"
            />
            收藏按类型
          </summary>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            {data.media.byKind.map(({ kind, count }) => (
              <li key={kind} className="flex justify-between gap-2">
                <Link to={`/collection?kind=${kind}`} className="text-muted hover:text-brand">
                  {MEDIA_KINDS[kind] ?? kind}
                </Link>
                <span className="text-ink tabular-nums">{number.format(count)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Section>
  );
}

// ---- Accounts and services ----

const failingOf = (s: DashboardSource) =>
  Boolean(s.lastError && (!s.lastOk || s.lastOk < s.lastError));

function Dot({ tone }: { tone: "ok" | "warn" | "error" | "none" }) {
  const color = {
    ok: "bg-status-ok",
    warn: "bg-status-warn",
    error: "bg-status-error",
    none: "bg-line-strong"
  }[tone];
  return <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${color}`} />;
}

function AccountRow({
  name,
  tone,
  detail,
  action
}: {
  name: string;
  tone: "ok" | "warn" | "none";
  detail: ReactNode;
  action?: { label: string; to: string };
}) {
  return (
    <li className="flex items-center gap-3 py-2">
      <Dot tone={tone} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] text-ink">{name}</span>
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

function Integrations({ data, className }: { data: DashboardConnections; className: string }) {
  const { steam, spotify, sources } = data;
  const failing = sources.filter((s) => s.configured && failingOf(s));
  const recentOk = sources.filter((s) => s.configured && !failingOf(s) && s.lastOk);
  const untested = sources.filter((s) => s.configured && !s.lastOk && !s.lastError);
  const unset = sources.filter((s) => !s.configured);
  const names = (list: DashboardSource[]) => list.map((s) => SOURCE_LABELS[s.name]).join("、");

  return (
    <Section
      title="账号与服务"
      hint="只根据最近的同步和请求记录判断，不会主动检测服务是否在线。"
      className={className}
      action={
        <Link to="/integrations" className="text-[12px] text-brand hover:underline">
          API 配置
        </Link>
      }
    >
      <h3 className="text-[12px] font-medium text-faint">已授权账号</h3>
      <ul className="divide-y divide-line-soft">
        <AccountRow
          name="Steam"
          tone={!steam.configured || !steam.account ? "none" : steam.account.stale ? "warn" : "ok"}
          detail={
            !steam.configured ? (
              "未配置 API Key"
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
              : { label: "配置", to: "/integrations" }
          }
        />
        <AccountRow
          name="Spotify"
          tone={spotify.configured && spotify.account ? "ok" : "none"}
          detail={
            !spotify.configured
              ? "未配置应用"
              : spotify.account
                ? `已连接 ${spotify.account.displayName}`
                : "未连接账号"
          }
          action={
            spotify.configured
              ? { label: spotify.account ? "管理" : "连接", to: SPOTIFY_LINK }
              : { label: "配置", to: "/integrations" }
          }
        />
      </ul>

      <h3 className="mt-3 mb-1 border-t border-line-soft pt-3 text-[12px] font-medium text-faint">
        资料服务
      </h3>
      {/* Problems first and in full; the rest as one line per state. */}
      {failing.length ? (
        <ul className="mb-2 space-y-1.5">
          {failing.map((s) => (
            <li key={s.name} className="rounded-lg bg-status-error/6 px-2.5 py-2 text-[12.5px]">
              <span className="flex items-center gap-2 font-medium text-status-error">
                <Dot tone="error" />
                {SOURCE_LABELS[s.name]} 最近一次请求失败
                <span className="ml-auto font-normal text-faint">
                  <Time iso={s.lastError!} />
                </span>
              </span>
              {s.lastErrorMessage ? (
                <span className="mt-0.5 block truncate pl-4 text-muted" title={s.lastErrorMessage}>
                  {s.lastErrorMessage}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <dl className="space-y-1.5 text-[12.5px]">
        {recentOk.length ? (
          <div className="flex gap-2">
            <dt className="flex shrink-0 items-center gap-1.5 text-muted">
              <Dot tone="ok" />
              最近请求成功
            </dt>
            <dd className="min-w-0 text-ink">
              {recentOk.map((s, i) => (
                <span key={s.name}>
                  {i ? "、" : ""}
                  <Tooltip content={`上次成功：${new Date(s.lastOk!).toLocaleString("zh-CN")}`}>
                    <span tabIndex={0}>{SOURCE_LABELS[s.name]}</span>
                  </Tooltip>
                </span>
              ))}
            </dd>
          </div>
        ) : null}
        {untested.length ? (
          <div className="flex gap-2">
            <dt className="flex shrink-0 items-center gap-1.5 text-muted">
              <Dot tone="none" />
              暂无请求记录
            </dt>
            <dd className="min-w-0 text-ink">{names(untested)}</dd>
          </div>
        ) : null}
        {unset.length ? (
          <div className="flex gap-2">
            <dt className="flex shrink-0 items-center gap-1.5 text-muted">
              <Dot tone="none" />
              未配置
            </dt>
            <dd className="min-w-0 text-ink">
              {names(unset)} ·{" "}
              <Link to="/integrations" className="text-brand hover:underline">
                去配置
              </Link>
            </dd>
          </div>
        ) : null}
      </dl>
    </Section>
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
const FEED_LENGTH = 10;

type FeedItem = {
  key: string;
  at: string;
  icon: LucideIcon;
  tone: string;
  event: string;
  subject: string;
  to: string | null;
};

/** Edits and import / sync jobs as one time line, newest first. */
function feedOf({ jobs, edited }: DashboardActivity): FeedItem[] {
  const items: FeedItem[] = [
    ...edited.map((item) => ({
      key: `edit:${item.type}:${item.id}`,
      at: item.updatedAt,
      icon: Pencil,
      tone: "text-brand-secondary",
      event: `编辑了${item.kind ? (MEDIA_KINDS[item.kind] ?? EDITED_TYPES[item.type]) : EDITED_TYPES[item.type]}`,
      subject: item.name,
      to: item.to
    })),
    ...jobs.map((job) => ({
      key: `job:${job.at}:${job.name}`,
      at: job.at,
      icon: job.ok ? (job.name === "steam-sync" ? RefreshCw : Download) : CircleAlert,
      tone: job.ok ? "text-status-ok" : "text-status-error",
      event: `${JOBS[job.name] ?? job.name}${job.ok ? "完成" : "失败"}`,
      subject: job.message ?? "",
      to: job.name === "steam-sync" ? STEAM_LINK : null
    }))
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, FEED_LENGTH);
}

function Activity({ data, className }: { data: DashboardActivity; className: string }) {
  const feed = feedOf(data);
  return (
    <Section title="最近动态" hint="最近的编辑和导入、同步任务。" className={className}>
      {feed.length ? (
        <ol className="-mx-2">
          {feed.map(({ key, at, icon: Icon, tone, event, subject, to }) => {
            const body = (
              <>
                <Icon aria-hidden="true" className={`size-3.5 shrink-0 ${tone}`} />
                <span className="shrink-0 text-[12.5px] text-muted">{event}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink" title={subject}>
                  {subject}
                </span>
                <span className="shrink-0 text-[12px] text-faint tabular-nums">
                  <Time iso={at} />
                </span>
              </>
            );
            const row = "flex items-center gap-2 rounded-lg px-2 py-1.5";
            return (
              <li key={key}>
                {to ? (
                  <Link
                    to={to}
                    className={`${row} transition-colors hover:bg-brand-secondary/6 focus-visible:bg-brand-secondary/6`}
                  >
                    {body}
                  </Link>
                ) : (
                  <div className={row}>{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="py-2 text-[13px] text-muted">还没有编辑或导入记录。</p>
      )}
    </Section>
  );
}

// ---- Page ----

const QUICK = [
  { to: "/photos?open=add", label: "添加照片" },
  { to: "/projects?open=new", label: "新建项目" },
  { to: "/collection?open=add", label: "添加收藏" }
];

function DashboardSkeleton() {
  const block = "card animate-pulse motion-reduce:animate-none";
  return (
    <div aria-hidden="true" className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${block} h-[104px]`} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className={`${block} h-56 lg:col-span-7`} />
        <div className={`${block} h-56 lg:col-span-5`} />
      </div>
    </div>
  );
}

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
        description="网站运行情况、需要处理的事和最近的动态。"
        actions={QUICK.map(({ to, label }) => (
          <Link key={to} to={to} className="btn-secondary">
            <Plus aria-hidden="true" className="size-4" /> {label}
          </Link>
        ))}
      />
      {error ? (
        <DatabaseNotice error={error} subject="概览" />
      ) : isPending || !data ? (
        <>
          <p className="sr-only" role="status">
            加载中…
          </p>
          <DashboardSkeleton />
        </>
      ) : (
        <div className="space-y-4">
          <Kpis traffic={data.traffic} />
          {/* One 12-column grid: to do + content, then services + activity; one column when narrow. Cards in
              a row share its height, so their bottoms line up. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <Part part={data.tasks} title="待处理" className="lg:col-span-7">
              {(tasks) => <Tasks tasks={tasks} className="lg:col-span-7" />}
            </Part>
            <Part part={data.content} title="内容概况" className="lg:col-span-5">
              {(content) => <Content data={content} className="lg:col-span-5" />}
            </Part>
            <Part part={data.connections} title="账号与服务" className="lg:col-span-5">
              {(connections) => <Integrations data={connections} className="lg:col-span-5" />}
            </Part>
            <Part part={data.activity} title="最近动态" className="lg:col-span-7">
              {(activity) => <Activity data={activity} className="lg:col-span-7" />}
            </Part>
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
