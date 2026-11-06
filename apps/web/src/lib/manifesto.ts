import type { ManifestoRotation, PublicAbout } from "@liam-frost/shared";

type Manifesto = PublicAbout["manifestos"][number];

const TIME_ZONE = "America/Vancouver";
const LAST_KEY = "manifesto:last";
const SESSION_KEY = "manifesto:session";

function read(storage: () => Storage, key: string) {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function write(storage: () => Storage, key: string, value: string) {
  try {
    storage().setItem(key, value);
  } catch {
    // Private windows or blocked storage: the choice just is not remembered.
  }
}

/** Days since 1970-01-01 in the site's time zone, so a day starts at the same moment for everyone. */
export function dayNumber(now: Date) {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE })
    .format(now)
    .split("-")
    .map(Number);
  return Math.floor(Date.UTC(y!, m! - 1, d!) / 86_400_000);
}

function randomOther(items: Manifesto[], avoid: string | null) {
  const pool = items.length > 1 ? items.filter((item) => item.id !== avoid) : items;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/**
 * The manifesto to show now (see ManifestoRotation). Call it once per visit to the page: in `visit`
 * mode each call draws another one.
 */
export function pickManifesto(
  items: Manifesto[],
  rotation: ManifestoRotation,
  now = new Date()
): Manifesto | undefined {
  if (!items.length) return undefined;
  switch (rotation.mode) {
    case "daily":
      return items[dayNumber(now) % items.length];
    case "visit": {
      const next = randomOther(
        items,
        read(() => localStorage, LAST_KEY)
      );
      write(() => localStorage, LAST_KEY, next.id);
      return next;
    }
    case "session": {
      const kept = items.find((item) => item.id === read(() => sessionStorage, SESSION_KEY));
      if (kept) return kept;
      const next = randomOther(
        items,
        read(() => localStorage, LAST_KEY)
      );
      write(() => sessionStorage, SESSION_KEY, next.id);
      write(() => localStorage, LAST_KEY, next.id);
      return next;
    }
    default:
      return items.find((item) => item.id === rotation.fixedId) ?? items[0];
  }
}

export type ManifestoRun = { text: string; em: boolean };

/** Intl.Segmenter, where the browser has it (the site's TypeScript lib predates it). */
type WordSegmenter = new (
  locale: string,
  options: { granularity: "word" }
) => { segment(text: string): Iterable<{ segment: string; isWordLike?: boolean }> };
const Segmenter = (Intl as unknown as { Segmenter?: WordSegmenter }).Segmenter;

/**
 * The manifesto as words of emphasised and plain runs, for line breaking. Chinese and Japanese are
 * split into words (punctuation stays with the word before it), so a line never breaks inside a
 * word or starts with punctuation; other scripts are one word per run, broken at spaces as usual.
 */
export function manifestoWords(
  parts: ManifestoRun[],
  cjk: boolean,
  locale: string,
  segmenter: WordSegmenter | null = Segmenter ?? null
): ManifestoRun[][] {
  if (!cjk) return parts.map((part) => [part]);
  const flags: boolean[] = [];
  for (const part of parts) for (const _ of part.text) flags.push(part.em);
  const plain = parts.map((p) => p.text).join("");
  const words: string[] = [];
  // Without Intl.Segmenter (older browsers) every character is a word: lines may then break
  // anywhere, as plain CJK text does, but still never before punctuation.
  const segments = segmenter
    ? new segmenter(locale, { granularity: "word" }).segment(plain)
    : [...plain].map((char) => ({ segment: char, isWordLike: !/[\p{P}\s]/u.test(char) }));
  for (const { segment, isWordLike } of segments) {
    if (!isWordLike && words.length && !/^\s+$/.test(segment)) words[words.length - 1] += segment;
    else words.push(segment);
  }
  let index = 0;
  return words.map((word) => {
    const runs: ManifestoRun[] = [];
    for (const char of word) {
      const em = flags[index++] ?? false;
      const last = runs[runs.length - 1];
      if (last && last.em === em) last.text += char;
      else runs.push({ text: char, em });
    }
    return runs;
  });
}

const CLAUSE_END = /[，。；：！？,.;:!?]$/;

/**
 * Words grouped into clauses (each ends with a comma, full stop or the like). Shown as inline
 * blocks, a clause moves to the next line whole when it fits there, so lines follow the sense of
 * the sentence; a clause longer than the line still wraps between its words.
 */
export function manifestoClauses(words: ManifestoRun[][]): ManifestoRun[][][] {
  const clauses: ManifestoRun[][][] = [[]];
  for (const word of words) {
    clauses[clauses.length - 1]!.push(word);
    if (CLAUSE_END.test(word.map((run) => run.text).join(""))) clauses.push([]);
  }
  return clauses.filter((clause) => clause.length > 0);
}
