# Motion (Stage 26)

The public site's motion system. The admin app has none of it.

## Direction

Chosen by the user after an audit of the site and of a reference site (scroll-linked GSAP timelines with Lenis):

- One shared motion language: reveal distance, opacity, duration, stagger and reduced-motion rules come from tokens.
- Content is revealed once, when it scrolls into view, and then stays still and fully visible.
- The tech stack moves with the scroll like the reference site's: its categories and technologies appear one by one as the page scrolls down, disappear one by one when scrolling back up, and the section fades out as it leaves (behind a switch that can be turned off). It is the only section with an exit fade.
- Smooth scrolling for the whole site with Lenis, as on the reference site (added at the user's request after a recorded comparison). Projects, photos and the other sections keep the one-time reveal (phases 3–5), following the rules below.
- Existing CSS and IntersectionObserver for the reveal; GSAP ScrollTrigger for the tech stack only (the user chose it over a hand-written version that did not feel the same), loaded only when the stack mounts.

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
| Composite blocks: the featured collection wall, the recent entries with their filters                                | one `after` reveal for the block; its tiles do not move on their own, so the wall's layout and hover are untouched |
| The tech stack                                                                                                       | its own scroll motion (below), or `after` when it is switched off                                                  |
| Results of the visitor's filtering, searching or sorting on the portfolio                                            | `instant`                                                                                                          |
| The collection page's lists and filters, the footer, the header, the music dock                                      | no reveal                                                                                                          |

The hero's text keeps the standard reveal on arrival; the 404 page reveals as one block.

## Tech stack scroll motion

Ported from the reference site's own code (github.com/Tajmirul/portfolio-2.0, `app/_components/Skills.tsx`, MIT) to `components/useStackScrub.ts`, with GSAP ScrollTrigger (`gsap` 3.15, the standard no-charge license).

- **Entrance**: one ScrollTrigger timeline for the whole section, from its top at 80% of the viewport to its bottom at 100%, `scrub: 0.5`; `.from(items, { opacity: 0, y: 40, ease: "none", stagger: 0.4 })` over the category headings and technologies in document order. They appear one by one (at most two moving) and go back one by one when scrolling up.
- **Exit**: a second timeline from the section's bottom at 50% to 10% of the viewport, `scrub: 1`, `.to(section, { y: -150, opacity: 0 })`.
- **Our additions**: GSAP and ScrollTrigger are separate chunks (about 45 KB gzipped) loaded when the stack mounts; reduced motion turns the motion off (`gsap.matchMedia`, also live); print shows everything (`globals.css`); finished elements get their inline transform and opacity removed (GSAP leaves `translate(0px, 0px)` and puts it back on every recalculation, so it is swept after each update and refresh); ScrollTrigger recalculates when the page above changes height (the hero title re-wraps, the collection loads). If GSAP fails to load, the stack stays as it is.
- **Smooth scrolling**: the reference also runs Lenis on the whole page; so do we now (see below). With native scrolling a wheel notch jumped and the scrubbed motion moved in steps.
- Off switch: `STACK_SCROLL_MOTION` in `apps/web/src/lib/motion.ts` (false: the stack goes back to the one-time reveal). For one visit, `?stackMotion=off` or `?stackMotion=on` before the `#` (e.g. `/?stackMotion=off#/`) overrides it, to compare.
- History: a CSS view timeline per item (up to eleven moving at once), then a hand-written single-progress version modelled on the reference; the user found neither close enough and chose GSAP.

## Smooth scrolling

Lenis 1.3 for the whole public site (`lib/smoothScroll.ts`, started in `App`), with the reference's `lerp: 0.1`: a wheel notch glides for about 600ms (measured after one notch: 45 → 70 → 83 → 91 → 95 → 97px; the reference 39 → 63 → 77 → 86 → 92 → 95px) instead of jumping.

- Touch scrolling stays native (Lenis' default); reduced motion turns Lenis off (`respectReducedMotion`, its default); `html.lenis` sets `scroll-behavior: auto` so the browser does not animate each of Lenis' steps again.
- Everything that scrolls the page goes through `scrollToTop` / `scrollToElement` (route changes, anchors, back to top), which fall back to native scrolling without Lenis. Anchors are measured from layout (`offsetTop`), not `getBoundingClientRect`, so a section moved by an animation (the tech stack's exit) does not move its anchor; Lenis re-measures the page first (it does so on a delay, and an anchor near the end was clamped to an old page height).
- Dialogs and drawers stop Lenis while open (`useScrollLock`, counted); drawers, lists and horizontal rows keep scrolling on their own (`allowNestedScroll`). Lenis disables iframes (the Spotify dock) only while a smooth scroll is running.
- Anchors opened directly (e.g. the admin's preview links) are followed while the content above them loads, for up to 5s or until the visitor scrolls: before, a fresh load of `/#/#contact` stopped thousands of pixels short as the projects and collection arrived (with or without Lenis).
- The reveal observer's area reaches far above the viewport: a long smooth scroll can carry a block from below the viewport to above it between two frames, which a viewport-sized area never reports, so the block stayed hidden.

## Hero title

The typing greeting changes its number of lines and pushes the content below it on purpose; this is a feature, not a layout shift to remove. The motion work does not touch it.

## Page width

The page column (`.site`) is `minmax(0, 1fr)`: the page is as wide as the viewport, never as wide as its content's minimum width. With an auto column, the listening bar's untruncated song title made the minimum 323px at 320px in English, and phones zoomed the whole page out (the Stage 25 tech stack tests at 320px failed on it; first blamed on the music dock, which was not the cause).

## Checks

`tests/motion.spec.ts` in the Playwright folder (`D:\Tools\Playwright`, phase 5), at eight sizes: every page's revealed blocks settle fully visible with no transform or filter left and no sideways scroll (home, projects, a project, portfolio, collection, privacy); reduced motion and print show everything; the tech stack appears one by one in document order (at most two moving), goes back on the way up, fades out as it leaves and comes back, and `?stackMotion=off` brings the one-time reveal back; an anchor jump and going back never meet content still waiting; anchors opened directly land below the header, a wheel notch glides (desktop), and an open photo viewer holds the page; portfolio filter results appear at once; the photo viewer and collection details open on screen. `tests/tech-stack.spec.ts` covers the stack's layout and details panel.

Also one-off Playwright scripts (Stage 26 log) against production builds served by `vite preview`, with a temporary database: CLS (largest session window), leftover transforms and filters after reveal, hidden content after scrolling, reduced motion (also switched on live), print, no IntersectionObserver, anchor jumps, stagger order, the technology details panel, the photo viewer, the collection drawer, theme switching, tooltips and the music dock.
