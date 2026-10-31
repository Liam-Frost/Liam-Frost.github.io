import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router";

import { AdminLayout } from "./components/layout/AdminLayout";
import { ToastProvider } from "./components/ui/Toast";
import { sessionKey, useSession } from "./hooks/useSession";
import { ApiError } from "./lib/api";
import { ADMIN_BASE } from "./lib/adminBase";
import { CenteredCard, LoginPage, NotConfiguredPage } from "./pages/LoginPage";
import { PhotosPage } from "./pages/PhotosPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ComingSoonPage, NotFoundPage, OverviewPage, SectionNotFound } from "./pages/OverviewPage";

// Any 401 (session expired or revoked elsewhere) sends the app back to the login screen.
const onUnauthorized = (error: Error) => {
  if (error instanceof ApiError && error.status === 401) {
    queryClient.setQueryData(sessionKey, { authenticated: false, configured: true, user: null });
  }
};

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onUnauthorized }),
  mutationCache: new MutationCache({ onError: onUnauthorized }),
  defaultOptions: {
    // Retry once for network and server errors; a 4xx will not change on retry.
    queries: {
      retry: (count, error) => count < 1 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
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
        <Route path="*" element={<SectionNotFound />} />
      </Route>
    </Routes>
  );
}
