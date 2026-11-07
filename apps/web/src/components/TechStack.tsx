import "./loading-skeleton.css";
import {
  stackInitials,
  type PublicStackProject,
  type PublicStackTechnology
} from "@liam-frost/shared";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { useCallback, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";

import { useStack } from "../data/useStack";
import { cx } from "../lib/cx";
import { pickLocalized, useI18n } from "../lib/i18n";
import DetailDrawer from "./DetailDrawer";
import { useStackScrub } from "./useStackScrub";

/** Related projects listed at first in a technology's details; the rest behind "show all". */
const INITIAL_PROJECTS = 4;

/**
 * A logo in a fixed square slot, without a tile: the image keeps its proportions (contain) and is
 * scaled by its measured optical size; logos that would vanish in one theme are adapted there (see
 * StackIconTone). The initials in the same slot when there is no logo or it fails to load.
 */
function StackLogo({ technology }: { technology: PublicStackTechnology }) {
  const [failed, setFailed] = useState(false);
  const url = failed ? null : technology.iconUrl;
  return (
    <span
      className={cx(
        "stackLogo",
        url && technology.iconTone && `stackLogoTone-${technology.iconTone}`
      )}
      style={url ? ({ "--logo-scale": technology.iconScale } as CSSProperties) : undefined}
      aria-hidden="true"
    >
      {url ? (
        <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <span className="stackLogoInitials">{stackInitials(technology.name)}</span>
      )}
    </span>
  );
}

/**
 * One technology. With related projects it is a button that opens its details; with only a website
 * it links there; otherwise it is plain text, with no pointer or hover.
 */
function StackItem({
  technology,
  expanded,
  onOpen
}: {
  technology: PublicStackTechnology;
  expanded: boolean;
  onOpen: (trigger: HTMLButtonElement) => void;
}) {
  const { t } = useI18n();
  const className = cx("stackItem", technology.prominence === "primary" && "stackItemPrimary");
  const body = (
    <>
      <StackLogo technology={technology} />
      <span className="stackName">{technology.name}</span>
    </>
  );
  if (technology.projects.length) {
    return (
      <button
        type="button"
        className={cx(className, "stackItemAction")}
        aria-haspopup="dialog"
        aria-expanded={expanded}
        aria-label={t("skills.details", { name: technology.name })}
        onClick={(event) => onOpen(event.currentTarget)}
      >
        {body}
        <ChevronRight className="stackItemArrow" aria-hidden="true" />
      </button>
    );
  }
  if (technology.websiteUrl) {
    return (
      <a
        className={cx(className, "stackItemAction")}
        href={technology.websiteUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${technology.name} — ${t("skills.website")}`}
      >
        {body}
        <ArrowUpRight className="stackItemArrow" aria-hidden="true" />
      </a>
    );
  }
  return <span className={className}>{body}</span>;
}

/** A project in a technology's details: a small cover, its title and one line about it. */
function RelatedProjectItem({ project }: { project: PublicStackProject }) {
  const { lang, t } = useI18n();
  const title = pickLocalized(project.title, lang) || project.slug;
  const summary = pickLocalized(project.summary, lang);
  return (
    <Link className="stackRelatedItem" to={`/projects/${project.slug}`}>
      <span className="stackRelatedThumb" aria-hidden="true">
        {project.thumbnail ? (
          <img
            src={project.thumbnail.url}
            width={project.thumbnail.width}
            height={project.thumbnail.height}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span>{stackInitials(title)}</span>
        )}
      </span>
      <span className="stackRelatedText">
        <span className="stackRelatedTitle">{title}</span>
        {summary ? <span className="stackRelatedSummary">{summary}</span> : null}
        <span className="stackRelatedMeta">{t(`projects.status.${project.status}`)}</span>
      </span>
      <ChevronRight className="stackRelatedArrow" aria-hidden="true" />
    </Link>
  );
}

/** A technology's details: its logo and name, its website, and the public projects using it. */
function TechnologyDetail({
  technology,
  category,
  onClose
}: {
  technology: PublicStackTechnology;
  category: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [showAll, setShowAll] = useState(false);
  const projects = showAll ? technology.projects : technology.projects.slice(0, INITIAL_PROJECTS);
  return (
    <DetailDrawer
      id={technology.id}
      labelledBy="stack-detail-title"
      onClose={onClose}
      variant="compact"
    >
      <div className="stackDetail">
        <div className="stackDetailHead">
          <StackLogo technology={technology} />
          <div className="stackDetailHeading">
            {category ? <p className="stackDetailCategory">{category}</p> : null}
            <h2 className="stackDetailTitle" id="stack-detail-title">
              {technology.name}
            </h2>
          </div>
          {technology.websiteUrl ? (
            <a
              className="btn btnGhost btnSmall stackDetailWebsite"
              href={technology.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("skills.officialSite")}
              <ArrowUpRight aria-hidden="true" />
            </a>
          ) : null}
        </div>
        <section className="stackDetailSection" aria-labelledby="stack-detail-related">
          <h3 id="stack-detail-related">
            {t("skills.related")}
            <span className="stackDetailCount">{technology.projects.length}</span>
          </h3>
          <ul className="stackRelated">
            {projects.map((project) => (
              <li key={project.slug}>
                <RelatedProjectItem project={project} />
              </li>
            ))}
          </ul>
          {projects.length < technology.projects.length ? (
            <button
              type="button"
              className="btn btnGhost btnSmall stackDetailMore"
              onClick={() => setShowAll(true)}
            >
              {t("skills.showAll", { count: technology.projects.length })}
            </button>
          ) : null}
        </section>
      </div>
    </DetailDrawer>
  );
}

/**
 * The tech stack as an editorial list: each category's name (and line) on the left, its technologies
 * with their logos in a grid on the right; stacked on narrow screens. Content and order come from
 * the admin (GET /api/stack). A technology used by public projects opens its details on click.
 */
/**
 * The home page's tech stack. With `scrollMotion` (Stage 26, GSAP ScrollTrigger; see lib/motion.ts and useStackScrub)
 * categories and technologies rise in one by one as the page scrolls, go back one by one when
 * scrolling up, and the section fades out as it leaves; otherwise the caller wraps it in a one-time
 * <Reveal>.
 */
export default function TechStack({
  scrollMotion = false,
  data
}: {
  scrollMotion?: boolean;
  data?: ReturnType<typeof useStack>;
}) {
  const { lang, t } = useI18n();
  const loaded = useStack(!data);
  const { categories, status, retry } = data ?? loaded;
  const [openId, setOpenId] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  useStackScrub(listRef, scrollMotion, categories);

  const open = useCallback((id: string, button: HTMLButtonElement) => {
    trigger.current = button;
    setOpenId(id);
  }, []);
  // Focus goes back to the technology that opened the details.
  const close = useCallback(() => {
    setOpenId(null);
    trigger.current?.focus();
  }, []);

  if (status === "loading") {
    // Placeholder rows of a typical height, so the page does not jump when the stack arrives.
    return (
      <div className="stackList" aria-busy="true" aria-label={t("skills.loading")}>
        {[0, 1, 2].map((row) => (
          <div key={row} className="stackGroup stackGroupPlaceholder" aria-hidden="true">
            <div className="stackGroupHead">
              <span className="stackSkeleton loadingSkeleton-block stackSkeletonTitle" />
            </div>
            <div className="stackItems">
              {[0, 1, 2, 3].map((item) => (
                <span key={item} className="stackItem">
                  <span className="stackLogo stackSkeleton loadingSkeleton-block" />
                  <span className="stackSkeleton loadingSkeleton-block stackSkeletonName" />
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="stackNotice" role="status">
        <p>{t("skills.error")}</p>
        {retry ? (
          <button type="button" className="btn" onClick={retry}>
            {t("skills.retry")}
          </button>
        ) : null}
      </div>
    );
  }

  if (!categories.length) {
    return (
      <div className="stackNotice" role="status">
        <p>{t("skills.empty")}</p>
      </div>
    );
  }

  const openCategory = categories.find((c) => c.technologies.some((x) => x.id === openId));
  const openTechnology = openCategory?.technologies.find((x) => x.id === openId);

  return (
    <div ref={listRef} className={cx("stackList", scrollMotion && "stackScrub")}>
      {categories.map((category, index) => {
        const name = pickLocalized(category.name, lang);
        const description = pickLocalized(category.description, lang);
        const headingId = `stack-${category.id}`;
        return (
          <section key={category.id} className="stackGroup" aria-labelledby={headingId}>
            <div className="stackGroupHead">
              <span className="stackGroupIndex" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="stackGroupTitle" id={headingId}>
                {name}
              </h3>
              {description ? <p className="stackGroupDesc">{description}</p> : null}
            </div>
            <ul className="stackItems">
              {category.technologies.map((technology) => (
                <li key={technology.id}>
                  <StackItem
                    technology={technology}
                    expanded={technology.id === openId}
                    onOpen={(button) => open(technology.id, button)}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {/* On <body>: a reveal or scroll animation transforms its ancestors, which would trap a fixed panel. */}
      {openTechnology && openCategory
        ? createPortal(
            <TechnologyDetail
              key={openTechnology.id}
              technology={openTechnology}
              category={pickLocalized(openCategory.name, lang)}
              onClose={close}
            />,
            document.body
          )
        : null}
    </div>
  );
}
