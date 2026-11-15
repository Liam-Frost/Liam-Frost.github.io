import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SITE_PALETTES, SITE_PALETTE_COLORS, type SitePaletteColors } from "@liam-frost/shared";

const styles = new URL("../../web/src/styles/", import.meta.url);
const channels = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ");
const VARIABLES: Record<keyof SitePaletteColors, string> = {
  ink: "--navy-rgb",
  accent: "--blue-rgb",
  soft: "--mist-rgb",
  paper: "--sand-rgb",
  ink2: "--ink2-rgb",
  paper2: "--paper2-rgb"
};

/** The first rule of a selector, as written. */
function rule(css: string, selector: string) {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("}", start));
}

describe("site palettes", () => {
  const globals = readFileSync(new URL("globals.css", styles), "utf8");
  const themes = readFileSync(new URL("themes.css", styles), "utf8");
  it.each(SITE_PALETTES)("%s has the colours of the shared definition", (palette) => {
    const block =
      palette === "mist" ? rule(globals, ":root") : rule(themes, `html[data-palette="${palette}"]`);
    for (const [name, variable] of Object.entries(VARIABLES))
      expect(block).toContain(
        `${variable}: ${channels(SITE_PALETTE_COLORS[palette][name as keyof SitePaletteColors])};`
      );
  });
  it("has no rule for a palette that is not defined", () => {
    const named = [...themes.matchAll(/data-palette="([a-z]+)"/g)].map((match) => match[1]);
    expect(new Set(named)).toEqual(new Set(SITE_PALETTES.filter((palette) => palette !== "mist")));
  });
});
