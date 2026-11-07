import { useQuality } from "../perf/useQuality";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

type CursorStyle = "line" | "block" | "underscore";

type Props = {
  /** Array of strings to type and delete in sequence */
  words: string[];
  /** Speed of typing animation (ms per character) */
  typeSpeed?: number;
  /** Speed of deleting animation (ms per character) */
  deleteSpeed?: number;
  /** Pause duration between words (in ms) */
  pauseDelay?: number;
  /** Whether to loop the animation */
  loop?: boolean;
  /** Whether to show the typing cursor */
  showCursor?: boolean;
  /** Whether the cursor should blink */
  blinkCursor?: boolean;
  /** Style of the cursor */
  cursorStyle?: CursorStyle;
  /** Additional class name */
  className?: string;
};

const CURSOR_CHARS: Record<CursorStyle, string> = {
  line: "|",
  block: "\u258C", // ▌
  underscore: "_"
};

export default function TypingAnimation({
  words,
  typeSpeed = 80,
  deleteSpeed = 40,
  pauseDelay = 2000,
  loop = true,
  showCursor = true,
  blinkCursor = true,
  cursorStyle = "underscore",
  className
}: Props) {
  const { config } = useQuality();
  const animate = config.enableDecorativeAnimations;
  const [displayText, setDisplayText] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const [phase, setPhase] = useState<"typing" | "pausing" | "deleting">("typing");

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentWord = words[wordIndex] || "";
  const shownWord = animate ? currentWord : (words[0] ?? "");
  const japanese = shownWord.includes("\n");
  const wrapper = useRef<HTMLSpanElement>(null);
  const [fitSize, setFitSize] = useState<number | undefined>();
  useLayoutEffect(() => {
    const el = wrapper.current;
    const parent = el?.closest("h1");
    if (!japanese || !el || !parent) {
      setFitSize(undefined);
      return;
    }
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const css = getComputedStyle(parent);
      const size = parseFloat(css.fontSize);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return;
      context.font = `${css.fontWeight} ${size}px ${css.fontFamily}`;
      const spacing = parseFloat(css.letterSpacing) || 0;
      const widest =
        Math.max(
          ...shownWord
            .split("\n")
            .map(
              (line) => context.measureText(line + "_").width + Math.max(0, line.length * spacing)
            )
        ) + 6;
      setFitSize(Math.min(size, (size * parent.clientWidth) / widest));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    measure();
    void document.fonts.ready.then(measure);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [japanese, shownWord]);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Main animation loop
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (!animate) return;

    if (phase === "typing") {
      if (displayText.length < currentWord.length) {
        // Continue typing
        timeoutRef.current = setTimeout(() => {
          setDisplayText(currentWord.slice(0, displayText.length + 1));
        }, typeSpeed);
      } else {
        // Finished typing, start pause
        setPhase("pausing");
      }
    } else if (phase === "pausing") {
      // Pause before deleting
      timeoutRef.current = setTimeout(() => {
        setPhase("deleting");
      }, pauseDelay);
    } else if (phase === "deleting") {
      if (displayText.length > 0) {
        // Continue deleting
        timeoutRef.current = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1));
        }, deleteSpeed);
      } else {
        // Finished deleting, move to next word
        const nextIndex = (wordIndex + 1) % words.length;
        if (!loop && nextIndex === 0) {
          // Stop if not looping
          return;
        }
        setWordIndex(nextIndex);
        setPhase("typing");
      }
    }
  }, [
    animate,
    displayText,
    phase,
    currentWord,
    typeSpeed,
    deleteSpeed,
    pauseDelay,
    wordIndex,
    words.length,
    loop
  ]);

  const cursorChar = CURSOR_CHARS[cursorStyle];

  const cursor =
    showCursor && animate ? (
      <span className={cn("typingCursor", blinkCursor && "typingCursorBlink")} aria-hidden="true">
        {cursorChar}
      </span>
    ) : null;
  const text = animate ? displayText : (words[0] ?? "");
  const parts = text.split("\n");

  return (
    <span
      ref={wrapper}
      className={cn("typingAnimation", japanese && "typingJapanese", className)}
      style={japanese && fitSize ? { fontSize: fitSize } : undefined}
    >
      <span className="srOnly">{words[0]}</span>
      <span className="typingText" aria-hidden="true">
        {parts.map((part, i) => (
          <span key={i} className={japanese ? "typingJapaneseLine" : undefined}>
            {i > 0 && <br />}
            {part.slice(0, -1)}
            <span className={japanese ? "typingTail" : undefined}>
              {part.slice(-1)}
              {i === parts.length - 1 && cursor}
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}
