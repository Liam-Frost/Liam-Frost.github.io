import { useSiteSettings } from "../data/useSiteSettings";
import { pickLocalized } from "../lib/i18n";
import Markdown from "react-markdown";
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
  const { t, lang } = useI18n();
  const settings = useSiteSettings();
  const custom = pickLocalized(settings?.privacy.body ?? {}, lang);

  return (
    <section className="section">
      <div className="container privacy">
        <Reveal intensity="subtle">
          <h1 className="sectionTitle">
            {pickLocalized(settings?.privacy.title ?? {}, lang) || t("privacy.title")}
          </h1>
          <p className="sectionSubtitle">{t("privacy.intro")}</p>
        </Reveal>
        <Reveal after>
          <div className="card prose">
            {custom ? (
              <>
                <Markdown skipHtml disallowedElements={["img", "iframe", "script", "style"]}>
                  {custom}
                </Markdown>
                {settings?.privacy.effectiveDate ? <p>{settings.privacy.effectiveDate}</p> : null}
              </>
            ) : (
              SECTIONS.map(([title, text]) => (
                <section key={title}>
                  <h2>{t(title)}</h2>
                  <p>{t(text)}</p>
                </section>
              ))
            )}
            <p className="privacyStatus">
              {t(analyticsEnabled ? "privacy.statusOn" : "privacy.statusOff")}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
