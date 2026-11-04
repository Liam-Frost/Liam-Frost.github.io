# Featured collection quilt

`HomeCollection` renders `FeaturedQuiltWall` in place of the former three horizontal cards. The wall consumes actual public collection entries; it never embeds the reference HTML, imports its demo records, or fills gaps with duplicate entries.

## Layout and covers

`apps/web/src/lib/justified-layout.ts` partitions a contiguous ordered prefix with dynamic programming. Each row has `height = containerWidth / sum(aspectRatios)`; the score penalizes squared logarithmic deviation from the target height. It considers complete partitions for fitting collections and the best prefix for overflowing ones. Sparse collections shrink the whole canvas to a natural cover height, leaving no internal empty columns or oversized last row. Visible rows are a maximum, not a requirement to repeat content.

The component observes its full-width host with `ResizeObserver`, batches resize notifications with animation frames, and memoizes covers/layout. Rows use zero-gap flex tracks weighted by their aspect ratios, without independently rounding every tile width; the browser distributes subpixels across the entire row. Tiles/images have no borders, margins, or rounded corners. Only the clipped outer canvas has a 24px radius (20px on phones). Images use `object-fit: contain`, never cover, scaling transforms, or blurred fillers.

Generated image variants already include width/height. The wall chooses an appropriately sized cached variant and uses that exact variant's dimensions, avoiding discrepancies from integer-rounded sizes in a changing srcset. Missing dimensions are measured with `naturalWidth/naturalHeight`, cached by immutable URL and applied in batches; slow loads can supply later corrections. Missing/failed/invalid covers retain the original entry's clickable fallback, without expanding the row. Source images with baked-in white margins or rounded artwork keep those pixels; the layout does not crop them away.

## Data, ordering and configuration

The existing database `Setting` document with key `collection` now includes `featuredWall: { visibleRows, targetRowHeight }`. Defaults are 3 / 180px; accepted write ranges are integer 1–8 / 100–360px. `resolveFeaturedWall` fills missing/invalid read values individually, preserving existing visibility switches. This requires no schema migration. The admin's existing 收藏 → 显示设置 dialog provides the controls, save/error toasts, and a home-page preview link.

`CollectionSettingsStore.save` writes the document and immediately refreshes the server cache. Reloading the public page reads the updated configuration. `GET /api/collection` retains the legacy `home.featured` three picks and adds `home.wall` with the complete eligible ordered candidates and settings. Old APIs/snapshots still work with client defaults.

Manual mode preserves the admin's `featuredOrder` exactly, after public visibility filtering. Automatic mode rotates the start daily and proportionally interleaves stable music/nonmusic queues. Ordering is independent from row partitioning. Only entries actually displayed by the wall are excluded from the ongoing/recent shelves.

## Interactions

Playable songs send the existing synchronous `sendPlayerCommand` with `playRequest`, and read `useNowPlaying`; clicking the active song pauses the same dock. No second audio player is introduced. Spotify embed mode selects/opens the song in the existing iframe and shows a selection cue; it does not claim to know playback state or bypass Spotify's play/authorization controls. Disabled/unplayable music and nonmusic entries use the existing collection URL/detail panel. Hover and keyboard focus reveal absolute overlays without changing geometry; touch clicks act immediately, with visible action icons on small screens.

## Verification

`apps/api/test/justified-layout.test.ts` checks mixed/biased compositions, sparse data, complete rows, exact summed widths, source ratios, global partition optimality, row/height changes and invalid inputs. `featured-wall.test.ts` checks public filtering, legacy compatibility, stable ordering, validation, database-backed settings persistence and cache invalidation. Browser verification should additionally measure natural/rendered image ratios and contiguous rectangles across 320, 375, 390, 430, 768, 1024, 1280 and 1440px, test focus/touch/play/detail behavior, and save/reload the real admin controls. Test-only demo assets and operational acceptance scripts belong outside this repository.
