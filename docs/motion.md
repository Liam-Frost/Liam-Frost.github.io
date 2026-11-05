# Motion (Stage 26)

The public site's motion system. The admin app has none of it.

## Direction

Chosen by the user after an audit of the site and of a reference site (scroll-linked GSAP timelines with Lenis):

- One shared motion language: reveal distance, opacity, duration, stagger and reduced-motion rules come from tokens.
- Content is revealed once, when it scrolls into view, and then stays still and fully visible.
- The tech stack is the pilot for a scroll-linked, staggered reveal that plays backwards when scrolling up (phase 2, behind a switch that can be turned off).
- No section exit fades and no smooth-scrolling library. Projects, photos and other sections do not scrub until the pilot has been judged.
- Existing CSS and IntersectionObserver first; CSS scroll-driven animations for the pilot; no GSAP for now.

## Tokens

`:root` in `apps/web/src/styles/globals.css`. Only `transform` and `opacity` move.

| Token                        | Subtle | Standard | Expressive |
| ---------------------------- | ------ | -------- | ---------- |
| `--motion-distance-*`        | 6px    | 14px     | 28px       |
| `--motion-duration-*`        | 280ms  | 440ms    | 600ms      |
| `--motion-opacity-*` (start) | 0.2    | 0        | 0          |

- `--motion-ease` (the site's `--ease`), `--motion-stagger` (50ms between items revealed together), `--motion-stagger-max` (6 steps at most).
- `--motion-scale`: distances are multiplied by it; 0.6 at 560px and below.
- Performance tiers 0–1 shorten reveals to 220ms.

The values are starting points, tuned in the browser.

## Reveal

`<Reveal>` (`components/Reveal.tsx`) with one shared observer (`lib/reveal.ts`):

- `intensity`: `subtle`, `standard` (default) or `expressive`.
- `delayMs`: a fixed offset, e.g. content after its heading.
- `stagger`: items of a grid; items revealed together follow each other in order on screen (top to bottom, then left to right), not in DOM order.
- Revealed when the element's top passes a line 8% above the viewport's bottom (threshold 0, so an element of any height qualifies), or when it is already above the viewport (anchor jumps, restored scroll).
- After the reveal the element is at `opacity: 1` and `transform: none`. No transform or filter is left behind, so a reveal never becomes the containing block of fixed descendants (drawers, tooltips) or a stacking context.

Content is visible by default. It is hidden while waiting only when all of these hold: the page is on a screen (not print), motion is allowed, and the observer runs (`html.revealReady`, set before the first render and removed if the observer cannot be created). Printing, reduced motion (also when switched on while a page is open), a browser without IntersectionObserver or a failed setup all leave everything visible.

## Tech stack pilot (phase 2)

Categories and technologies rise in as they pass into the viewport, and go back when scrolling up: the animation's progress is the scroll position (CSS `animation-timeline: view()`), not a timer.

- Each category heading and each technology has its own view timeline. A technology's rise takes the first `--motion-scroll-range` (20%) of its pass through the viewport (`cover`, from its top at the viewport's bottom); technologies on the same row start `--motion-scroll-stagger` (4%) apart from left to right. Their column is measured in `TechStack` (`--stack-col`, kept up to date when the layout changes).
- Headings rise by the standard distance, technologies by the expressive one (times `--motion-scale` on phones). Only `transform` and `opacity`; the animation fills backwards only, so once past its range an element has no animated value left (`transform: none`).
- No section exit fade and no smooth scrolling; the page scrolls natively.
- Off switch: `STACK_SCROLL_MOTION` in `apps/web/src/lib/motion.ts` (false: the stack goes back to the one-time reveal). For one visit, `?stackMotion=off` or `?stackMotion=on` before the `#` (e.g. `/?stackMotion=off#/`) overrides it, to compare.
- Fallback to the one-time reveal: browsers without scroll-driven animations (checked with `CSS.supports`). Reduced motion and print show the stack as it is.

## Hero title

The typing greeting changes its number of lines and pushes the content below it on purpose; this is a feature, not a layout shift to remove. The motion work does not touch it.

## Checks

Playwright (`D:\Tools\Playwright`, scripts in the Stage 26 log) against production builds served by `vite preview`, with a temporary database: CLS (largest session window), leftover transforms and filters after reveal, hidden content after scrolling, reduced motion (also switched on live), print, no IntersectionObserver, anchor jumps, stagger order, the technology details panel, the photo viewer, the collection drawer, theme switching, tooltips and the music dock.
