import type { ProjectImage } from "@liam-frost/shared";
import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import { Link, useParams } from "react-router";
import remarkGfm from "remark-gfm";

import FullscreenImageViewer from "../components/FullscreenImageViewer";
import { imageSrcSet, projectPeriod } from "../components/ProjectCard";
import Reveal from "../components/Reveal";
import { useProject } from "../data/useProjects";
import { pickLocalized, useI18n } from "../lib/i18n";

const LINK_KEYS = ["demo", "repo", "docs"] as const;

export default function ProjectDetailPage() {
  const { slug = "" } = useParams();
  const { lang, t } = useI18n();
  const { project, status } = useProject(slug);
  const [viewing, setViewing] = useState<ProjectImage | null>(null);

  const title = project ? pickLocalized(project.title, lang) || project.slug : "";

  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = `${title} · Liam Frost`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  if (status === "loading") {
    return (
      <section className="section">
        <div className="container">
          <p className="sectionSubtitle">{t("projects.loading")}</p>
        </div>
      </section>
    );
  }

  if (!project) {
    return (
      <section className="section">
        <div className="container">
          <h1 className="sectionTitle">404</h1>
          <p className="sectionSubtitle">{t("projects.notFound")}</p>
          <Link className="btn btnPrimary" to="/projects">
            {t("projects.back")}
          </Link>
        </div>
      </section>
    );
  }

  const summary = pickLocalized(project.summary, lang);
  const body = pickLocalized(project.body, lang);
  const period = projectPeriod(project, t("projects.present"));
  const links = LINK_KEYS.filter((key) => project.links[key]);

  return (
    <article className="section projectDetail">
      <div className="container">
        <Reveal>
          <Link className="projectBack" to="/projects">
            ← {t("projects.back")}
          </Link>
          <div className="projectMeta">
            <span className={`projectStatus projectStatus-${project.status}`}>{t(`projects.status.${project.status}`)}</span>
            {period ? <span>{period}</span> : null}
          </div>
          <h1 className="sectionTitle">{title}</h1>
          {summary ? <p className="sectionSubtitle">{summary}</p> : null}

          {project.techStack.length ? (
            <div className="tags">
              {project.techStack.map((tech) => (
                <span key={tech} className="tag">
                  {tech}
                </span>
              ))}
            </div>
          ) : null}

          {links.length ? (
            <div className="projectLinks">
              {links.map((key, index) => (
                <a key={key} className={index === 0 ? "btn btnPrimary" : "btn btnGhost"} href={project.links[key]} target="_blank" rel="noopener noreferrer">
                  {t(`projects.links.${key}`)} ↗
                </a>
              ))}
            </div>
          ) : null}
        </Reveal>

        {project.cover ? (
          <Reveal delayMs={80}>
            <button type="button" className="projectHero" onClick={() => setViewing(project.cover)} aria-label={title}>
              <img
                src={project.cover.src}
                srcSet={imageSrcSet(project.cover)}
                sizes="(max-width: 1120px) calc(100vw - 40px), 1080px"
                width={project.cover.width}
                height={project.cover.height}
                alt=""
                decoding="async"
                fetchPriority="high"
              />
            </button>
          </Reveal>
        ) : null}

        {body ? (
          <Reveal delayMs={120}>
            <div className="card prose">
              {/* No raw HTML: react-markdown escapes it, so admin-entered text cannot inject markup. */}
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{ a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" /> }}
              >
                {body}
              </Markdown>
            </div>
          </Reveal>
        ) : null}

        {project.gallery.length ? (
          <Reveal delayMs={160}>
            <h2 className="projectSectionTitle">{t("projects.gallery")}</h2>
            <div className="projectGallery">
              {project.gallery.map((image, index) => (
                <button key={image.id} type="button" className="projectShot" onClick={() => setViewing(image)} aria-label={`${title} ${index + 1}`}>
                  <img
                    src={image.variants[Math.min(1, image.variants.length - 1)].url}
                    srcSet={imageSrcSet(image)}
                    sizes="(max-width: 760px) calc(100vw - 40px), 520px"
                    width={image.width}
                    height={image.height}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              ))}
            </div>
          </Reveal>
        ) : null}
      </div>

      {viewing ? (
        <FullscreenImageViewer baseUrl={viewing.src} originalWidth={viewing.width} originalHeight={viewing.height} alt={title} onClose={() => setViewing(null)} />
      ) : null}
    </article>
  );
}
