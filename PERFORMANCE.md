# Performance & Quality System

This project uses a **runtime adaptive quality system** to keep animations smooth (especially on battery-powered laptops) while **avoiding hardware fingerprinting**.

It also implements a **Flickr image delivery strategy** that keeps the grid fast (decode/memory/scroll) while still loading high quality in the lightbox.

## What we measure (and why it’s not fingerprinting)

We only use **runtime performance measurements** and user accessibility preferences:

- `requestAnimationFrame` **frame deltas** (dt) to estimate frame pacing.
- Optional **Long Tasks** via `PerformanceObserver({ type: "longtask" })` when supported.
- `document.visibilityState` to pause work in background tabs.
- `prefers-reduced-motion` to respect accessibility.

We do **not** attempt to infer CPU model, GPU, memory size, or other detailed hardware characteristics.

## Quality tiers

Quality tier is an integer: `0 | 1 | 2 | 3`.

- Tier 3: full visuals (target 60fps)
- Tier 2: very similar visuals, budgeted updates (target 45fps)
- Tier 1: reduced decorative work, filters off (target 30fps)
- Tier 0: minimal motion; decorative updates off (target 30fps, sample-only)

### Important semantics: `fpsCap`

`fpsCap` is a **max work update frequency**, not an rAF skip.

- rAF still runs so we can keep sampling.
- “Heavy update” work only happens when `now - lastWorkTs >= 1000 / fpsCap`.
- **`fpsCap = 0` means: never do heavy decorative updates** (avoid divide-by-zero by treating interval as `Infinity`).

## Metrics window & thresholds

We maintain a ring buffer of the last `N=120` frame deltas.

Computed metrics:

- `avgFrameMs`
- `p95FrameMs`
- `badFrameRatio` where `bad = dt > targetMs * 1.25`

Hysteresis:

- **Degrade quickly**: if `avgFrameMs > targetMs * 1.15` for `>=1.5s`, or `badFrameRatio > 0.25`
- **Upgrade slowly**: if `avgFrameMs < nextTargetMs * 0.85` for `>=6s` AND long-task rate is low

Visibility:

- When hidden: pause sampling and clamp effective tier to 0.
- When visible again: short re-warm-up (300–500ms).

Reduced motion:

- `prefers-reduced-motion: reduce` forces tier 0 and disables decorative animation.

## Degrade ladder (mapping to UI/animations)

The provider sets global DOM attributes:

- `html[data-perf-tier="0..3"]`
- `html[data-perf-filters="on|off"]`

The CSS degrade ladder uses these to:

1) Disable expensive `backdrop-filter`/`filter` while keeping the UI readable via more opaque backgrounds.
2) Reduce/disable decorative CSS keyframe animations.
3) Reduce blur-heavy reveal effects at low tiers.

## Flickr image strategy

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

1) Load a medium image immediately (`z/c/b` depending on tier + layout).
2) Start loading a full image (`h/k/3k/4k`) based on viewport and original dimensions.
3) Swap in full with a short crossfade once loaded.

### Error fallback chain (must not affect tier)

If a suffix URL fails, we retry smaller suffixes locally per-image.

- Thumbs: `b → c → z → n`
- Full: `4k/3k/k/h → b → c → z → n` (capped by original size)

This **does not** trigger global quality degradation.

## How to test

1) Run dev: `npm run dev` (debug panel shows by default).
2) Try `?debug=1` in preview/build.
3) Use DevTools:
   - CPU throttling (4× / 6×)
   - Performance panel: look for Long Tasks
4) Test visibility:
   - switch tabs for 10–20s
   - return and confirm it re-warm-ups (no tier penalty)
5) Test accessibility:
   - enable `prefers-reduced-motion` in OS/browser
   - confirm tier is forced to 0 and decorative animations stop
6) Battery vs plugged in:
   - observe tier behavior and filter toggles on laptops
