import {
  SITE_PALETTES,
  SITE_PALETTE_COLORS,
  type SitePalette,
  type SitePaletteColors
} from "@liam-frost/shared";
import { tr } from "../../lib/messages";

const labels: Record<SitePalette, string> = {
  mist: tr("雾蓝"),
  pine: tr("墨绿"),
  mono: tr("黑白"),
  midnight: tr("午夜"),
  graphite: tr("石墨")
};

/** One mode of a colour scheme in miniature: background, a line of text, an accent. */
function Swatch({ colors, dark }: { colors: SitePaletteColors; dark: boolean }) {
  const background = dark ? colors.ink : colors.paper;
  const text = dark ? colors.paper : colors.ink;
  const accent = dark ? colors.soft : colors.accent;
  return (
    <span
      className="flex h-14 flex-1 flex-col justify-end gap-1 p-2"
      style={{ background }}
      aria-hidden="true"
    >
      <span className="h-1.5 w-3/4 rounded-full" style={{ background: text, opacity: 0.9 }} />
      <span className="h-1.5 w-1/2 rounded-full" style={{ background: text, opacity: 0.45 }} />
      <span className="h-2 w-6 rounded-full" style={{ background: accent }} />
    </span>
  );
}

/** The public site's colour scheme: one card per preset, showing its light and dark forms. */
export function PalettePicker({
  value,
  onChange
}: {
  value: SitePalette;
  onChange: (value: SitePalette) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={tr("配色方案")}
      className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3"
    >
      {SITE_PALETTES.map((palette) => {
        const colors = SITE_PALETTE_COLORS[palette];
        const selected = palette === value;
        return (
          <label
            key={palette}
            className={
              "block cursor-pointer overflow-hidden rounded-lg border bg-white text-[13px] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-500 " +
              (selected ? "border-sky-600 ring-1 ring-sky-600" : "border-slate-200")
            }
          >
            <input
              type="radio"
              name="site-palette"
              className="sr-only"
              checked={selected}
              onChange={() => onChange(palette)}
            />
            <span className="flex">
              <Swatch colors={colors} dark={false} />
              <Swatch colors={colors} dark />
            </span>
            <span className="flex items-center justify-between px-2.5 py-2 font-medium">
              {labels[palette]}
              {selected ? <span className="text-xs text-sky-700">{tr("使用中")}</span> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}
