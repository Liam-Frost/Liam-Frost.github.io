import { tooltipPosition } from "@liam-frost/shared";
import { Info } from "lucide-react";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";
import { tr } from "../../lib/messages";

const SHOW_DELAY_MS = 150;

/**
 * A hint shown on hover or keyboard focus, in the admin's style, in place of the browser's `title`
 * tooltip. The hint is also the child's accessible description. Inside a modal dialog it renders into
 * the dialog, which is in the browser's top layer above everything else.
 */
export function Tooltip({
  content,
  children,
  describe = true,
  className = "inline-flex"
}: {
  content: ReactNode;
  children: ReactNode;
  /** Off when the hint repeats the child's label or visible text, so it is not announced twice. */
  describe?: boolean;
  /** Classes for the wrapper around the child. */
  className?: string;
}) {
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  // Where the popup renders while open: the body, or the open dialog the anchor is in.
  const [host, setHost] = useState<Element | null>(null);
  const open = host !== null;
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // No hint, no popup; the wrapper stays so the child is not remounted when a hint comes and goes.
  const empty = content === null || content === undefined || content === "";
  const show = () => {
    window.clearTimeout(timer.current);
    if (empty) return;
    timer.current = window.setTimeout(
      () => setHost(anchor.current?.closest("dialog[open]") ?? document.body),
      SHOW_DELAY_MS
    );
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setHost(null);
    setPosition(null);
  };

  useLayoutEffect(() => {
    if (!open || !anchor.current || !tip.current) return;
    const box = tip.current.getBoundingClientRect();
    setPosition(
      tooltipPosition(anchor.current.getBoundingClientRect(), box, {
        width: window.innerWidth,
        height: window.innerHeight
      })
    );
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <span
      ref={anchor}
      className={className}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {describe && !empty && isValidElement<{ "aria-describedby"?: string }>(children)
        ? cloneElement(children, { "aria-describedby": id })
        : children}
      {/* The description screen readers announce, always present; the popup itself is visual. */}
      {describe && !empty ? (
        <span id={id} hidden>
          {content}
        </span>
      ) : null}
      {host && !empty
        ? createPortal(
            <div
              ref={tip}
              aria-hidden="true"
              style={position ?? { top: 0, left: 0, visibility: "hidden" }}
              className="pointer-events-none fixed z-[70] max-w-[280px] rounded-lg bg-brand-dark px-2.5 py-1.5 text-[12px] leading-relaxed font-normal text-white shadow-card-hover"
            >
              {content}
            </div>,
            host
          )
        : null}
    </span>
  );
}

/** A small (i) button that explains the thing next to it, on hover or keyboard focus. */
export function InfoTip({ text, label = tr("说明") }: { text: string; label?: string }) {
  return (
    <Tooltip content={text}>
      <button
        type="button"
        aria-label={label}
        className="inline-flex rounded-full p-0.5 text-faint transition-colors hover:text-brand focus-visible:text-brand"
      >
        <Info aria-hidden="true" className="size-3.5" />
      </button>
    </Tooltip>
  );
}
