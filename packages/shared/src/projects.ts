import type { LocalizedText } from "./api";

/** What a project was: the owner's own, a team's, coursework, paid work or an open-source project. */
export const PROJECT_KINDS = ["personal", "team", "course", "work", "open-source"] as const;
export type ProjectKind = (typeof PROJECT_KINDS)[number];

/** Problem, solution and result of the hardest part of a project. */
export type ProjectChallenge = {
  problem: LocalizedText;
  solution: LocalizedText;
  result: LocalizedText;
};

/**
 * What the owner did in a project, as stored and edited in the admin. The list fields hold one item
 * per line in each language (see projectLines, projectOutcomes and projectCollaborators), so a list
 * is translated as one text.
 */
export type ProjectDetails = {
  kind: ProjectKind | null;
  /** People in the team, the owner included; null when not stated or the project is the owner's own. */
  teamSize: number | null;
  /** The owner's role, e.g. "Backend lead". */
  role: LocalizedText;
  /** The owner's own months (YYYY-MM), when they differ from the project's. */
  myStartedAt: string | null;
  myEndedAt: string | null;
  /** One contribution per line. */
  contributions: LocalizedText;
  /** One outcome per line: "value | label", e.g. "40% | faster responses". */
  outcomes: LocalizedText;
  challenge: ProjectChallenge;
  /** One person per line: "name | role | link" (role and link are optional). */
  collaborators: LocalizedText;
  /** Names of the project's technologies the owner worked with; none means "not told apart". */
  ownTechnologies: string[];
  /** Captions of the screenshots, by image id. */
  captions: Record<string, LocalizedText>;
};

export const EMPTY_PROJECT_DETAILS: ProjectDetails = {
  kind: null,
  teamSize: null,
  role: {},
  myStartedAt: null,
  myEndedAt: null,
  contributions: {},
  outcomes: {},
  challenge: { problem: {}, solution: {}, result: {} },
  collaborators: {},
  ownTechnologies: [],
  captions: {}
};

/** What a project's detail page gets of ProjectDetails (kind, team size and role are in the summary). */
export type PublicProjectDetails = Pick<
  ProjectDetails,
  "myStartedAt" | "myEndedAt" | "contributions" | "outcomes" | "challenge" | "collaborators"
> & {
  /** The owner's technologies among the ones shown on the site, in the site's order. */
  ownTechStack: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function text(value: unknown): LocalizedText {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => typeof item === "string" && item)
  ) as LocalizedText;
}

/** A stored value as ProjectDetails: a project saved before the details existed has `{}`. */
export function normalizeProjectDetails(value: unknown): ProjectDetails {
  const stored = isRecord(value) ? value : {};
  const challenge = isRecord(stored.challenge) ? stored.challenge : {};
  const captions = isRecord(stored.captions) ? stored.captions : {};
  return {
    kind: PROJECT_KINDS.includes(stored.kind as ProjectKind) ? (stored.kind as ProjectKind) : null,
    teamSize:
      typeof stored.teamSize === "number" && Number.isInteger(stored.teamSize)
        ? stored.teamSize
        : null,
    role: text(stored.role),
    myStartedAt: typeof stored.myStartedAt === "string" ? stored.myStartedAt : null,
    myEndedAt: typeof stored.myEndedAt === "string" ? stored.myEndedAt : null,
    contributions: text(stored.contributions),
    outcomes: text(stored.outcomes),
    challenge: {
      problem: text(challenge.problem),
      solution: text(challenge.solution),
      result: text(challenge.result)
    },
    collaborators: text(stored.collaborators),
    ownTechnologies: Array.isArray(stored.ownTechnologies)
      ? stored.ownTechnologies.filter((name): name is string => typeof name === "string")
      : [],
    captions: Object.fromEntries(
      Object.entries(captions)
        .map(([id, caption]) => [id, text(caption)] as const)
        .filter(([, caption]) => Object.keys(caption).length)
    )
  };
}

/** The items of a list field: its lines, trimmed, without empty ones and leading list marks. */
export function projectLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*•]\s+/, "").trim())
    .filter(Boolean);
}

const parts = (line: string) => line.split("|").map((part) => part.trim());

/** "40% | faster responses" → value and label; a line without "|" is a label alone. */
export function projectOutcomes(value: string): { value: string; label: string }[] {
  return projectLines(value).map((line) => {
    const [first, ...rest] = parts(line);
    return rest.length ? { value: first, label: rest.join(" | ") } : { value: "", label: first };
  });
}

/** "Name | role | https://…" → a person; only http(s) links are kept. */
export function projectCollaborators(
  value: string
): { name: string; role: string; url: string | null }[] {
  return projectLines(value)
    .map((line) => {
      const [name, ...rest] = parts(line);
      const url = rest.find((part) => /^https?:\/\/\S+$/i.test(part)) ?? null;
      return { name, role: rest.filter((part) => part !== url).join(" | "), url };
    })
    .filter((person) => person.name);
}
