import type { StackCatalogIcon, StackCatalogProvider } from "@liam-frost/shared";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/**
 * The logo libraries the admin picks from, read from the installed npm packages (devicon,
 * simple-icons). Only metadata is held in memory; an icon's SVG is read when it is requested and
 * served as an image (never inlined into a page). The catalog only suggests logos: the site's stack
 * itself lives in the database.
 */

/** Public URL prefix of library icons. Under /uploads so the static snapshot copies them like uploads. */
export const STACK_ICON_PREFIX = "/uploads/icons";

/** Library keys: lowercase letters, digits, '-' and '_' (devicon "dot-net", simple-icons "_1password"). */
export const STACK_ICON_KEY = /^[a-z0-9_][a-z0-9_-]{0,80}$/;

type CatalogEntry = {
  provider: StackCatalogProvider;
  key: string;
  title: string;
  /** Normalised title, key and alternative names, for search. */
  terms: string[];
  file: string;
  /** Simple Icons are single-colour paths: filled with the brand colour when served. */
  fill?: string;
};

/** Devicon names one icon several ways; the plain logo first, wordmarks (logo + name) last. */
const DEVICON_VARIANTS = ["original", "plain", "line"];

/** "C++" → "cplusplus", ".NET" → "dotnet", "Node.js" → "nodedotjs": the Simple Icons slug rules, for matching. */
export function normalizeTerm(value: string) {
  return value
    .toLowerCase()
    .replace(/\+/g, "plus")
    .replace(/#/g, "sharp")
    .replace(/&/g, "and")
    .replace(/\./g, "dot")
    .replace(/[^a-z0-9]/g, "");
}

function packageDir(name: string) {
  const require = createRequire(import.meta.url);
  // devicon's "main" is its stylesheet and simple-icons' is index.js, both at the package root.
  return dirname(require.resolve(name));
}

/** Near-white brand colours would vanish on the site's light logo tiles; those get the site's ink. */
function readableFill(hex: string) {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const luminance = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return luminance > 0.8 ? "#213448" : `#${hex}`;
}

/** Devicon has only lowercase names; `titles` (Simple Icons' slug → title) supplies the usual spelling. */
function loadDevicon(titles: Map<string, string>): CatalogEntry[] {
  const root = packageDir("devicon");
  const list = JSON.parse(readFileSync(join(root, "devicon.json"), "utf8")) as {
    name: string;
    altnames?: string[];
    versions: { svg: string[] };
  }[];
  const entries: CatalogEntry[] = [];
  for (const icon of list) {
    if (!STACK_ICON_KEY.test(icon.name)) continue;
    const ranked = [
      ...DEVICON_VARIANTS.filter((v) => icon.versions.svg.includes(v)),
      ...icon.versions.svg.filter((v) => !DEVICON_VARIANTS.includes(v))
    ];
    // Only variants whose file is actually in the package.
    const variant = ranked.find((v) =>
      existsSync(join(root, "icons", icon.name, `${icon.name}-${v}.svg`))
    );
    if (!variant) continue;
    const title =
      DEVICON_TITLES[icon.name] ??
      [icon.name, ...(icon.altnames ?? [])]
        .map((n) => titles.get(normalizeTerm(n)))
        .find(Boolean) ??
      titleFromKey(icon.name);
    entries.push({
      provider: "devicon",
      key: icon.name,
      title,
      terms: [title, icon.name, ...(icon.altnames ?? [])].map(normalizeTerm),
      file: join(root, "icons", icon.name, `${icon.name}-${variant}.svg`)
    });
  }
  return entries;
}

function loadSimpleIcons(): CatalogEntry[] {
  const root = packageDir("simple-icons");
  const list = JSON.parse(readFileSync(join(root, "data", "simple-icons.json"), "utf8")) as {
    title: string;
    slug: string;
    hex: string;
    aliases?: { aka?: string[] };
  }[];
  return list
    .filter((icon) => STACK_ICON_KEY.test(icon.slug) && /^[0-9A-Fa-f]{6}$/.test(icon.hex))
    .map((icon) => ({
      provider: "simpleicons" as const,
      key: icon.slug,
      title: icon.title,
      terms: [icon.title, icon.slug, ...(icon.aliases?.aka ?? [])].map(normalizeTerm),
      file: join(root, "icons", `${icon.slug}.svg`),
      fill: readableFill(icon.hex)
    }))
    .filter((entry) => existsSync(entry.file));
}

/**
 * Devicon only has lowercase names; the usual spelling of the common ones. Others are shown from the
 * name ("spring" → "Spring").
 */
const DEVICON_TITLES: Record<string, string> = {
  aftereffects: "After Effects",
  cplusplus: "C++",
  csharp: "C#",
  css3: "CSS",
  html5: "HTML",
  javascript: "JavaScript",
  nodejs: "Node.js",
  nextjs: "Next.js",
  nuxtjs: "Nuxt",
  photoshop: "Photoshop",
  postgresql: "PostgreSQL",
  premierepro: "Premiere Pro",
  reactrouter: "React Router",
  typescript: "TypeScript",
  vitejs: "Vite",
  vuejs: "Vue.js",
  mysql: "MySQL",
  mongodb: "MongoDB",
  graphql: "GraphQL",
  github: "GitHub",
  gitlab: "GitLab",
  tailwindcss: "Tailwind CSS",
  threejs: "Three.js",
  "dot-net": ".NET"
};

function titleFromKey(key: string) {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

let cache: { entries: CatalogEntry[]; byId: Map<string, CatalogEntry> } | null = null;

function catalog() {
  if (!cache) {
    const simple = loadSimpleIcons();
    const titles = new Map(simple.map((e) => [e.key, e.title]));
    const entries = [...loadDevicon(titles), ...simple];
    cache = { entries, byId: new Map(entries.map((e) => [`${e.provider}/${e.key}`, e])) };
  }
  return cache;
}

export function iconUrl(provider: StackCatalogProvider, key: string) {
  return `${STACK_ICON_PREFIX}/${provider}/${key}.svg`;
}

/** True when the library has that icon: writes accept only keys that resolve to a real file. */
export function hasCatalogIcon(provider: StackCatalogProvider, key: string) {
  return catalog().byId.has(`${provider}/${key}`);
}

const toIcon = (entry: CatalogEntry): StackCatalogIcon => ({
  provider: entry.provider,
  key: entry.key,
  title: entry.title,
  url: iconUrl(entry.provider, entry.key)
});

/**
 * Icons matching a name, best first: exact name, then names starting with it, then names with a
 * word starting with it, then names containing it. Devicon (full-colour logos) before Simple Icons
 * on a tie, then shorter names.
 */
export function searchCatalog(query: string, limit = 12): StackCatalogIcon[] {
  const q = normalizeTerm(query);
  if (!q) return [];
  const words = query
    .toLowerCase()
    .split(/[\s._/-]+/)
    .map(normalizeTerm)
    .filter(Boolean);
  const scored: { entry: CatalogEntry; score: number }[] = [];
  for (const entry of catalog().entries) {
    let score = Infinity;
    for (const term of entry.terms) {
      if (term === q) score = Math.min(score, 0);
      else if (term.startsWith(q)) score = Math.min(score, 1);
      else if (term.includes(q)) score = Math.min(score, 3);
    }
    if (score > 2 && words.length > 1) {
      // "react router" also finds "reactrouter" through its words.
      if (entry.terms.some((term) => words.every((w) => term.includes(w))))
        score = Math.min(score, 2);
    }
    if (score < Infinity) scored.push({ entry, score });
  }
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      (a.entry.provider === b.entry.provider ? 0 : a.entry.provider === "devicon" ? -1 : 1) ||
      a.entry.title.length - b.entry.title.length ||
      a.entry.title.localeCompare(b.entry.title)
  );
  return scored.slice(0, limit).map(({ entry }) => toIcon(entry));
}

/** Markup a served icon must not contain; the libraries never do, so this is only a safety net. */
const UNSAFE_SVG =
  /<script|<foreignObject|<!ENTITY|\son[a-z]+\s*=|(?:xlink:)?href\s*=\s*["'](?!#)/i;

/** The icon's SVG, ready to serve, or null for an unknown icon. */
export async function readCatalogIcon(provider: string, key: string): Promise<Buffer | null> {
  if (provider !== "devicon" && provider !== "simpleicons") return null;
  if (!STACK_ICON_KEY.test(key)) return null;
  const entry = catalog().byId.get(`${provider}/${key}`);
  if (!entry) return null;
  let svg = await readFile(entry.file, "utf8").catch(() => null);
  if (!svg || UNSAFE_SVG.test(svg)) return null;
  if (entry.fill) svg = svg.replace(/^<svg\b/, `<svg fill="${entry.fill}"`);
  return Buffer.from(svg);
}
