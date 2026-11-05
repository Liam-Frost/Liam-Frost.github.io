export const SEGMENTS = 18;
export const clamp = (n: number, low = 0, high = 1) => Math.max(low, Math.min(high, n));
export function gaussian(distance: number, sigma = 1.7) {
  return Math.exp(-(distance * distance) / (2 * sigma * sigma));
}
export function syntheticEnergy(time: number, index: number) {
  return clamp(
    0.34 + 0.16 * Math.sin(time * 2.1 + index * 0.35) + 0.1 * Math.sin(time * 3.7 - index * 0.21)
  );
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
