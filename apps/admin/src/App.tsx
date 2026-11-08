import SiteFavicon from "../../web/src/components/SiteFavicon";
import { AdminDocumentTitle } from "./hooks/useAdminTitle";
import { clearSettingsDrafts } from "./components/settings/drafts";
import { clearIntegrationDrafts } from "./components/integrations/drafts";
import { SettingsLayout, SettingsRedirect } from "./components/settings/SettingsLayout";
import { SiteSettingsPage, RuntimeSettingsPage } from "./pages/SiteSettingsPage";
import { AuditPage } from "./pages/AuditPage";
import { AppearancePage } from "./pages/AppearancePage";
import { FeaturedPage } from "./pages/FeaturedPage";
import { ContactPage } from "./pages/ContactPage";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router";

import { AdminLayout } from "./components/layout/AdminLayout";
import { CollectionLayout } from "./components/collection/CollectionLayout";
import { ToastProvider } from "./components/ui/Toast";
import { sessionKey, useSession } from "./hooks/useSession";
import { ApiError } from "./lib/api";
import { ADMIN_BASE } from "./lib/adminBase";
import { CenteredCard, LoginPage, NotConfiguredPage } from "./pages/LoginPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { IntegrationsPage } from "./pages/IntegrationsPage";
import { CollectionPage } from "./pages/CollectionPage";
import { MediaEditPage } from "./pages/MediaEditPage";
import { MusicPage } from "./pages/MusicPage";
import { PeoplePage } from "./pages/PeoplePage";
import { PersonEditPage } from "./pages/PersonEditPage";
import { PhotosPage } from "./pages/PhotosPage";
import { ProjectEditPage } from "./pages/ProjectEditPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { AboutPage } from "./pages/AboutPage";
import { StackPage } from "./pages/StackPage";
import { NotFoundPage, OverviewPage, SectionNotFound } from "./pages/OverviewPage";

// Any 401 (session expired or revoked elsewhere) sends the app back to the login screen.
const onUnauthorized = (error: Error) => {
  if (error instanceof ApiError && error.status === 401) {
    clearIntegrationDrafts();
    clearSettingsDrafts();
    queryClient.setQueryData(sessionKey, { authenticated: false, configured: true, user: null });
  }
};

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onUnauthorized }),
  mutationCache: new MutationCache({ onError: onUnauthorized }),
  defaultOptions: {
    // Retry once for network and server errors; a 4xx will not change on retry.
    queries: {
      retry: (count, error) =>
        count < 1 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      refetchOnWindowFocus: false
    }
  }
});

