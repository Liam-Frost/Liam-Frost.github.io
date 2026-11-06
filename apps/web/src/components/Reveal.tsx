import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

import { cx } from "../lib/cx";
import { observeReveal } from "../lib/reveal";

/** How far and how long content moves in; see the motion tokens in globals.css and docs/motion.md. */
export type RevealIntensity = "subtle" | "standard" | "expressive";

type Props = {
  children: ReactNode;
  className?: string;
  /** Section headings use "subtle"; content the default "standard". */
  intensity?: RevealIntensity;
  /** Content that follows its heading: starts `--motion-after-heading` later. */
  after?: boolean;
  /** Items of a list or grid: those revealed together follow each other in order on screen. */
  stagger?: boolean;
  /** Shown at once, without motion: e.g. results of the visitor's own filtering. */
  instant?: boolean;
};

const INTENSITY_CLASS: Record<RevealIntensity, string | null> = {
  subtle: "revealSubtle",
  standard: null,
  expressive: "revealExpressive"
};

export default function Reveal({
  children,
  className,
  intensity = "standard",
  after = false,
  stagger = false,
  instant = false
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [order, setOrder] = useState<number | null>(null);
  // Instant also shows what was still waiting (e.g. photos further down when the results change).
  const visible = instant || order !== null;

  useEffect(() => {
    const el = ref.current;
    if (!el || instant) return;

    return observeReveal(el, setOrder, { stagger });
  }, [stagger, instant]);

  return (
    <div
      ref={ref}
      className={cx(
        "reveal",
        INTENSITY_CLASS[intensity],
        after && "revealAfter",
        visible && "revealVisible",
        instant && "revealInstant",
        className
      )}
      style={order && !instant ? ({ "--reveal-order": order } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
