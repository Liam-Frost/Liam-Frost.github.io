import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";

import App from "./app/App";
import { I18nProvider } from "./lib/i18n";
import QualityProvider from "./perf/QualityProvider";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QualityProvider>
      <I18nProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </I18nProvider>
    </QualityProvider>
  </React.StrictMode>
);
