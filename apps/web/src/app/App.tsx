import SiteMetadata from "../components/SiteMetadata";
import { useSiteSettings, refreshSiteSettings } from "../data/useSiteSettings";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { lazy, Suspense, useEffect } from "react";
import { Route, Routes } from "react-router";

import AnalyticsTracker from "./AnalyticsTracker";
import ScrollManager from "./ScrollManager";
import BackgroundFX from "../components/BackgroundFX";
import Footer from "../components/Footer";
import Header from "../components/Header";
import SpotifyDock from "../components/SpotifyDock";
import WaveformNavigator from "../components/waveform/WaveformNavigator";
import HomePage from "../pages/Home";
import NotFoundPage from "../pages/NotFound";
import PortfolioPage from "../pages/Portfolio";
const PrivacyPage = lazy(() => import("../pages/Privacy"));
import ProjectsPage from "../pages/Projects";
import { useI18n } from "../lib/i18n";
import { scrollToElement, startSmoothScroll } from "../lib/smoothScroll";
import { useTheme } from "../lib/useTheme";

// Markdown is only needed on project/privacy pages; keep it out of the main bundle.
const ProjectDetailPage = lazy(() => import("../pages/ProjectDetail"));
// Only /collection needs the collection page and its detail panel.
const CollectionPage = lazy(() => import("../pages/Collection"));

export default function App() {
  const { t } = useI18n();
  const settings = useSiteSettings();
  const { theme, cycleTheme } = useTheme();
  // Smooth scrolling for the whole site (lib/smoothScroll.ts).
  useEffect(() => startSmoothScroll(), []);

  if (!settings) return <LoadingSkeleton label={t("nav.home")} />;
  if (settings.unavailable)
    return (
      <section className="section container" role="alert">
        <p>{t("home.loadFailed")}</p>
        <button className="btn" onClick={refreshSiteSettings}>
          {t("skills.retry")}
        </button>
      </section>
    );
  return (
    <div className="site">
      <SiteMetadata />
      <a
        className="skipLink"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          const main = document.getElementById("main");
          if (main) {
            main.focus({ preventScroll: true });
            scrollToElement(main, true);
          }
        }}
      >
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

      <main id="main" tabIndex={-1}>
        <Routes>
          <Route
            path="/"
            element={
              window.location.pathname !== "/" && window.location.pathname !== "/index.html" ? (
                <NotFoundPage />
              ) : (
                <HomePage />
              )
            }
          />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route
            path="/privacy"
            element={
              <Suspense fallback={<LoadingSkeleton label={t("privacy.title")} />}>
                <PrivacyPage />
              </Suspense>
            }
          />
          <Route
            path="/collection"
            element={
              <Suspense
                fallback={
                  <div className="container">
                    <LoadingSkeleton label={t("collection.loading")} />
                  </div>
                }
              >
                <CollectionPage />
              </Suspense>
            }
          />
          <Route
            path="/projects/:slug"
            element={
              <Suspense
                fallback={
                  <div className="container">
                    <LoadingSkeleton label={t("collection.loading")} />
                  </div>
                }
              >
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
      <WaveformNavigator />
    </div>
  );
}
