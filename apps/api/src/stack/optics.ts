import type { StackIconTone } from "@liam-frost/shared";
import sharp from "sharp";

import { variantFileName } from "../photos/mapping";
import type { LocalImageStore } from "../storage/local";
import { readCatalogIcon } from "./catalog";
import type { StackTechnologyRow } from "./types";

/**
 * How to show a logo without a tile, measured from its pixels once per icon: a scale for its square
 * slot (optical size) and, for logos that would vanish in one theme, a tone (see StackIconTone).
 * The image itself is never cropped or recoloured here; the site applies both with CSS.
 */
export type IconOptics = { scale: number; tone: StackIconTone | null };

export const NEUTRAL_OPTICS: IconOptics = { scale: 1, tone: null };

/**
 * Hand adjustments for the few logos the measurement gets wrong, keyed "<provider>/<key>"
 * ("custom" logos are measured only). Keep this short: it is for exceptions.
 */
const OPTICS_OVERRIDES: Record<string, Partial<IconOptics>> = {};

const SIZE = 96;
/** Largest share of the slot a logo's drawn part may take after scaling. */
const MAX_EXTENT = 1.04;

/** Perceived lightness of an sRGB colour, 0 (black) to 1 (white), as the catalog measures fills. */
const lightness = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Measures a logo (SVG, PNG or WebP) drawn into a square:
 * - its drawn box (without transparent margins) and how much of that box is filled;
 * - scale = fill the slot with the drawn box, then shrink heavy shapes (a filled square) and grow
 *   light ones (thin outlines, wide marks) a little, so logos look about the same size;
 * - tone: one colour and dark → "dark", one colour and light → "light", several colours with large
 *   near-black parts → "contrast".
 */
export async function measureIcon(input: Buffer): Promise<IconOptics> {
  const { data } = await sharp(input, { density: 288 })
    .resize(SIZE, SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let ink = 0;
  let [minX, minY, maxX, maxY] = [SIZE, SIZE, -1, -1];
  let [sumR, sumG, sumB, dark] = [0, 0, 0, 0];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const alpha = data[i + 3]! / 255;
      if (alpha < 0.1) continue;
      const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
      ink += alpha;
      sumR += r * alpha;
      sumG += g * alpha;
      sumB += b * alpha;
      if (lightness(r, g, b) < 0.12) dark += alpha;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  if (!ink) return NEUTRAL_OPTICS;

  const mean = [sumR / ink, sumG / ink, sumB / ink] as const;
  // Single colour: the drawn pixels stay close to their average colour.
  let spread = 0;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]! / 255;
    if (alpha < 0.1) continue;
    spread +=
      alpha * Math.hypot(data[i]! - mean[0], data[i + 1]! - mean[1], data[i + 2]! - mean[2]);
  }
  const mono = spread / ink < 24;
  const light = lightness(...mean);
  const tone: StackIconTone | null = mono
    ? light < 0.3
      ? "dark"
      : light > 0.85
        ? "light"
        : null
    : dark / ink >= 0.25
      ? "contrast"
      : null;

  const boxW = (maxX - minX + 1) / SIZE;
  const boxH = (maxY - minY + 1) / SIZE;
  const extent = Math.max(boxW, boxH);
  const density = ink / ((maxX - minX + 1) * (maxY - minY + 1));
  const fit = 1 / extent;
  // After fitting, a full square has area 1; a wide or tall mark less, and looks smaller.
  const shape = (0.72 / (boxW * fit * (boxH * fit))) ** 0.25;
  const weight = (0.5 / Math.max(density, 0.05)) ** 0.15;
  const scale = Math.min(fit * shape * weight, MAX_EXTENT / extent);
  return { scale: round(Math.min(Math.max(scale, 0.7), 1.4)), tone };
}

const measured = new Map<string, Promise<IconOptics>>();

/** The optics of a technology's logo; measured once per icon (or uploaded file) and remembered. */
export function technologyOptics(
  row: Pick<StackTechnologyRow, "iconProvider" | "iconKey" | "customIcon">,
  store: LocalImageStore
): Promise<IconOptics> {
  let id: string;
  let load: () => Promise<Buffer | null>;
  if (row.iconProvider === "custom" && row.customIcon) {
    const icon = row.customIcon;
    const largest = icon.variants[icon.variants.length - 1];
    if (!largest) return Promise.resolve(NEUTRAL_OPTICS);
    id = `custom/${icon.key}`;
    load = () => store.readPublic(icon.key, variantFileName(largest.width));
  } else if (
    (row.iconProvider === "devicon" || row.iconProvider === "simpleicons") &&
    row.iconKey
  ) {
    const [provider, key] = [row.iconProvider, row.iconKey];
    id = `${provider}/${key}`;
    load = () => readCatalogIcon(provider, key);
  } else {
    return Promise.resolve(NEUTRAL_OPTICS);
  }
  let result = measured.get(id);
  if (!result) {
    result = load()
      .then((file) => (file ? measureIcon(file) : NEUTRAL_OPTICS))
      .catch(() => NEUTRAL_OPTICS)
      .then((optics) => ({ ...optics, ...OPTICS_OVERRIDES[id] }));
    measured.set(id, result);
  }
  return result;
}

/** Optics of every technology in a stack, by technology id. */
export async function stackOptics(
  technologies: Pick<StackTechnologyRow, "id" | "iconProvider" | "iconKey" | "customIcon">[],
  store: LocalImageStore
) {
  const entries = await Promise.all(
    technologies.map(async (t) => [t.id, await technologyOptics(t, store)] as const)
  );
  return new Map(entries);
}
