# Claude Code Review: Stages 18b and 18c

Date: 2026-11-02

Scope: `92e1a90..HEAD` on PR 26: the CodeQL fix, content catalog and name snapshots, content / audience / health reports, CSV and JSON export, clearing, the API request recorder and job / source log, the demo data script, the admin 内容 / 来源与受众 / 体验与运行 views, 30-day counts in editors and lists, and Web Vitals on the site.

## CI

- CodeQL (high): "insecure randomness" for the `Math.random()` fallback in the site's event ids. Ids now come from `crypto.getRandomValues` (also available on plain-HTTP pages, unlike `randomUUID`). CodeQL passed on the next run.

## Checked

- Content events name only public content: hidden entries, made-up ids and the player's sample songs are dropped (tests). A miss reloads the catalog at most every 30 seconds, so random ids cannot force constant reloads.
- Small groups: sources, countries and UTM values below `ANALYTICS_MIN_GROUP_SIZE` are folded into 其他, heatmap cells with fewer visitors show no number (tests).
- CSV export: byte-order mark, quoting, and text starting with `= + - @` (or tab / CR) prefixed so it cannot run as a formula (tests); file names come from fixed dataset names.
- Clearing needs the admin and the CSRF header (test), and only touches analytics tables.
- The demo script refuses databases whose name or schema lacks "demo" (test and manual run).
- API timings use route patterns only, never addresses; admin routes, the event endpoint and health probes are not timed.

## Findings Fixed

- Medium: the slowest-interaction measurement counted every timed event, including hovers; it now counts only events with an `interactionId` (real clicks, taps and key presses).
- Low: an item's detail page loaded every raw event of every day in the range to find its visits; a store query now returns only that item's session ids.
- Low: a song's detail chart opened on 浏览, which is always 0 for songs; it opens on 播放.
- Low: the export menu stayed open after choosing a file.
- Low: a literal byte-order mark had been written into the CSV code instead of the `\uFEFF` escape (ESLint `no-irregular-whitespace`).

## Not Changed

- A "not found" answer from a source (a SourceError) also shows as that source's last failure.
- Web Vitals are measured on the landing page only, for half of the visits; route changes inside the site are not measured.
- Countries are a ranked list with flags, not a map.
- Plays in Spotify's embedded player are counted when the song is loaded (as in 18a).
- The privacy page still states 90 days (as in 18a).

## Follow-Up Verification

- `npm test`: 179 passed. `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`: passed.
- `prisma migrate diff` from the migrated temporary database to the schema: no difference.
- Browser, temporary demo database: all four views, item detail and the editor link, collection card counts, CSV export, clearing from the UI, 375 px without overflow; real visits stored content views for real entries only, API timings and CLS. The pane reported no LCP (pages loaded off screen).
