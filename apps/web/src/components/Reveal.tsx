import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

import { cx } from "../lib/cx";
import { observeReveal } from "../lib/reveal";

/** How far and how long content moves in; see the motion tokens in globals.css. */
export type RevealIntensity = "subtle" | "standard" | "expressive";

type Props = {
  children: ReactNode;
  className?: string;
  /** A fixed offset, e.g. content after its heading. */
  delayMs?: number;
  /** Items of a list or grid: those revealed together follow each other in order on screen. */
  stagger?: boolean;
  intensity?: RevealIntensity;
};

const INTENSITY_CLASS: Record<RevealIntensity, string | null> = {
  subtle: "revealSubtle",
  standard: null,
  expressive: "revealExpressive"
};

export default function Reveal({
  children,
  className,
  delayMs = 0,
  stagger = false,
  intensity = "standard"
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [order, setOrder] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    return observeReveal(el, setOrder, { stagger });
  }, [stagger]);

  return (
    <div
      ref={ref}
      className={cx(
        "reveal",
        INTENSITY_CLASS[intensity],
        order !== null && "revealVisible",
        className
      )}
      style={
        {
          "--reveal-offset": `${delayMs}ms`,
          ...(order ? { "--reveal-order": order } : {})
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
