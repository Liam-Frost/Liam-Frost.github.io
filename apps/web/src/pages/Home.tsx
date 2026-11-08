import { useSiteSettings } from "../data/useSiteSettings";
import { refreshPresentation, usePresentation } from "../data/usePresentation";
import { useStack } from "../data/useStack";
import LoadingSkeleton from "../components/LoadingSkeleton";
import PageLoading from "../components/PageLoading";
import { apiFetchEnabled } from "../lib/api";
import { useContactState } from "../data/useContact";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Link, useNavigate } from "react-router";

import AboutSection from "../components/AboutSection";
import HeroStats from "../components/HeroStats";
import HomeCollection from "../components/HomeCollection";
import PhotoCard from "../components/PhotoCard";
import ProjectCard from "../components/ProjectCard";
import Reveal from "../components/Reveal";
import TechStack from "../components/TechStack";
import TypingAnimation from "../components/TypingAnimation";
import { site } from "../data/site";
import { useCollection } from "../data/useCollection";
import { usePhotos } from "../data/usePhotos";
import { useProjects } from "../data/useProjects";
import { pickLocalized, useI18n, type Lang } from "../lib/i18n";
import { stackScrollMotion } from "../lib/motion";

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
  const settings = useSiteSettings();
  const presentation = usePresentation();
  const { photos, status: photoStatus } = usePhotos();
  const { contact, loading: contactLoading } = useContactState();

  // Featured photo IDs for homepage
  // Marked in the admin ("首页精选"); the seed content marks the original selection.
  const featured = useMemo(() => photos.filter((p) => p.featured), [photos]);
  // Between the introduction and the photos; hidden when there are no featured projects (or no API).
  const { projects, status: projectStatus } = useProjects();
  const featuredProjects = useMemo(
    () => projects.filter((p) => p.featured).slice(0, 4),
    [projects]
  );
  // After the projects: featured, in progress and recent entries (hidden when the collection is empty).
  const collection = useCollection();

  const navigate = useNavigate();
  // The line above the title: the roles, e.g. "全栈工程师 · 摄影爱好者 · 音乐爱好者".
  const roles = pickLocalized(site.role, lang)
    .split("|")
    .map((role) => role.trim())
    .filter(Boolean);

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
    const orderedLangs = [...GREETING_ORDER.slice(startIdx), ...GREETING_ORDER.slice(0, startIdx)];
    return orderedLangs.map((l) =>
      GREETINGS[l].replace(
        site.nameLatin,
        pickLocalized(settings?.identity.name ?? {}, l) || site.nameLatin
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.identity.name]); // Keep the initial language order while reflecting edited identity.

  const openFeatured = (id: string) => {
    navigate({ pathname: "/portfolio", search: `?photo=${encodeURIComponent(id)}` });
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(contact?.email ?? "");
      setCopyHint(t("contact.copied"));
    } catch {
      setCopyHint(t("contact.copyFailed"));
    }
  };

  if (!presentation) return <PageLoading />;
  if (presentation.unavailable)
    return (
      <section className="section">
        <div className="container" role="status">
          <p>{t("home.loadFailed")}</p>
          <button className="btn" type="button" onClick={refreshPresentation}>
            {t("skills.retry")}
          </button>
        </div>
      </section>
    );
  const visible = presentation.sections;
  return (
    <>
      {visible.top && (
        <section className="section hero" id="top">
          <div className="container">
            {/* Five blocks placed by grid areas: text left and portrait right on wide screens; on
              narrow ones an offset editorial layout (see the hero styles). */}
            <div className="heroGrid">
              <Reveal className="heroRolesBlock">
                <p className="eyebrow heroRoles">
                  {roles.map((role) => (
                    <span key={role}>{role}</span>
                  ))}
                </p>
              </Reveal>

              <Reveal className="heroHead">
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
              </Reveal>

              <Reveal className="heroBio">
                <p className="heroSubtitle">{pickLocalized(site.bio, lang)}</p>
              </Reveal>

              <Reveal after className="heroPortrait">
                {settings?.avatarUrl ? (
                  <img
                    className="avatarPhoto"
                    src={settings.avatarUrl}
                    alt=""
                    fetchPriority="high"
                  />
                ) : (
                  <div className="avatarMark" aria-hidden="true" />
                )}
              </Reveal>

              <Reveal after className="heroNumbers">
                <HeroStats projects={projects} photos={photos} collection={collection} />
              </Reveal>
            </div>
          </div>

          <Link className="heroScroll" to="/#about" aria-label={t("home.scroll")}>
            <ChevronDown aria-hidden="true" />
          </Link>
        </section>
      )}

      {visible.about && <AboutSection />}
      {visible.skills && <HomeSkillsSection />}

      {visible.projects &&
        (projectStatus === "loading" ? (
          <section className="section" id="projects">
            <div className="container">
              <LoadingSkeleton label={t("projects.loading")} count={2} />
            </div>
          </section>
        ) : featuredProjects.length ? (
          <section className="section" id="projects">
            <div className="container">
              <Reveal intensity="subtle">
                <h2 className="sectionTitle">{t("projects.title")}</h2>
                <p className="sectionSubtitle">{t("projects.home.subtitle")}</p>
              </Reveal>

              <div className="projectGrid">
                {featuredProjects.map((project) => (
                  <Reveal key={project.slug} after stagger>
                    <ProjectCard project={project} />
                  </Reveal>
                ))}
              </div>

              <div style={{ marginTop: 14, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link className="btn btnPrimary" to="/projects">
                  {t("projects.cta.all")}
                </Link>
              </div>
            </div>
          </section>
        ) : null)}

      {visible.watching &&
        (collection.status === "loading" ? (
          <section className="section" id="watching">
            <div className="container">
              <LoadingSkeleton label={t("collection.loading")} />
            </div>
          </section>
        ) : (
          <HomeCollection collection={collection} />
        ))}

      {visible.featured &&
        (featured.length > 0 ||
          (apiFetchEnabled && (photoStatus === "loading" || photoStatus === "seed"))) && (
          <section className="section" id="featured">
            <div className="container">
              <Reveal intensity="subtle">
                <h2 className="sectionTitle">{t("featured.title")}</h2>
                <p className="sectionSubtitle">{t("featured.subtitle")}</p>
              </Reveal>

              {apiFetchEnabled && (photoStatus === "seed" || photoStatus === "loading") ? (
                <LoadingSkeleton label={t("featured.title")} />
              ) : (
                <div className="masonry" aria-label={t("featured.title")}>
                  {featured.map((p, idx) => (
                    <div key={p.id} className="masonryItem">
                      <Reveal after stagger>
                        <PhotoCard photo={p} onOpen={openFeatured} priority={idx < 2} />
                      </Reveal>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 14, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link className="btn btnPrimary" to="/portfolio">
                  {t("featured.cta.all")}
                </Link>
              </div>
            </div>
          </section>
        )}

      {visible.contact &&
        (contactLoading ? (
          <section className="section" id="contact">
            <div className="container">
              <LoadingSkeleton label={t("contact.title")} variant="form" count={1} />
            </div>
          </section>
        ) : contact && (contact.email || contact.links.length > 0) ? (
          <section className="section" id="contact">
            <div className="container">
              <Reveal intensity="subtle">
                <h2 className="sectionTitle">{t("contact.title")}</h2>
                <p className="sectionSubtitle">{t("contact.subtitle")}</p>
              </Reveal>

              <Reveal after>
                <div className="card contactCard">
                  <p className="contactLead">{t("contact.lead")}</p>
                  <p className="contactMessage">{t("contact.message")}</p>

                  {contact.email && (
                    <a className="contactEmail" href={`mailto:${contact.email}`}>
                      {contact.email}
                    </a>
                  )}

                  {contact.email && (
                    <div className="contactActions">
                      <button className="contactCopy" type="button" onClick={copyEmail}>
                        {t("contact.copy")}
                      </button>
                      <span className="contactHint" role="status" aria-live="polite">
                        {copyHint}
                      </span>
                    </div>
                  )}

                  {contact.links.length > 0 && (
                    <div className="contactElsewhere">
                      <span className="contactElsewhereLabel">{t("contact.elsewhere")}</span>
                      <div className="contactElsewhereLinks" data-analytics="contact">
                        {contact.links.map((s, index) => (
                          <a
                            key={index}
                            className="contactElsewhereLink"
                            href={s.href}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {s.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Reveal>
            </div>
          </section>
        ) : null)}
    </>
  );
}

function HomeSkillsSection() {
  const stack = useStack();
  const { t } = useI18n();
  const scrollMotion = useMemo(stackScrollMotion, []);
  if (stack.status === "ready" && !stack.categories.some((c) => c.technologies.length)) return null;
  return (
    <section className="section" id="skills">
      <div className="container">
        <Reveal intensity="subtle">
          <h2 className="sectionTitle">{t("skills.title")}</h2>
          <p className="sectionSubtitle">{t("skills.subtitle")}</p>
        </Reveal>
        {scrollMotion ? (
          <TechStack data={stack} scrollMotion />
        ) : (
          <Reveal after>
            <TechStack data={stack} />
          </Reveal>
        )}
      </div>
    </section>
  );
}
