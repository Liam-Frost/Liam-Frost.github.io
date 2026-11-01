import { useMemo, useState } from "react";

import ProjectCard from "../components/ProjectCard";
import Reveal from "../components/Reveal";
import { useProjects } from "../data/useProjects";
import { cx } from "../lib/cx";
import { useI18n } from "../lib/i18n";

const ALL = "__all__";

export default function ProjectsPage() {
  const { t } = useI18n();
  const { projects, status } = useProjects();
  const [tech, setTech] = useState(ALL);

  // Technologies used by more than one project make useful filters; one-offs would only clutter the bar.
  const filters = useMemo(() => {
    const counts = new Map<string, number>();
    for (const project of projects)
      for (const name of project.techStack) counts.set(name, (counts.get(name) ?? 0) + 1);
    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([name]) => name)
      .sort((a, b) => a.localeCompare(b));
  }, [projects]);

  const visible = tech === ALL ? projects : projects.filter((p) => p.techStack.includes(tech));

  return (
    <section className="section">
      <div className="container">
        <Reveal>
          <h1 className="sectionTitle">{t("projects.title")}</h1>
          <p className="sectionSubtitle">{t("projects.subtitle")}</p>
        </Reveal>

        {filters.length ? (
          <div className="filters projectFilters" aria-label={t("projects.title")}>
            {[ALL, ...filters].map((name) => (
              <button
                key={name}
                type="button"
                className={cx("btn", "btnSmall", name === tech ? "btnSoft" : "btnGhost")}
                onClick={() => setTech(name)}
              >
                {name === ALL ? t("projects.filterAll") : name}
              </button>
            ))}
          </div>
        ) : null}

        {status === "loading" ? (
          <p className="sectionSubtitle">{t("projects.loading")}</p>
        ) : visible.length === 0 ? (
          <p className="sectionSubtitle">{t("projects.empty")}</p>
        ) : (
          <div className="projectGrid">
            {visible.map((project, index) => (
              <Reveal key={project.slug} delayMs={(index % 4) * 50}>
                <ProjectCard project={project} priority={index < 2} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
