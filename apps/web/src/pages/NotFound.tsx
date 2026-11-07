import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Reveal from "../components/Reveal";
import { useI18n } from "../lib/i18n";
export default function NotFoundPage() {
  const { t } = useI18n();
  return (
    <section className="section notFoundPage" aria-labelledby="not-found-title">
      <div className="container">
        <Reveal instant>
          <p className="notFoundCode" aria-hidden="true">
            404<span>↗</span>
          </p>
          <div className="notFoundBody">
            <p className="eyebrow">PAGE NOT FOUND</p>
            <h1 id="not-found-title">{t("notFound.title")}</h1>
            <p className="sectionSubtitle">{t("notFound.subtitle")}</p>
            <div className="notFoundActions">
              <a className="btn btnPrimary" href="/">
                <ArrowLeft aria-hidden="true" size={16} />
                {t("notFound.home")}
              </a>
              <a className="btn btnGhost" href="/#/portfolio">
                {t("notFound.portfolio")}
                <ArrowUpRight aria-hidden="true" size={16} />
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
