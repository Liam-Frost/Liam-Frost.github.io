import { Slider as GlassSlider } from "../../../../web/src/vendor/cupertinocn/slider";

/** One value on a track. `label` names it for screen readers; the visible label is the Field's. */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <GlassSlider
      className="glassScope"
      aria-label={label}
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(next) => {
        const number = Array.isArray(next) ? next[0]! : next;
        onChange(Number(number.toFixed(2)));
      }}
    />
  );
}
