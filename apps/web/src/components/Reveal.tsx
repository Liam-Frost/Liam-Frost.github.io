import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

import { cx } from "../lib/cx";
import { observeReveal } from "../lib/reveal";

type Props = {
  children: ReactNode;
  className?: string;
  delayMs?: number;
};

export default function Reveal({ children, className, delayMs = 0 }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    return observeReveal(el, () => setVisible(true));
  }, []);

  return (
    <div
      ref={ref}
      className={cx("reveal", visible && "revealVisible", className)}
      style={{ "--reveal-delay": `${delayMs}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
