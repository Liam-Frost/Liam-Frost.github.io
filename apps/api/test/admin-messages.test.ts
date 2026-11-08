import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { en } from "../../admin/src/lib/messages.en";

const ROOT = fileURLToPath(new URL("../../admin/src", import.meta.url));

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !/messages(\.en)?\.ts$/.test(entry.name) ? [path] : [];
  });
}

const keys = new Set(
  sources(ROOT).flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(/\btr\(\s*("(?:[^"\\]|\\.)*")/g)].map(
      (match) => JSON.parse(match[1]!) as string
    )
  )
);
const placeholders = (text: string) => [...new Set(text.match(/\{\d+\}/g) ?? [])].sort();

describe("admin messages", () => {
  it("has an English translation for every message in the admin", () => {
    expect([...keys].filter((key) => !(key in en))).toEqual([]);
  });

  it("keeps the same placeholders in every translation", () => {
    const wrong = Object.entries(en).filter(
      ([key, value]) => placeholders(key).join() !== placeholders(value).join()
    );
    expect(wrong).toEqual([]);
  });

  it("has no Chinese left in the English text", () => {
    // Native spellings given as examples are the only exception.
    const left = Object.entries(en).filter(
      ([, value]) => /[一-鿿]/.test(value) && !value.includes("宮崎駿")
    );
    expect(left).toEqual([]);
  });
});
