# Public site refresh, quality and accessibility review

## Changes

- Reloads save the current section and its relative offset in session storage, scoped to the exact URL and history entry. Content and font loading settle before revealing the restored page. An offset that no longer fits falls back to the section start. Restoration is immediate, shares the Lenis adapter, stops on user input, and has a five-second deadline. Reloading at the top does not wait. Removed sections fall back to the saved document offset, clamped by the browser.
- Native scroll restoration no longer competes with the router. Initial anchor navigation and asynchronous anchor corrections do not animate through intervening sections. Existing Back/Forward and query-only navigation behavior is retained.
- Quality recovery now works at 60Hz, evaluates the next tier's bad-frame ratio, and discards pre-change frame samples. The typing greeting and technology-stack scroll animations participate in degradation. Reduced motion stops sampling and animation without lowering photograph resolution. Skipped image prefetches can be retried after recovery.
- The skip link focuses main content without changing the hash route. Closed language options are removed from keyboard navigation; the language selector uses a disclosure of ordinary buttons, with selected state and Escape/focus return. Mobile navigation also supports Escape/focus return.
- Assistive technology gets a stable, complete greeting rather than a partially typed title. Focused reveal content remains visible. Auxiliary text, tags, collection counts and degraded photo captions have stronger contrast; the focus indicator is visible in both themes.

## Validation

- 332 tests in 43 files passed, including section-relative restoration, changing layout, stalled requests, storage denial, user cancellation, 30/60Hz quality recovery, background visibility, reduced motion image prefetch recovery, and rendered Flickr/uploaded-image URLs under reduced motion.
- TypeScript checks passed for web, admin and API; ESLint and repository formatting passed.
- Isolated Chromium checks with anonymous public API snapshots passed at 390px and 1440px widths. Reloads in About, Skills, Projects, Collection, Featured Photos and Contact retained section-relative offsets with normal animation and reduced motion, including delayed API responses and a stale URL anchor. Browser runtime errors: none.
- Keyboard checks covered skip-link focus without route changes, language options, Escape and mobile menu focus return.
- axe-core WCAG A/AA rule scans found no violations on Home, Projects, Portfolio, Collection and Privacy in both light and dark themes with reduced motion (stable layout). Normal-animation whole-document scans additionally flag offscreen entrance-fade text before it is revealed; these scans are not evidence of contrast after animation completes.
- Local UI testing used Vite's built-in TSX transformation because the Windows SWC native cache refused the machine's directory permissions. The configured production build must also pass Linux CI before promotion.

## Limits and follow-up

This is not a WCAG conformance certification. Automated scans cannot establish alternative-text quality, reading order, screen-reader usability or every dynamic state. Manually exercise NVDA/VoiceOver, photo dialogs, technology drawers, 200–400% zoom and real mobile browsers. Consider a visible pause-animation preference in addition to the OS setting for continuous decorative motion. Third-party embedded player accessibility is outside this site's implementation.

The reload wait is bounded: permanently failing or unusually slow APIs, content removed by an editor, and changed viewport sizes may prevent pixel-identical restoration. No refresh technique can reproduce deleted content. Performance tiers measure frame pacing, not real-user Core Web Vitals; compare production LCP/INP/CLS separately before claiming a speed improvement.

Reference: [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
