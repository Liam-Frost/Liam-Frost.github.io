import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import PhotoCard from "../components/PhotoCard";
import Reveal from "../components/Reveal";
import SkillStack from "../components/SkillStack";
import TypingAnimation from "../components/TypingAnimation";
import { photos, type Photo } from "../data/photos";
import { site } from "../data/site";
import { pickLocalized, useI18n, type Lang } from "../lib/i18n";

// Greeting messages (Japanese uses \n for forced line break)
const GREETINGS = {
  zh: `你好，我是 ${site.nameLatin}`,
  en: `Hi, I'm ${site.nameLatin}`,
  fr: `Salut, je suis ${site.nameLatin}`,
  ja: `はじめまして、\n${site.nameLatin}です`
};

type GreetingLang = keyof typeof GREETINGS;

// Fixed order for cycling (no zh-Hant since it looks same as zh)
const GREETING_ORDER: GreetingLang[] = ["zh", "en", "fr", "ja"];

export default function HomePage() {
  const { lang, t } = useI18n();

  // Featured photo IDs for homepage
  const FEATURED_IDS = [
    "tokyo-tower",                            // 东京之塔
    "glico-night-icon",                       // 奔跑
    "tokyo-night-anchor",                     // 东京印象
    "rome-alley-dome-006",                    // 穹顶之间
    "beijing-temple-003",                     // 敬天
    "crowd-and-lights",                       // 大阪印象
    "hanabi-scatter",                         // 散落
    "jellyfish",                              // 水母
    "vancouver-locarno-pier-2025",            // 京都印象
    "shibuya-sky-arena"                       // 东京折叠
  ];

  const featured = useMemo(() => {
    const photoMap = new Map(photos.map(p => [p.id, p]));
    return FEATURED_IDS
      .map(id => photoMap.get(id))
      .filter((p): p is Photo => p !== undefined);
  }, []);

  const navigate = useNavigate();

  const [copyHint, setCopyHint] = useState("");

  // Map initial lang to greeting lang (zh-Hant -> zh for greeting)
  const mapToGreetingLang = (l: Lang): GreetingLang => {
    return l === "zh-Hant" ? "zh" : (l as GreetingLang);
  };

  // Capture initial language only once on mount, ignore subsequent language changes
  const initialLangRef = useRef<GreetingLang | null>(null);
  useEffect(() => {
    if (initialLangRef.current === null) {
      initialLangRef.current = mapToGreetingLang(lang);
    }
  }, [lang]);

  // Build words array: start with initial greeting lang, then continue in list order
  const greetingWords = useMemo(() => {
    const initialGreetingLang = initialLangRef.current ?? mapToGreetingLang(lang);
    const startIdx = GREETING_ORDER.indexOf(initialGreetingLang);
    // Reorder: from startIdx to end, then from 0 to startIdx-1
    const orderedLangs = [
      ...GREETING_ORDER.slice(startIdx),
      ...GREETING_ORDER.slice(0, startIdx)
    ];
    return orderedLangs.map((l) => GREETINGS[l]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps: only compute once on mount

  const openFeatured = (id: string) => {
    navigate({ pathname: "/portfolio", search: `?photo=${encodeURIComponent(id)}` });
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(site.email);
      setCopyHint(t("contact.copied"));
    } catch {
      setCopyHint(t("contact.copyFailed"));
    }
  };


  return (
    <>
      <section className="section hero" id="top">
        <div className="container">
          <div className="heroGrid">
            <Reveal>
              <p className="eyebrow">{t("home.eyebrow")}</p>

              <h1 className="heroTitle">
                <TypingAnimation
                  words={greetingWords}
                  typeSpeed={50}
                  deleteSpeed={100}
                  pauseDelay={2500}
                  loop
                  showCursor
                  blinkCursor
                  cursorStyle="underscore"
                />
              </h1>

              <p className="heroSubtitle">{pickLocalized(site.bio, lang)}</p>

              <div className="heroCta">
                <Link className="btn btnPrimary" to="/portfolio">
                  {t("home.cta.portfolio")}
                </Link>
                <Link className="btn btnSoft" to="/#contact">
                  {t("home.cta.contact")}
                </Link>
              </div>
            </Reveal>

            <Reveal delayMs={120} className="card heroCard">
              <div className="profile">
                <div className="profileHeader">
                  <div className="avatar" aria-hidden="true">
                    <div className="avatarMark" />
                  </div>

                  <div>
                    <h2 className="profileName">{site.name}</h2>
                    <p className="profileTagline">{pickLocalized(site.role, lang)}</p>
                  </div>
                </div>

                <div className="profileStats" aria-label="Stats">
                  {site.stats.map((s) => (
                    <div key={s.value} className="stat">
                      <div className="statNum">{s.value}</div>
                      <div className="statLabel">{pickLocalized(s.label, lang)}</div>
                    </div>
                  ))}
                </div>


              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section" id="about">
        <div className="container">
          <Reveal>
            <h2 className="sectionTitle">{t("about.title")}</h2>
            <p className="sectionSubtitle">
              {pickLocalized(site.role, lang)} · {t("about.subtitle")}
            </p>
          </Reveal>

          <div className="grid grid2 aboutGrid">
            <Reveal delayMs={80}>
              <div className="card aboutCard">
                <h3 className="aboutCardTitle">{t("about.card.left")}</h3>

                <div className="aboutCardBody">
                  <div className="aboutSection">
                    <div className="aboutSectionTitle">{t("about.section.capabilities")}</div>
                    <ul className="aboutList">
                      <li>{t("about.capabilities.b1")}</li>
                      <li>{t("about.capabilities.b2")}</li>
                      <li>{t("about.capabilities.b3")}</li>
                    </ul>
                  </div>

                  <div className="aboutSection">
                    <div className="aboutSectionTitle">{t("about.section.focus")}</div>
                    <p className="aboutText">{t("about.focus.body")}</p>
                  </div>

                  <div className="aboutSection">
                    <div className="aboutSectionTitle">{t("about.section.tooling")}</div>
                    <div className="tags" aria-label={t("skills.title")}>
                      {["React", "Java", "Springboot", "C++", "Lightroom"].map((x) => (
                        <span key={x} className="tag">
                          {x}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delayMs={140}>
              <div className="card aboutCard">
                <h3 className="aboutCardTitle">{t("about.card.right")}</h3>

                <div className="aboutCardBody">
                  <div className="aboutSection">
                    <div className="aboutSectionTitle">{t("about.section.gear")}</div>
                    <div className="metaList">
                      {site.gear.map((g) => (
                        <div key={g.value} className="metaItem">
                          <div className="metaKey">{pickLocalized(g.key, lang)}</div>
                          <div className="metaVal">{g.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="aboutSection">
                    <div className="aboutSectionTitle">{t("about.section.output")}</div>
                    <div className="tags" aria-label={t("about.section.output")}>
                      {["Series", "Web", "Performance", "Story"].map((x) => (
                        <span key={x} className="tag">
                          {x}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section" id="skills">
        <div className="container">
          <Reveal>
            <h2 className="sectionTitle">{t("skills.title")}</h2>
            <p className="sectionSubtitle">{t("skills.subtitle")}</p>
          </Reveal>

          <Reveal delayMs={120}>
            <SkillStack />
          </Reveal>
        </div>
      </section>

      <section className="section" id="featured">
        <div className="container">
          <Reveal>
            <h2 className="sectionTitle">{t("featured.title")}</h2>
            <p className="sectionSubtitle">{t("featured.subtitle")}</p>
          </Reveal>

          <div className="masonry" aria-label={t("featured.title")}>
            {featured.map((p, idx) => (
              <div key={p.id} className="masonryItem">
                <Reveal delayMs={(idx % 6) * 40}>
                  <PhotoCard photo={p} onOpen={openFeatured} priority={idx < 2} />
                </Reveal>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link className="btn btnPrimary" to="/portfolio">
              {t("featured.cta.all")}
            </Link>
            <Link className="btn btnGhost" to="/#contact">
              {t("featured.cta.contact")}
            </Link>
          </div>
        </div>
      </section>

      <section className="section" id="contact">
        <div className="container">
          <Reveal>
            <h2 className="sectionTitle">{t("contact.title")}</h2>
            <p className="sectionSubtitle">{t("contact.subtitle")}</p>
          </Reveal>

          <Reveal delayMs={120}>
            <div className="card contactCard">
              <p className="contactLead">{t("contact.lead")}</p>
              <p className="contactMessage">{t("contact.message")}</p>

              <a className="contactEmail" href={`mailto:${site.email}`}>
                {site.email}
              </a>

              <div className="contactActions">
                <button className="contactCopy" type="button" onClick={copyEmail}>
                  {t("contact.copy")}
                </button>
                <span className="contactHint" role="status" aria-live="polite">
                  {copyHint}
                </span>
              </div>

              <div className="contactElsewhere">
                <span className="contactElsewhereLabel">{t("contact.elsewhere")}</span>
                <div className="contactElsewhereLinks">
                  {site.socials.map((s) => (
                    <a key={s.label} className="contactElsewhereLink" href={s.href} target="_blank" rel="noreferrer">
                      {s.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