export function App() {
  // No admin path in the page means it was not served as the admin app: show nothing about the admin.
  if (!ADMIN_BASE) return <NotFoundPage />;

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter basename={ADMIN_BASE}>
          <SiteFavicon />
          <AdminDocumentTitle />
          <SessionGate />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

function SessionGate() {
  const { data: session, isPending, error } = useSession();

  if (isPending) {
    return <p className="py-24 text-center text-[13px] text-subtle">加载中…</p>;
  }
  if (error || !session) {
    return (
      <CenteredCard>
        <p role="alert" className="text-[13.5px] text-status-error">
          {error?.message ?? "无法加载登录状态"}
        </p>
      </CenteredCard>
    );
  }
  if (!session.configured) return <NotConfiguredPage />;
  if (!session.authenticated || !session.user) return <LoginPage />;

  return (
    <Routes>
      <Route element={<AdminLayout user={session.user} />}>
        <Route index element={<OverviewPage />} />
        <Route path="photos" element={<PhotosPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectEditPage />} />
        <Route path="stack" element={<StackPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="collection" element={<CollectionLayout />}>
          <Route index element={<CollectionPage />} />
          <Route path="people" element={<PeoplePage />} />
          <Route path="featured" element={<FeaturedPage />} />
          <Route path="people/:id" element={<PersonEditPage />} />
          <Route path=":id" element={<MediaEditPage />} />
        </Route>
        <Route path="people" element={<LegacyPersonRedirect />} />
        <Route path="people/:id" element={<LegacyPersonRedirect />} />
        <Route path="music" element={<MusicPage />} />
        <Route
          path="integrations"
          element={<SettingsRedirect to="/settings/privacy/integrations" />}
        />
        <Route path="audit" element={<AuditPage />} />
        <Route path="appearance" element={<SettingsRedirect to="/settings/experience/home" />} />
        <Route path="settings" element={<SettingsLayout />}>
          <Route index element={<SettingsRedirect to="/settings/site/identity" />} />
          <Route
            path="site/identity"
            element={<SiteSettingsPage key="identity" group="identity" />}
          />
          <Route path="site/branding" element={<AppearancePage key="branding" mode="branding" />} />
          <Route path="site/footer" element={<SiteSettingsPage key="footer" group="footer" />} />
          <Route path="experience/home" element={<AppearancePage key="home" mode="home" />} />
          <Route
            path="experience/preferences"
            element={<SiteSettingsPage key="preferences" group="preferences" />}
          />
          <Route
            path="experience/dictionary"
            element={<SiteSettingsPage key="dictionary" group="dictionary" />}
          />
          <Route
            path="privacy/content"
            element={<SiteSettingsPage key="privacy" group="privacy" />}
          />
          <Route path="privacy/integrations" element={<IntegrationsPage />} />
          <Route path="admin/login" element={<AppearancePage key="login" mode="login" />} />
          <Route path="admin/security" element={<RuntimeSettingsPage />} />
          <Route
            path="frontend/identity"
            element={<SettingsRedirect to="/settings/site/identity" />}
          />
          <Route
            path="frontend/appearance"
            element={<SettingsRedirect to="/settings/experience/home" />}
          />
          <Route path="frontend/footer" element={<SettingsRedirect to="/settings/site/footer" />} />
          <Route
            path="frontend/preferences"
            element={<SettingsRedirect to="/settings/experience/preferences" />}
          />
          <Route
            path="frontend/privacy"
            element={<SettingsRedirect to="/settings/privacy/content" />}
          />
          <Route
            path="frontend/dictionary"
            element={<SettingsRedirect to="/settings/experience/dictionary" />}
          />
          <Route
            path="backend/appearance"
            element={<SettingsRedirect to="/settings/admin/login" />}
          />
          <Route
            path="backend/favicon"
            element={<SettingsRedirect to="/settings/site/branding" />}
          />
          <Route
            path="backend/integrations"
            element={<SettingsRedirect to="/settings/privacy/integrations" />}
          />
          <Route
            path="backend/security"
            element={<SettingsRedirect to="/settings/admin/security" />}
          />
          <Route
            path="backend/language"
            element={<SettingsRedirect to="/settings/experience/preferences" />}
          />
          <Route
            path="backend/statistics"
            element={<SettingsRedirect to="/analytics/settings" />}
          />
          <Route path="backend/audit" element={<SettingsRedirect to="/audit" />} />
        </Route>
        <Route path="analytics" element={<AnalyticsPage view="overview" />} />
        <Route path="analytics/content" element={<AnalyticsPage view="content" />} />
        <Route path="analytics/content/:type/:id" element={<AnalyticsPage view="detail" />} />
        <Route path="analytics/audience" element={<AnalyticsPage view="audience" />} />
        <Route path="analytics/health" element={<AnalyticsPage view="health" />} />
        <Route path="analytics/settings" element={<AnalyticsPage view="settings" />} />
        <Route path="*" element={<SectionNotFound />} />
      </Route>
    </Routes>
  );
}

function LegacyPersonRedirect() {
  const { id } = useParams();
  return <Navigate replace to={`/collection/people${id ? `/${encodeURIComponent(id)}` : ""}`} />;
}
