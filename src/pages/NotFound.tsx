import { Link } from "react-router-dom";

import Reveal from "../components/Reveal";
import { useI18n } from "../lib/i18n";

export default function NotFoundPage() {
  const { t } = useI18n();

  return (
    <section className="section">
      <div className="container">
        <Reveal>
          <h1 className="sectionTitle">{t("notFound.title")}</h1>
          <p className="sectionSubtitle">{t("notFound.subtitle")}</p>
          <div style={{ marginTop: 14, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link className="btn btnPrimary" to="/">
              {t("notFound.home")}
            </Link>
            <Link className="btn btnGhost" to="/portfolio">
              {t("notFound.portfolio")}
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
