import Reveal from "../components/Reveal";
import { analyticsEnabled } from "../lib/analytics";
import { useI18n, type Key } from "../lib/i18n";

const SECTIONS: [Key, Key][] = [
  ["privacy.collectTitle", "privacy.collect"],
  ["privacy.notTitle", "privacy.not"],
  ["privacy.keepTitle", "privacy.keep"],
  ["privacy.optOutTitle", "privacy.optOut"]
];

/** What the site's visitor analytics collect, and how to turn them off. */
export default function PrivacyPage() {
  const { t } = useI18n();

  return (
    <section className="section">
      <div className="container privacy">
        <Reveal>
          <h1 className="sectionTitle">{t("privacy.title")}</h1>
          <p className="sectionSubtitle">{t("privacy.intro")}</p>
        </Reveal>
        <Reveal delayMs={80}>
          <div className="card prose">
            {SECTIONS.map(([title, text]) => (
              <section key={title}>
                <h2>{t(title)}</h2>
                <p>{t(text)}</p>
              </section>
            ))}
            <p className="privacyStatus">
              {t(analyticsEnabled ? "privacy.statusOn" : "privacy.statusOff")}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
