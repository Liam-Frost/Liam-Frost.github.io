# Motion (Stage 26)

The public site's motion system. The admin app has none of it.

## Direction

Chosen by the user after an audit of the site and of a reference site (scroll-linked GSAP timelines with Lenis):

- One shared motion language: reveal distance, opacity, duration, stagger and reduced-motion rules come from tokens.
- Content is revealed once, when it scrolls into view, and then stays still and fully visible.
- The tech stack moves with the scroll like the reference site's: its categories and technologies appear one by one as the page scrolls down, disappear one by one when scrolling back up, and the section fades out as it leaves (behind a switch that can be turned off). It is the only section with an exit fade.
- No smooth-scrolling library. Projects, photos and the other sections keep the one-time reveal (phases 3–5), following the rules below.
- Existing CSS and IntersectionObserver for the reveal; a small script for the tech stack; no GSAP.

## Tokens

`:root` in `apps/web/src/styles/globals.css`. Only `transform` and `opacity` move.

| Token                        | Subtle | Standard | Expressive |
| ---------------------------- | ------ | -------- | ---------- |
| `--motion-distance-*`        | 6px    | 14px     | 28px       |
| `--motion-duration-*`        | 280ms  | 440ms    | 600ms      |
| `--motion-opacity-*` (start) | 0.2    | 0        | 0          |

- `--motion-ease` (the site's `--ease`), `--motion-stagger` (50ms between items revealed together), `--motion-stagger-max` (6 steps at most), `--motion-after-heading` (100ms: content after its heading).
- `--motion-scale`: distances are multiplied by it; 0.6 at 560px and below.
- Performance tiers 0–1 shorten reveals to 220ms.

The values are starting points, tuned in the browser.

## Reveal

`<Reveal>` (`components/Reveal.tsx`) with one shared observer (`lib/reveal.ts`):

- `intensity`: `subtle`, `standard` (default) or `expressive`.
- `after`: content that follows its heading; starts `--motion-after-heading` later.
- `stagger`: items of a grid; items revealed together follow each other in order on screen (top to bottom, then left to right), not in DOM order.
- `instant`: shown at once without motion, including what was still waiting (results of the visitor's own filtering).
- Revealed when the element's top passes a line 8% above the viewport's bottom (threshold 0, so an element of any height qualifies), or when it is already above the viewport (anchor jumps, restored scroll).
- After the reveal the element is at `opacity: 1` and `transform: none`. No transform or filter is left behind, so a reveal never becomes the containing block of fixed descendants (drawers, tooltips) or a stacking context.

Content is visible by default. It is hidden while waiting only when all of these hold: the page is on a screen (not print), motion is allowed, and the observer runs (`html.revealReady`, set before the first render and removed if the observer cannot be created). Printing, reduced motion (also when switched on while a page is open), a browser without IntersectionObserver or a failed setup all leave everything visible.

## Rules (phases 3–4)

Every public page follows the same rules:

| What                                                                                                                 | Reveal                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Section and page headings (title and subtitle; a project page's header)                                              | `intensity="subtle"`                                                                                               |
| Content after its heading (cards, the hero card, the contact card, the privacy text)                                 | `after`                                                                                                            |
| Items of a list or grid (projects, photos, the about cards, a project page's blocks, collection entries in progress) | `after stagger`                                                                                                    |
| Composite blocks: the featured collection wall, the recent entries with their filters, the listening bar             | one `after` reveal for the block; its tiles do not move on their own, so the wall's layout and hover are untouched |
| The tech stack                                                                                                       | its own scroll motion (below), or `after` when it is switched off                                                  |
| Results of the visitor's filtering, searching or sorting on the portfolio                                            | `instant`                                                                                                          |
| The collection page's lists and filters, the footer, the header, the music dock                                      | no reveal                                                                                                          |

The hero's text keeps the standard reveal on arrival; the 404 page reveals as one block.

## Tech stack scroll motion

Modelled on the reference site's GSAP ScrollTrigger timeline (read from its code and measured in the browser): one progress for the whole stack, not one per item. `components/useStackScrub.ts`.

- **Entrance**: the progress runs from the stack's top at 80% of the viewport to its bottom at 80%. Category headings and technologies take turns in document order (heading, then its technologies from left to right, then the next category): each rises from 40px below and fades in over 0.5 of the timeline, the next starting 0.4 later. One or two move at a time; scrolling back up hides them one by one, last first.
- **Exit**: while the section's bottom goes from 50% to 10% of the viewport, the whole section (heading included) rises 150px and fades out; it comes back when scrolling up.
- **Catch-up**: both follow the scroll like GSAP's `scrub`: whenever the scroll moves, the motion eases (out) from where it is to where the scroll says it should be, in 0.5s for the entrance and 1s for the exit.
- Measured against the reference (Playwright, every 20px of scroll): at most two items moving at once, in document order; 40px of scroll per item and 36px between items at 1280–1440px wide (reference 37 and 32), 51–58px and 48–50px on phones (reference 63 and 57); exit from the section's bottom at about 45% to 10% of the viewport, rising 150px.
- Opacity and transform are written on the elements and removed once an element is fully shown (and from the section when it is back), so nothing is left behind. It runs only while scrolling or when the page above changes height (the hero title re-wraps), and starts where the page is (reload, anchor jump) without catching up.
- Reduced motion (also switched on while the page is open), print (`globals.css`) and a failed script show the stack as it is. Unlike the CSS scroll timelines used before, it works in every browser.
- Off switch: `STACK_SCROLL_MOTION` in `apps/web/src/lib/motion.ts` (false: the stack goes back to the one-time reveal). For one visit, `?stackMotion=off` or `?stackMotion=on` before the `#` (e.g. `/?stackMotion=off#/`) overrides it, to compare.
- Earlier versions (each item on its own CSS view timeline, values chosen as variant B) moved up to eleven items at once, so the stack appeared as one block; the user asked for the reference's one-by-one motion and its exit.

## Hero title

The typing greeting changes its number of lines and pushes the content below it on purpose; this is a feature, not a layout shift to remove. The motion work does not touch it.

## Page width

The page column (`.site`) is `minmax(0, 1fr)`: the page is as wide as the viewport, never as wide as its content's minimum width. With an auto column, the listening bar's untruncated song title made the minimum 323px at 320px in English, and phones zoomed the whole page out (the Stage 25 tech stack tests at 320px failed on it; first blamed on the music dock, which was not the cause).

## Checks

`tests/motion.spec.ts` in the Playwright folder (`D:\Tools\Playwright`, phase 5), at eight sizes: every page's revealed blocks settle fully visible with no transform or filter left and no sideways scroll (home, projects, a project, portfolio, collection, privacy); reduced motion and print show everything; the tech stack appears one by one in document order (at most two moving), goes back on the way up, fades out as it leaves and comes back, and `?stackMotion=off` brings the one-time reveal back; an anchor jump and going back never meet content still waiting; portfolio filter results appear at once; the photo viewer and collection details open on screen. `tests/tech-stack.spec.ts` covers the stack's layout and details panel.

Also one-off Playwright scripts (Stage 26 log) against production builds served by `vite preview`, with a temporary database: CLS (largest session window), leftover transforms and filters after reveal, hidden content after scrolling, reduced motion (also switched on live), print, no IntersectionObserver, anchor jumps, stagger order, the technology details panel, the photo viewer, the collection drawer, theme switching, tooltips and the music dock.
