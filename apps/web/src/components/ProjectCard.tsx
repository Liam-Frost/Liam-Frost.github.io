import type { ProjectImage, PublicProjectSummary } from "@liam-frost/shared";
import { Link } from "react-router";

import { pickLocalized, useI18n } from "../lib/i18n";

/** "2025-01 – 2025-06", "2025-01 – Present", or nothing. */
export function projectPeriod(project: Pick<PublicProjectSummary, "startedAt" | "endedAt" | "status">, present: string) {
  if (!project.startedAt) return project.endedAt ?? "";
  const end = project.endedAt ?? (project.status === "in-progress" ? present : "");
  return end && end !== project.startedAt ? `${project.startedAt} – ${end}` : project.startedAt;
}

/** srcset for an uploaded image's generated sizes. */
export function imageSrcSet(image: ProjectImage) {
  return image.variants.map((v) => `${v.url} ${v.width}w`).join(", ");
}

export default function ProjectCard({ project, priority }: { project: PublicProjectSummary; priority?: boolean }) {
  const { lang, t } = useI18n();
  const title = pickLocalized(project.title, lang) || project.slug;
  const summary = pickLocalized(project.summary, lang);
  const period = projectPeriod(project, t("projects.present"));

  return (
    <Link className="projectCard" to={`/projects/${project.slug}`} aria-label={t("projects.open", { title })}>
      <div className="projectCover">
        {project.cover ? (
          <img
            src={project.cover.variants[Math.min(1, project.cover.variants.length - 1)].url}
            srcSet={imageSrcSet(project.cover)}
            sizes="(max-width: 760px) calc(100vw - 40px), (max-width: 1100px) calc((100vw - 54px) / 2), 520px"
            alt=""
            loading={priority ? "eager" : "lazy"}
            decoding="async"
          />
        ) : (
          <span className="projectCoverEmpty" aria-hidden="true">
            {title.slice(0, 1)}
          </span>
        )}
      </div>
      <div className="projectBody">
        <div className="projectMeta">
          <span className={`projectStatus projectStatus-${project.status}`}>{t(`projects.status.${project.status}`)}</span>
          {period ? <span>{period}</span> : null}
        </div>
        <h3 className="projectTitle">{title}</h3>
        {summary ? <p className="projectSummary">{summary}</p> : null}
        {project.techStack.length ? (
          <div className="tags">
            {project.techStack.slice(0, 6).map((tech) => (
              <span key={tech} className="tag">
                {tech}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
