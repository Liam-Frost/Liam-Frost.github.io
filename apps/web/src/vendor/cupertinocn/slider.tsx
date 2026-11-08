import * as React from "react";
import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { useMotionValue, useMotionValueEvent, useReducedMotion, useSpring } from "motion/react";
import { cn } from "../../lib/cn";
import { GlassSurface } from "./liquid-glass";
import "./cupertino-slider.css";

type SliderProps = Omit<SliderPrimitive.Root.Props, "className"> & {
  className?: string;
  /** Accessible name for each thumb of a range slider. */
  getAriaLabel?: (index: number) => string;
};

function fraction(value: number, min: number, max: number) {
  if (max <= min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/** Velocity in px/s at which the lens reaches its maximum stretch. */
const STRETCH_VELOCITY = 1800;
const MAX_STRETCH = 0.28;

/** Stretches the thumb along its motion while dragging, then lets it spring back. */
function useThumbStretch(root: React.RefObject<HTMLDivElement | null>) {
  const reducedMotion = useReducedMotion();
  const pointer = useMotionValue(0);
  const target = useMotionValue(1);
  const stretch = useSpring(target, { stiffness: 260, damping: 17, mass: 1 });
  useMotionValueEvent(pointer, "change", () => {
    if (reducedMotion) return;
    target.set(1 + Math.min(Math.abs(pointer.getVelocity()) / STRETCH_VELOCITY, MAX_STRETCH));
  });
  useMotionValueEvent(stretch, "change", (value) => {
    root.current?.style.setProperty("--slider-stretch", value.toFixed(4));
    root.current?.style.setProperty("--slider-squash", (1 - (value - 1) * 0.4).toFixed(4));
  });
  return {
    onPointerMove(event: React.PointerEvent<HTMLElement>) {
      if (event.buttons & 1) pointer.set(event.clientX);
    },
    onPointerDown(event: React.PointerEvent<HTMLElement>) {
      pointer.jump(event.clientX);
    },
    rest() {
      target.set(1);
    }
  };
}

/**
 * The thumb refracts a copy of the track that stays aligned with the real one, so the lens shows
 * the fill boundary in every browser. `--slider-progress` places the copy; `--slider-fill-start`
 * and `--slider-fill-end` paint its fill.
 */
function Slider({
  className,
  value,
  defaultValue = [50],
  min = 0,
  max = 100,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  getAriaLabel,
  onValueCommitted,
  ...props
}: SliderProps) {
  const root = React.useRef<HTMLDivElement>(null);
  const motion = useThumbStretch(root);
  const values = value ?? defaultValue;
  const thumbs = Array.isArray(values) ? values : [values];
  return (
    <SliderPrimitive.Root
      ref={root}
      data-slot="slider"
      className={cn("cupertino cupertino-slider", className)}
      style={(state) =>
        ({
          "--slider-range": state.values.length > 1 ? 1 : 0,
          "--slider-fill-start":
            state.values.length > 1 ? fraction(state.values[0], state.min, state.max) : 0,
          "--slider-fill-end": fraction(state.values[state.values.length - 1], state.min, state.max)
        }) as React.CSSProperties
      }
      thumbAlignment="edge"
      min={min}
      max={max}
      value={value}
      defaultValue={defaultValue}
      onValueCommitted={(next, details) => {
        motion.rest();
        onValueCommitted?.(next, details);
      }}
      {...props}
    >
      <SliderPrimitive.Control
        className="cupertino-slider-control"
        onPointerDown={motion.onPointerDown}
        onPointerMove={motion.onPointerMove}
      >
        <SliderPrimitive.Track className="cupertino-slider-track">
          <SliderPrimitive.Indicator className="cupertino-slider-fill" />
        </SliderPrimitive.Track>
        {thumbs.map((_, index) => (
          <SliderPrimitive.Thumb
            key={index}
            index={index}
            aria-label={getAriaLabel?.(index) ?? label}
            aria-labelledby={labelledBy}
            className="cupertino-slider-thumb"
            style={(state) =>
              ({
                "--slider-progress": fraction(state.values[index] ?? 0, state.min, state.max)
              }) as React.CSSProperties
            }
          >
            <span className="cupertino-slider-handle">
              <GlassSurface
                variant="clear"
                strength={0.7}
                rim={0.9}
                chroma={false}
                interactive={false}
                refract={<span aria-hidden="true" className="cupertino-slider-copy" />}
              />
            </span>
          </SliderPrimitive.Thumb>
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
export type { SliderProps };
