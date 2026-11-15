import { useSiteSettings } from "../data/useSiteSettings";
import LoadingImage from "../components/LoadingImage";
import LoadingSkeleton from "../components/LoadingSkeleton";
import {
  projectCollaborators,
  projectLines,
  projectOutcomes,
  type ProjectImage,
  type PublicProjectDetails
} from "@liam-frost/shared";
import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import { Link, useParams } from "react-router";
import remarkGfm from "remark-gfm";

import FullscreenImageViewer from "../components/FullscreenImageViewer";
import { imageSrcSet, projectKindLine, projectPeriod } from "../components/ProjectCard";
import Reveal from "../components/Reveal";
import { useProject } from "../data/useProjects";
import { pickLocalized, useI18n } from "../lib/i18n";

const LINK_KEYS = ["demo", "repo", "docs"] as const;

const EMPTY_PUBLIC_DETAILS: PublicProjectDetails = {
  myStartedAt: null,
  myEndedAt: null,
  contributions: {},
  outcomes: {},
  challenge: { problem: {}, solution: {}, result: {} },
  collaborators: {},
  ownTechStack: []
};

export default function ProjectDetailPage() {
  const { slug = "" } = useParams();
  const { lang, t } = useI18n();
  const settings = useSiteSettings();
  const owner = pickLocalized(settings?.identity.name ?? {}, lang) || "Liam Frost";
  const { project, status } = useProject(slug);
  const [viewing, setViewing] = useState<ProjectImage | null>(null);

  const title = project ? pickLocalized(project.title, lang) || project.slug : "";

  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = `${title} · ${owner}`;
    return () => {
      document.title = previous;
    };
  }, [title, owner]);

  if (status === "loading") {
    return (
      <section className="section">
        <div className="container">
          <LoadingSkeleton label={t("projects.loading")} variant="detail" />
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

  // What the owner did. Every part is optional; a project without any looks as it did before.
  // An API from before these fields existed sends none.
  const details = { ...EMPTY_PUBLIC_DETAILS, ...project.details };
  const kind = projectKindLine(project, t);
  const role = pickLocalized(project.role, lang);
  const myPeriod = details.myStartedAt
    ? projectPeriod(
        { startedAt: details.myStartedAt, endedAt: details.myEndedAt, status: project.status },
        t("projects.present")
      )
    : "";
  const contributions = projectLines(pickLocalized(details.contributions, lang));
  const outcomes = projectOutcomes(pickLocalized(details.outcomes, lang));
  const challenge = (["problem", "solution", "result"] as const)
    .map((key) => ({ key, text: pickLocalized(details.challenge[key], lang) }))
    .filter((part) => part.text);
  const collaborators = projectCollaborators(pickLocalized(details.collaborators, lang));
  const own = new Set(details.ownTechStack);
  const otherTech = project.techStack.filter((tech) => !own.has(tech));
  // Told apart only when some, not all, of the technologies are the owner's.
  const splitTech = details.ownTechStack.length > 0 && otherTech.length > 0;

  return (
    <article className="section projectDetail">
      <div className="container">
        <Reveal intensity="subtle">
          <Link className="projectBack" to="/projects">
            ← {t("projects.back")}
          </Link>
          <div className="projectMeta">
            <span className={`projectStatus projectStatus-${project.status}`}>
              {t(`projects.status.${project.status}`)}
            </span>
            {period ? <span>{period}</span> : null}
          </div>
          <h1 className="sectionTitle">{title}</h1>
          {summary ? <p className="sectionSubtitle">{summary}</p> : null}

          {kind || role || myPeriod ? (
            <dl className="projectFacts">
              {kind ? (
                <div>
                  <dt>{t("projects.facts.kind")}</dt>
                  <dd>{kind}</dd>
                </div>
              ) : null}
              {role ? (
                <div>
                  <dt>{t("projects.facts.role")}</dt>
                  <dd>{role}</dd>
                </div>
              ) : null}
              {myPeriod ? (
                <div>
                  <dt>{t("projects.facts.myPeriod")}</dt>
                  <dd>{myPeriod}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          {splitTech ? (
            <div className="projectTech">
              <div className="projectTechRow">
                <span className="projectTechLabel">{t("projects.tech.mine")}</span>
                <div className="tags">
                  {details.ownTechStack.map((tech) => (
                    <span key={tech} className="tag tagMine">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
              <div className="projectTechRow">
                <span className="projectTechLabel">{t("projects.tech.others")}</span>
                <div className="tags">
                  {otherTech.map((tech) => (
                    <span key={tech} className="tag tagOther">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : project.techStack.length ? (
            <div className="tags">
              {project.techStack.map((tech) => (
                <span key={tech} className="tag">
                  {tech}
                </span>
              ))}
            </div>
          ) : null}

          {links.length ? (
            <div className="projectLinks" data-analytics="project_links">
              {links.map((key, index) => (
                <a
                  key={key}
                  className={index === 0 ? "btn btnPrimary" : "btn btnGhost"}
                  href={project.links[key]}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t(`projects.links.${key}`)} ↗
                </a>
              ))}
            </div>
          ) : null}
        </Reveal>

        {project.cover ? (
          <Reveal after stagger>
            <button
              type="button"
              className="projectHero"
              onClick={() => setViewing(project.cover)}
              aria-label={title}
            >
              <LoadingImage
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

        {outcomes.length || contributions.length || challenge.length ? (
          <Reveal after stagger>
            {outcomes.length ? (
              <ul className="projectOutcomes" aria-label={t("projects.outcomes")}>
                {outcomes.map((outcome) => (
                  <li key={`${outcome.value}|${outcome.label}`}>
                    {outcome.value ? <strong>{outcome.value}</strong> : null}
                    <span>{outcome.label}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {contributions.length ? (
              <section className="card projectContrib">
                <h2>{t("projects.contributions")}</h2>
                <ul>
                  {contributions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            {challenge.length ? (
              <section className="card projectChallenge">
                <h2>{t("projects.challenge")}</h2>
                <dl>
                  {challenge.map((part) => (
                    <div key={part.key}>
                      <dt>{t(`projects.challenge.${part.key}`)}</dt>
                      <dd>{part.text}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}
          </Reveal>
        ) : null}

        {body ? (
          <Reveal after stagger>
            <div className="card prose" data-analytics="project_body">
              {/* No raw HTML: react-markdown escapes it, so admin-entered text cannot inject markup. */}
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ node: _node, ...props }) => (
                    <a {...props} target="_blank" rel="noopener noreferrer" />
                  )
                }}
              >
                {body}
              </Markdown>
            </div>
          </Reveal>
        ) : null}

        {project.gallery.length ? (
          <Reveal after stagger>
            <h2 className="projectSectionTitle">{t("projects.gallery")}</h2>
            <div className="projectGallery">
              {project.gallery.map((image, index) => (
                <figure key={image.id} className="projectFigure">
                  <button
                    type="button"
                    className="projectShot"
                    onClick={() => setViewing(image)}
                    aria-label={`${title} ${index + 1}`}
                  >
                    <LoadingImage
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
                  {pickLocalized(image.caption, lang) ? (
                    <figcaption>{pickLocalized(image.caption, lang)}</figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
          </Reveal>
        ) : null}
        {collaborators.length ? (
          <Reveal after stagger>
            <h2 className="projectSectionTitle">{t("projects.collaborators")}</h2>
            <ul className="projectPeople">
              {collaborators.map((person) => (
                <li key={`${person.name}|${person.role}`}>
                  {person.url ? (
                    <a href={person.url} target="_blank" rel="noopener noreferrer">
                      <strong>{person.name}</strong> ↗
                    </a>
                  ) : (
                    <strong>{person.name}</strong>
                  )}
                  {person.role ? <span>{person.role}</span> : null}
                </li>
              ))}
            </ul>
          </Reveal>
        ) : null}
      </div>

      {viewing ? (
        <FullscreenImageViewer
          baseUrl={viewing.src}
          originalWidth={viewing.width}
          originalHeight={viewing.height}
          alt={title}
          onClose={() => setViewing(null)}
        />
      ) : null}
    </article>
  );
}
