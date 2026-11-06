export const SEGMENTS = 18;
export const clamp = (n: number, low = 0, high = 1) => Math.max(low, Math.min(high, n));
export function gaussian(distance: number, sigma = 1.7) {
  return Math.exp(-(distance * distance) / (2 * sigma * sigma));
}
/**
 * How far a line grows (in the 64-wide viewBox) at full simulated energy while music plays: clearly
 * visible, but less than the hover peak (35.2), so the rail still reads as navigation.
 */
export const PLAYING_AMPLITUDE = 24;

/**
 * A simulated, music-like signal for line `index` at `time` seconds (0–1): a ~112 bpm pulse shared by
 * all lines, plus faster waves whose phase differs per line, so the lines move like an equaliser
 * without moving in step.
 */
export function syntheticEnergy(time: number, index: number) {
  const pulse = Math.max(0, Math.sin(time * Math.PI * (112 / 60))) ** 2;
  const wave = Math.sin(time * 5.3 + index * 1.7) * Math.sin(time * 1.3 + index * 0.6);
  const flicker = Math.sin(time * 8.9 - index * 2.3 + Math.sin(time * 0.7 + index));
  return clamp(0.22 + 0.36 * pulse + 0.26 * wave + 0.16 * flicker);
}
export type SectionGeometry = {
  id: string;
  title: string;
  summary: string;
  top: number;
  bottom: number;
};
/** A position in the rail describes a position in the document, not a section index. */
export function sectionAt(sections: SectionGeometry[], documentY: number) {
  if (!sections.length) return -1;
  let index = 0;
  for (let i = 1; i < sections.length; i++) {
    if (documentY < sections[i]!.top) break;
    index = i;
  }
  return index;
}
