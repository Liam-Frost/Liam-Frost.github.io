/**
 * Matching a project's plain technology names to the technologies of the stack. The same rules as
 * the migration that first linked them (prisma/migrations/20261111090000_project_technologies):
 * names are compared ignoring case, spaces, '.', '-' and '_', and a few common names of the same
 * thing are treated as one. Nothing fuzzier: a name that does not match exactly one technology is
 * left alone for the admin to decide.
 */

/** Normalised name → the normalised name it stands for. Keep in step with the migration's list. */
export const TECHNOLOGY_ALIASES: Readonly<Record<string, string>> = {
  reactjs: "react",
  vuejs: "vue",
  node: "nodejs",
  golang: "go",
  postgres: "postgresql",
  js: "javascript",
  ts: "typescript",
  cpp: "c++",
  css3: "css",
  html5: "html",
  k8s: "kubernetes",
  premiere: "premierepro",
  adobepremierepro: "premierepro",
  adobephotoshop: "photoshop",
  adobeaftereffects: "aftereffects",
  adobelightroom: "lightroom",
  lightroomclassic: "lightroom",
  davinci: "davinciresolve"
};

/** "Spring Boot" and "SpringBoot" → "springboot"; "React.js" → "react"; "C++" stays "c++". */
export function technologyKey(name: string) {
  const key = name
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, "");
  return TECHNOLOGY_ALIASES[key] ?? key;
}

export type TechnologyMatch = {
  /** Technologies matched, in the order of the names (each once). */
  linked: { name: string; technologyId: string }[];
  /** Names left as they are: no technology of that name. */
  unmatched: string[];
  /** Names left as they are: several technologies of that name (namesakes in two categories). */
  ambiguous: string[];
};

export function matchTechnologies(
  names: string[],
  technologies: { id: string; name: string }[]
): TechnologyMatch {
  const byKey = new Map<string, string[]>();
  for (const technology of technologies) {
    const key = technologyKey(technology.name);
    byKey.set(key, [...(byKey.get(key) ?? []), technology.id]);
  }
  const result: TechnologyMatch = { linked: [], unmatched: [], ambiguous: [] };
  const seen = new Set<string>();
  for (const name of names) {
    const ids = byKey.get(technologyKey(name)) ?? [];
    if (ids.length > 1) result.ambiguous.push(name);
    else if (!ids.length) result.unmatched.push(name);
    else if (!seen.has(ids[0]!)) {
      seen.add(ids[0]!);
      result.linked.push({ name, technologyId: ids[0]! });
    }
  }
  return result;
}
