type PlaceholderOptions = {
  title: string;
  seed: string;
  width: number;
  height: number;
};

function hashStringToInt(input: string): number {
  // FNV-1a 32-bit
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function pickColors(seed: string) {
  const palette = [
    "#213448", // navy
    "#547792", // blue
    "#94B4C1", // mist
    "#EAE0CF", // sand
    "#182739", // deep navy
    "#3F5E82", // deep blue
    "#A8C7D2", // light mist
    "#F2EBDD" // warm sand
  ];

  const h = hashStringToInt(seed);
  const a = palette[h % palette.length];
  const b = palette[(h * 7 + 3) % palette.length];
  const c = palette[(h * 13 + 5) % palette.length];
  return { a, b, c };
}

export function photoPlaceholder({ title, seed, width, height }: PlaceholderOptions) {
  const { a, b, c } = pickColors(seed);
  const safeTitle = escapeXml(title);

  const viewW = 1200;
  const viewH = Math.round((height / width) * viewW);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${viewW} ${viewH}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${a}" stop-opacity="0.95"/>
      <stop offset="0.55" stop-color="${b}" stop-opacity="0.85"/>
      <stop offset="1" stop-color="${c}" stop-opacity="0.85"/>
    </linearGradient>
    <filter id="noise" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.25 0"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="${viewW}" height="${viewH}" fill="url(#g)"/>
  <rect x="0" y="0" width="${viewW}" height="${viewH}" filter="url(#noise)" opacity="0.22"/>

  <g opacity="0.32" stroke="rgba(255,255,255,0.75)" stroke-width="2">
    <rect x="90" y="90" width="${viewW - 180}" height="${viewH - 180}" rx="40" fill="none"/>
    <path d="M ${viewW / 2} 90 V ${viewH - 90}" />
    <path d="M 90 ${viewH / 2} H ${viewW - 90}" />
    <circle cx="${viewW / 2}" cy="${viewH / 2}" r="92" fill="none"/>
  </g>

  <g>
    <text x="90" y="${viewH - 120}" fill="rgba(255,255,255,0.92)" font-family="ui-sans-serif, system-ui" font-size="44" font-weight="800" letter-spacing="-0.02em">${safeTitle}</text>
    <text x="90" y="${viewH - 70}" fill="rgba(255,255,255,0.78)" font-family="ui-sans-serif, system-ui" font-size="22">Placeholder — replace with your photo</text>
  </g>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
