import type { ManifestoRotation, PublicAbout } from "@liam-frost/shared";

import { dayNumber } from "./rotation";

export { dayNumber } from "./rotation";

type Manifesto = PublicAbout["manifestos"][number];

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
  if (rotation.mode === "fixed")
    return items.find((item) => item.id === rotation.fixedId) ?? items[0];
  const eligible = items.filter((item) => (item.weight ?? 1) > 0);
  if (!eligible.length) return undefined;
  const signature = JSON.stringify(eligible.map((item) => [item.id, item.weight ?? 1]));
  const storageKey = "manifesto:weighted-session";
  if (rotation.mode === "session") {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      if (saved?.signature === signature) {
        const kept = eligible.find((m) => m.id === saved.id);
        if (kept) return kept;
      }
    } catch {
      /* unavailable storage */
    }
  }
  let unit = Math.random();
  if (rotation.mode === "daily") {
    let hash = 2166136261;
    for (const c of `manifesto:${dayNumber(now)}`)
      hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x7feb352d);
    hash ^= hash >>> 15;
    hash = Math.imul(hash, 0x846ca68b);
    hash ^= hash >>> 16;
    unit = (hash >>> 0) / 4294967296;
  }
  let remaining = unit * eligible.reduce((sum, m) => sum + (m.weight ?? 1), 0);
  const selected =
    eligible.find((m) => {
      remaining -= m.weight ?? 1;
      return remaining < 0;
    }) ?? eligible[eligible.length - 1]!;
  if (rotation.mode === "session") {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ signature, id: selected.id }));
    } catch {
      /* choice still works */
    }
  }
  return selected;
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
