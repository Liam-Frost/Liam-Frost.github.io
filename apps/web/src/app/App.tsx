import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";

import AnalyticsTracker from "./AnalyticsTracker";
import ScrollManager from "./ScrollManager";
import BackgroundFX from "../components/BackgroundFX";
import Footer from "../components/Footer";
import Header from "../components/Header";
import SpotifyDock from "../components/SpotifyDock";
import HomePage from "../pages/Home";
import NotFoundPage from "../pages/NotFound";
import PortfolioPage from "../pages/Portfolio";
import PrivacyPage from "../pages/Privacy";
import ProjectsPage from "../pages/Projects";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/useTheme";

// The Markdown renderer is only needed on project pages; keep it out of the main bundle.
const ProjectDetailPage = lazy(() => import("../pages/ProjectDetail"));
// Only /collection needs the collection page and its detail panel.
const CollectionPage = lazy(() => import("../pages/Collection"));

export default function App() {
  const { t } = useI18n();
  const { theme, cycleTheme } = useTheme();

  return (
    <div className="site">
      <a className="skipLink" href="#main">
        {t("common.skipToContent")}
      </a>

      <BackgroundFX />
      <ScrollManager />
      <AnalyticsTracker />

      <header className="siteHeader">
        <div className="container">
          <Header theme={theme} onCycleTheme={cycleTheme} />
        </div>
      </header>

      <main id="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route
            path="/collection"
            element={
              <Suspense fallback={null}>
                <CollectionPage />
              </Suspense>
            }
          />
          <Route
            path="/projects/:slug"
            element={
              <Suspense fallback={null}>
                <ProjectDetailPage />
              </Suspense>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <footer className="siteFooter">
        <div className="container">
          <Footer />
        </div>
      </footer>

      <SpotifyDock />
    </div>
  );
}
