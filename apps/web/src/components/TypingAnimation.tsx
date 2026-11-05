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
  const [displayText, setDisplayText] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const [phase, setPhase] = useState<"typing" | "pausing" | "deleting">("typing");

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentWord = words[wordIndex] || "";

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Main animation loop
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

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

  // The cursor follows the text with a transform, measured from an empty marker at the text's end.
  // Moving it in the layout (as an inline element after the text) would count as a layout shift
  // for every character typed; a transform and a zero-size marker do not.
  const lineRef = useRef<HTMLSpanElement | null>(null);
  const endRef = useRef<HTMLSpanElement | null>(null);
  const cursorRef = useRef<HTMLSpanElement | null>(null);
  useLayoutEffect(() => {
    const line = lineRef.current;
    const end = endRef.current;
    const placed = cursorRef.current;
    if (!line || !end || !placed) return;
    const place = () => {
      const from = line.getBoundingClientRect();
      const to = end.getBoundingClientRect();
      placed.style.transform = `translate(${to.left - from.left}px, ${to.top - from.top}px)`;
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(line);
    return () => observer.disconnect();
  }, [displayText, showCursor]);

  // Render text with line breaks (\n -> <br />)
  const renderText = (text: string) => {
    const parts = text.split("\n");
    return parts.map((part, i) => (
      <span key={i}>
        {part}
        {i < parts.length - 1 && <br />}
      </span>
    ));
  };

  const cursor = (blink: boolean) =>
    showCursor ? (
      <span className={cn("typingCursor", blink && "typingCursorBlink")} aria-hidden="true">
        {cursorChar}
      </span>
    ) : null;

  // Every word is laid out, invisible, in the same grid cell as the typed text, so the cell is as
  // tall as the longest word wraps to: the text below never moves while words are typed and deleted.
  return (
    <span className={cn("typingAnimation", className)}>
      {words.map((word, i) => (
        <span key={i} className="typingSizer" aria-hidden="true">
          {renderText(word)}
          {cursor(false)}
        </span>
      ))}
      <span className="typingLine" ref={lineRef}>
        <span className="typingText">{renderText(displayText)}</span>
        <span className="typingEnd" ref={endRef} />
        {showCursor && (
          <span
            ref={cursorRef}
            className={cn("typingCursor", "typingCursorPlaced", blinkCursor && "typingCursorBlink")}
            aria-hidden="true"
          >
            {cursorChar}
          </span>
        )}
      </span>
    </span>
  );
}
