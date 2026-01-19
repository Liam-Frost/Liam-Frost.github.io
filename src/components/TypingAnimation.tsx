import { useEffect, useRef, useState } from "react";
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
  }, [displayText, phase, currentWord, typeSpeed, deleteSpeed, pauseDelay, wordIndex, words.length, loop]);

  const cursorChar = CURSOR_CHARS[cursorStyle];

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

  return (
    <span className={cn("typingAnimation", className)}>
      <span className="typingText">{renderText(displayText)}</span>
      {showCursor && (
        <span
          className={cn("typingCursor", blinkCursor && "typingCursorBlink")}
          aria-hidden="true"
        >
          {cursorChar}
        </span>
      )}
    </span>
  );
}
