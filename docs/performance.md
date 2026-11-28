# Public site behavior

## Adaptive quality and loading

The site uses frame pacing, available long-task observations, tab visibility and browser preferences. Motion, filters, image resolution and speculative prefetch have independent budgets. Enable the debug panel with ?debug=1 before the hash in a production build.

Motion keeps its 0–3 frame-pacing ladder. Filter pressure uses a separate 0–2 ladder: sustained average frames above 24ms or p95 above 50ms lower filters after 1.5 seconds; average below 18ms and p95 below 25ms for 12 seconds recover one filter level. Filter 1 removes header/background blur; filter 0 removes supported filters with readable caption backgrounds. The motion tier no longer switches header blur.

Image resolution defaults to the grid's existing b-size ceiling, independent of frame pacing and motion preference. Responsive srcset still selects for rendered width and DPR. Explicit image overrides retain n/z/c/b for testing. Speculative prefetch uses a separate 0–2 budget; Save-Data and slow-2g/2g/3g disable it automatically. Hidden/reduced-motion states pause speculative work; explicitly requested images remain functional. Debug UI exposes independent motion, filter, image and prefetch controls. These policies do not infer CPU/GPU models.

The home section-restoration indicator stays visible while scroll position is resolved. Initial entry and the time before restoration show no full-page skeleton. The Spotify dock expands automatically once the iframe loads, at most once per browsing session. A manual open can show the loading placeholder before the iframe is ready.

## Motion, scrolling and the waveform navigator

Motion tokens live in globals.css. Reveal handles headings, content groups and staggered lists. Composite blocks reveal together. Portfolio filter results appear immediately. The technology stack can use a lazy GSAP scroll timeline and falls back when motion is disabled or unavailable. Lenis handles smooth desktop scrolling, with native fallback for scroll helpers. Test direct anchors, section reload restoration, back/forward history, keyboard navigation and reduced motion.

The desktop waveform rail follows rendered homepage sections. It uses independent semantic buttons and a decorative SVG, without sampling audio. Playback state comes from the local audio element or validated messages from the Spotify iframe. Hidden or idle states stop animation. Reduced motion keeps the controls usable.

## Featured collection wall

The wall partitions a contiguous list of public featured covers into justified rows based on their aspect ratios. It balances row heights and retains a clickable fallback when an image is unavailable. Sparse collections use fewer rows instead of duplicating entries. Collection settings control visible-row limit, target height and the use of fixed order or rotation. The layout calculation lives in apps/web/src/lib/justified-layout.ts.

## Responsive photography

### URL sizing via suffixes

Flickr static URLs look like:

`https://live.staticflickr.com/{serverId}/{photoId}_{secret}_{suffix}.jpg`

We build new sizes by changing the suffix (example suffix targets longest edge):

- `n` ≈ 320
- `z` ≈ 640
- `c` ≈ 800
- `b` ≈ 1024
- `h` ≈ 1600
- `k` ≈ 2048
- `3k` ≈ 3072
- `4k` ≈ 4096

Parsing/building supports multi-character suffixes like `_3k` / `_4k`.

### Grid (scroll performance)

The grid uses `srcset` + `sizes` to request the right image for the masonry column width.

Defaults are aligned to the existing CSS columns:

- 4 columns normally
- 3 columns <= 1100px
- 2 columns <= 840px
- 1 column <= 520px

Tier-aware behavior:

- Tier 3: grid capped at `b`
- Tier 2: grid capped at `c`
- Tier 1: grid capped at `z`
- Tier 0: grid capped at `n`

### Lightbox (quality)

Lightbox uses progressive loading:

1. Load a medium image immediately (`z/c/b` depending on tier + layout).
2. Start loading a full image (`h/k/3k/4k`) based on viewport and original dimensions.
3. Swap in full with a short crossfade once loaded.

### Error fallback chain (must not affect tier)

If a suffix URL fails, we retry smaller suffixes locally per-image.

- Thumbs: `b → c → z → n`
- Full: `4k/3k/k/h → b → c → z → n` (capped by original size)

This **does not** trigger global quality degradation.

## Routing and not-found pages

Unknown hash routes and ordinary unknown document paths display the shared site header, footer, typography and theme, with links to the homepage and portfolio. Unknown physical paths use an absolute document base so nested URLs can load the application assets. Home navigation leaves the unknown document path instead of merely changing its hash.

The API application's web handler serves the application shell with HTTP 404, `no-store` and `noindex` for missing HTML document navigations. Unknown API, uploads, assets, dot paths and extension-bearing asset requests retain their JSON 404 response. Analytics records the missing physical path without its query string.

Static regional servers have their own HTTP fallback configuration. The frontend can render the error page when they serve its shell, but this change does not by itself change those servers' HTTP status or fallback policy. Validate document status and fallback behavior on every serving layer during release acceptance.
