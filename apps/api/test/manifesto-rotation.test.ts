import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { splitEmphasis } from "@liam-frost/shared";

import { dayNumber, manifestoWords, pickManifesto } from "../../web/src/lib/manifesto";

const items = ["a", "b", "c"].map((id) => ({ id, text: { en: id }, attribution: {} }));

/** A minimal Storage for the node test environment. */
function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, String(value))
  };
}

describe("pickManifesto", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("sessionStorage", memoryStorage());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("shows the fixed one, or the first when it is gone", () => {
    expect(pickManifesto(items, { mode: "fixed", fixedId: "b" })?.id).toBe("b");
    expect(pickManifesto(items, { mode: "fixed", fixedId: "x" })?.id).toBe("a");
    expect(pickManifesto([], { mode: "fixed", fixedId: null })).toBeUndefined();
  });

  it("changes once a day in Vancouver, the same for everyone", () => {
    const rotation = { mode: "daily", fixedId: null } as const;
    // Around midday in Vancouver (whatever its UTC offset): two hours later is the same day, a day
    // later the next one. 03:00 UTC is still the previous evening there.
    const noon = new Date("2026-12-02T20:00:00Z");
    const later = new Date("2026-12-02T22:00:00Z");
    const tomorrow = new Date("2026-12-03T20:00:00Z");
    const evening = new Date("2026-12-03T03:00:00Z");
    expect(dayNumber(later)).toBe(dayNumber(noon));
    expect(dayNumber(evening)).toBe(dayNumber(noon));
    expect(dayNumber(tomorrow) - dayNumber(noon)).toBe(1);
    expect(pickManifesto(items, rotation, later)?.id).toBe(
      pickManifesto(items, rotation, noon)?.id
    );
    expect(pickManifesto(items, rotation, tomorrow)?.id).not.toBe(
      pickManifesto(items, rotation, noon)?.id
    );
  });

  it("never shows the same one on two visits in a row", () => {
    const rotation = { mode: "visit", fixedId: null } as const;
    let previous = pickManifesto(items, rotation)!.id;
    for (let i = 0; i < 50; i++) {
      const next = pickManifesto(items, rotation)!.id;
      expect(next).not.toBe(previous);
      previous = next;
    }
    // A single manifesto is simply shown every time.
    expect(pickManifesto(items.slice(0, 1), rotation)?.id).toBe("a");
  });

  it("keeps one per session and picks another in the next", () => {
    const rotation = { mode: "session", fixedId: null } as const;
    const first = pickManifesto(items, rotation)!.id;
    for (let i = 0; i < 10; i++) expect(pickManifesto(items, rotation)!.id).toBe(first);
    vi.stubGlobal("sessionStorage", memoryStorage());
    expect(pickManifesto(items, rotation)!.id).not.toBe(first);
  });

  it("still picks one when storage is blocked", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      }
    };
    vi.stubGlobal("localStorage", blocked);
    vi.stubGlobal("sessionStorage", blocked);
    expect(pickManifesto(items, { mode: "session", fixedId: null })).toBeDefined();
    expect(pickManifesto(items, { mode: "visit", fixedId: null })).toBeDefined();
  });
});

describe("manifestoWords", () => {
  const words = (text: string, locale = "zh") =>
    manifestoWords(splitEmphasis(text), true, locale).map((runs) =>
      runs.map((r) => r.text).join("")
    );

  it("keeps punctuation with the word before it and the text unchanged", () => {
    for (const text of [
      "变则善，*常变则至善*。",
      "把复杂的事物，变成*清晰、可靠*，而且值得反复体验的东西。",
      "向上とは変化であり、完璧とは*頻繁に変化すること*だ。"
    ]) {
      const list = words(text, /[ぁ-ん]/.test(text) ? "ja" : "zh");
      expect(list.join("")).toBe(text.replaceAll("*", ""));
      for (const word of list.slice(1)) expect(word).not.toMatch(/^[，。、；：！？]/);
    }
  });

  it("keeps the emphasis on the right characters", () => {
    const runs = manifestoWords(splitEmphasis("变则善，*常变*。"), true, "zh").flat();
    expect(
      runs
        .filter((r) => r.em)
        .map((r) => r.text)
        .join("")
    ).toBe("常变");
  });

  it("still breaks CJK text, never before punctuation, without Intl.Segmenter", () => {
    const list = manifestoWords(
      splitEmphasis("向上とは変化であり、完璧とは*頻繁に変化すること*だ。"),
      true,
      "ja",
      null
    ).map((runs) => runs.map((r) => r.text).join(""));
    expect(list.length).toBeGreaterThan(20);
    expect(Math.max(...list.map((w) => [...w].length))).toBeLessThanOrEqual(2);
    expect(list).toContain("り、");
    expect(list.join("")).toBe("向上とは変化であり、完璧とは頻繁に変化することだ。");
  });

  it("leaves other scripts as they are", () => {
    expect(manifestoWords(splitEmphasis("To *change*"), false, "en")).toEqual([
      [{ text: "To ", em: false }],
      [{ text: "change", em: true }]
    ]);
  });
});
