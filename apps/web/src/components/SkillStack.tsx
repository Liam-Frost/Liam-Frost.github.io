import { useMemo } from "react";

import { skills, type SkillGroup, type SkillLevel } from "../data/skills";
import { cx } from "../lib/cx";
import { useI18n } from "../lib/i18n";

type GroupDef = {
  id: SkillGroup;
  titleKey: "skills.group.frontend" | "skills.group.backend" | "skills.group.creative";
  descKey: "skills.groupDesc.frontend" | "skills.groupDesc.backend" | "skills.groupDesc.creative";
};

const GROUPS: GroupDef[] = [
  {
    id: "frontend",
    titleKey: "skills.group.frontend",
    descKey: "skills.groupDesc.frontend"
  },
  {
    id: "backend",
    titleKey: "skills.group.backend",
    descKey: "skills.groupDesc.backend"
  },
  {
    id: "creative",
    titleKey: "skills.group.creative",
    descKey: "skills.groupDesc.creative"
  }
];

function levelWeight(level: SkillLevel) {
  if (level === "core") return 3;
  if (level === "strong") return 2;
  return 1;
}

export default function SkillStack() {
  const { t } = useI18n();

  const groups = useMemo(() => {
    const byGroup = new Map<SkillGroup, typeof skills[number][]>();
    GROUPS.forEach((g) => byGroup.set(g.id, []));

    for (const s of skills) {
      byGroup.get(s.group)?.push(s);
    }

    for (const [k, arr] of byGroup.entries()) {
      arr.sort((a, b) => {
        const d = levelWeight(b.level) - levelWeight(a.level);
        if (d !== 0) return d;
        return a.name.localeCompare(b.name);
      });
      byGroup.set(k, arr);
    }

    return byGroup;
  }, []);

  return (
    <div className="skillLayout" aria-label={t("skills.title")}>
      {GROUPS.map((g) => {
        const list = groups.get(g.id) ?? [];

        return (
          <section key={g.id} className="card skillGroup" aria-label={t(g.titleKey)}>
            <div className="skillGroupHead">
              <h3 className="skillGroupTitle">{t(g.titleKey)}</h3>
              <p className="skillGroupDesc">{t(g.descKey)}</p>
            </div>

            <div className="skillChips" aria-label={t(g.titleKey)}>
              {list.map((s) => (
                <span
                  key={s.id}
                  className={cx(
                    "skillChip",
                    s.level === "core" && "skillChipCore",
                    s.level === "strong" && "skillChipStrong",
                    s.level === "working" && "skillChipWorking"
                  )}
                >
                  <span className="skillChipName">{s.name}</span>
                </span>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
