import type { IntegrationProvider } from "@liam-frost/shared";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import {
  hasDraft,
  INTEGRATIONS_KEY,
  IntegrationItem
} from "../components/integrations/IntegrationItem";
import { useIntegrationDrafts } from "../components/integrations/drafts";
import { PageHeader } from "../components/layout/AdminLayout";
import { api } from "../lib/api";

/** Services by what they are for; Spotify and Steam also need an account connected in 收藏. */
const GROUPS: { title: string; providers: IntegrationProvider[] }[] = [
  { title: "资料来源", providers: ["tmdb", "googlebooks", "igdb"] },
  { title: "账号与同步", providers: ["spotify", "steam"] }
];

export function IntegrationsPage() {
  const { data, isPending, error } = useQuery({
    queryKey: INTEGRATIONS_KEY,
    queryFn: api.integrations
  });
  const [open, setOpen] = useState<IntegrationProvider | null>(null);
  // Unsaved input per service: kept when another service is opened or the page is left, cleared after
  // saving or cancelling.
  const { drafts, setDraft } = useIntegrationDrafts();
  const unsaved = Object.values(drafts).some(hasDraft);
  // The last request of each source and the connected accounts, from the overview's data; only once
  // a service is opened.
  const { data: dashboard } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: api.dashboard,
    enabled: open !== null,
    staleTime: 60_000
  });

  useEffect(() => {
    if (!unsaved) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [unsaved]);

  return (
    <div className="max-w-[840px]">
      <PageHeader title="API 配置" description="第三方服务的访问凭据，保存后立即生效。" />
      <p className="mb-4 text-[13px] text-muted">
        地理识别、请求频率、保留时间和 IP 排除规则在{" "}
        <Link className="text-brand underline" to="/analytics/settings">
          统计 → 设置
        </Link>{" "}
        中管理。
      </p>
      <p className="mb-6 flex items-start gap-2 text-[12.5px] leading-relaxed text-muted">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-secondary" />
        凭据加密保存，只在服务器上使用，保存后不再显示原值。预发布和正式环境分别保存。
      </p>

      {isPending ? <ListSkeleton /> : null}
      {error ? (
        <p role="alert" className="text-[13px] text-status-error">
          {error.message}
        </p>
      ) : null}
      {data ? (
        <>
          {!data.editable ? (
            <p role="alert" className="mb-5 text-[13px] text-status-warn">
              需要先配置数据库与管理员密钥，才能保存 API 配置。
            </p>
          ) : null}
          <div className="space-y-6">
            {GROUPS.map((group) => (
              <section key={group.title} aria-labelledby={`group-${group.title}`}>
                <h2
                  id={`group-${group.title}`}
                  className="mb-2 px-1 text-[12px] font-medium text-faint"
                >
                  {group.title}
                </h2>
                <ul className="card divide-y divide-line-soft overflow-hidden">
                  {group.providers.map((provider) => (
                    <IntegrationItem
                      key={provider}
                      provider={provider}
                      status={data.providers[provider]}
                      editable={data.editable}
                      open={open === provider}
                      onToggle={() => setOpen(open === provider ? null : provider)}
                      draft={drafts[provider] ?? {}}
                      onDraft={(values) => setDraft(provider, values)}
                      dashboard={dashboard}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {unsaved ? (
            <p className="mt-4 text-[12px] text-status-warn">
              有未保存的修改：保存后才会生效。在后台里切换页面会保留，刷新或关闭页面会丢失。
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-6">
      {[3, 2].map((rows, group) => (
        <div key={group}>
          <div className="mb-2 h-3 w-16 rounded bg-line-soft" />
          <div className="card divide-y divide-line-soft">
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-4">
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-24 rounded bg-line-soft" />
                  <div className="h-3 w-48 max-w-full rounded bg-line-soft/70" />
                </div>
                <div className="h-4 w-12 rounded bg-line-soft" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
