import { Route, Routes } from "react-router-dom";

import ScrollManager from "./ScrollManager";
import BackgroundFX from "../components/BackgroundFX";
import Footer from "../components/Footer";
import Header from "../components/Header";
import HomePage from "../pages/Home";
import NotFoundPage from "../pages/NotFound";
import PortfolioPage from "../pages/Portfolio";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/useTheme";

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

      <header className="siteHeader">
        <div className="container">
          <Header theme={theme} onCycleTheme={cycleTheme} />
        </div>
      </header>

      <main id="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <footer className="siteFooter">
        <div className="container">
          <Footer />
        </div>
      </footer>
    </div>
  );
}
