import { stackInitials, type PublicStackTechnology } from "@liam-frost/shared";
import { ArrowUpRight } from "lucide-react";
import { useState } from "react";

import { useStack } from "../data/useStack";
import { cx } from "../lib/cx";
import { pickLocalized, useI18n } from "../lib/i18n";

/** A logo in a fixed tile; the initials in the same tile when there is none or it fails to load. */
function StackLogo({ technology }: { technology: PublicStackTechnology }) {
  const [failed, setFailed] = useState(false);
  const url = failed ? null : technology.iconUrl;
  return (
    <span className="stackLogo" aria-hidden="true">
      {url ? (
        <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <span className="stackLogoInitials">{stackInitials(technology.name)}</span>
      )}
    </span>
  );
}

function StackItem({ technology }: { technology: PublicStackTechnology }) {
  const { t } = useI18n();
  const className = cx("stackItem", technology.prominence === "primary" && "stackItemPrimary");
  const body = (
    <>
      <StackLogo technology={technology} />
      <span className="stackName">{technology.name}</span>
    </>
  );
  // Only technologies with a website are links; the others are plain text, with no pointer or hover.
  return technology.websiteUrl ? (
    <a
      className={cx(className, "stackItemLink")}
      href={technology.websiteUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${technology.name} — ${t("skills.website")}`}
    >
      {body}
      <ArrowUpRight className="stackItemArrow" aria-hidden="true" />
    </a>
  ) : (
    <span className={className}>{body}</span>
  );
}

/**
 * The tech stack as an editorial list: each category's name (and line) on the left, its technologies
 * with their logos in a grid on the right; stacked on narrow screens. Content and order come from
 * the admin (GET /api/stack).
 */
export default function TechStack() {
  const { lang, t } = useI18n();
  const { categories, status, retry } = useStack();

  if (status === "loading") {
    // Placeholder rows of a typical height, so the page does not jump when the stack arrives.
    return (
      <div className="stackList" aria-busy="true" aria-label={t("skills.loading")}>
        {[0, 1, 2].map((row) => (
          <div key={row} className="stackGroup stackGroupPlaceholder" aria-hidden="true">
            <div className="stackGroupHead">
              <span className="stackSkeleton stackSkeletonTitle" />
            </div>
            <div className="stackItems">
              {[0, 1, 2, 3].map((item) => (
                <span key={item} className="stackItem">
                  <span className="stackLogo stackSkeleton" />
                  <span className="stackSkeleton stackSkeletonName" />
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

  return (
    <div className="stackList">
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
                  <StackItem technology={technology} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
