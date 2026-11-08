import type { IntegrationProvider } from "@liam-frost/shared";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { SettingsPage, SettingsState } from "../components/settings/SettingsUI";
import LoadingSkeleton from "../../../web/src/components/LoadingSkeleton";

import {
  hasDraft,
  INTEGRATIONS_KEY,
  IntegrationItem
} from "../components/integrations/IntegrationItem";
import { useIntegrationDrafts } from "../components/integrations/drafts";
import { api } from "../lib/api";

/** Services by what they are for; Spotify and Steam also need an account connected in 收藏. */
const GROUPS: { title: string; providers: IntegrationProvider[] }[] = [
  { title: "资料来源", providers: ["tmdb", "googlebooks", "igdb"] },
  { title: "账号与同步", providers: ["spotify", "steam"] }
];

export function IntegrationsPage() {
  const { data, isPending, error, refetch } = useQuery({
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
    <SettingsPage title="集成与 API" description="管理第三方服务凭据与连接，各服务独立保存。">
      <p className="mb-6 flex items-start gap-2 text-[12.5px] leading-relaxed text-muted">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-secondary" />
        凭据加密保存，只在服务器上使用，保存后不再显示原值。预发布和正式环境分别保存。
      </p>

      {isPending ? <LoadingSkeleton label="读取集成配置…" variant="form" /> : null}
      {error ? <SettingsState error={error.message} onRetry={() => void refetch()} /> : null}
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
                  className="mb-2 px-1 text-[12px] font-medium text-muted"
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
    </SettingsPage>
  );
}
