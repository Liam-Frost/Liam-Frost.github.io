# Claude Code Review: Stage 19a and 19b

Date: 2026-11-02

Scope: branch `stage-19-photo-sources`: the photo `source` column and migration, link fetching (`lib/safe-fetch.ts`), `PhotoSources` (links, Flickr, server folders), the photo routes (import, replace, host, server browsing), per-image storage folders and their `/uploads` route, and the admin 添加照片 dialog, picker and editor image section.

## Found During Verification (Fixed)

- High: the migration's backfill used `jsonb_build_object` with untyped `NULL`, which PostgreSQL rejects, and compared the storage column with the Prisma enum names (`LOCAL`) instead of the stored values (`local`). `npm run db:deploy` would have failed on any database with photos. The in-memory tests cannot see SQL; the migration was rerun against photos stored the old way and fills `source` correctly.
- Low: the server folder grid showed a horizontal scrollbar in the dialog.

## Checked

- Links: https only; no user info in the link; every address a name resolves to must be public, checked before the first request and after every redirect (at most 3); the body is limited to `UPLOAD_MAX_MB` and requests time out. `127.0.0.1`, `[::1]`, `10.x`, IPv4-mapped private addresses and a redirect to `169.254.169.254` are refused (tests); a local address was refused in the browser.
- Server folders: only paths inside a configured folder after resolving symlinks; `..` and absolute paths are refused; hidden files and non-images are not listed; files over the size limit are refused; previews are `private, no-store`. Server files are always hosted.
- Replacing an image writes the new files to a new folder first, updates the photo, then removes the old files; a failed update removes the new files. Older flat folders lose only their files, so a new image inside them survives (test).
- Public image URLs stay immutable: a replaced image has new URLs; the old ones return 404.
- Uploads keep their behaviour (EXIF suggestions, stripped metadata in the generated sizes, private originals); existing tests pass with the new folder layout.

## Not Changed

- DNS rebinding: a name could resolve differently between the check and the request. Accepted for an admin-only feature; Node's fetch is kept so `HTTPS_PROXY` still applies.
- 198.18.0.0/15 is allowed (proxies in fake-IP mode answer with it).
- A referenced image is downloaded once to read its size; it is not checked again later.
- Photo ids from Flickr short links use the short code (`2rru4ay-…`); the title comes from Flickr.
- The storage interface for R2 waits for 19c.

## Follow-Up Changes

- One 图库 entry for gallery sites (source `gallery` with a `provider`; Flickr for now) instead of a Flickr tab; unsupported sites get a clear message.
- Photo card footer: the status badges, source tag and action buttons shared one non-wrapping flex row; in a card about 200 px wide the shrinkable badges were squeezed until 精选 / 引用 wrapped one character per line, and the icon buttons (in shrinkable wrappers) were pushed out. Now a wrapping metadata row of fixed-size badges (no wrapping inside) and a separate action row under a divider, pinned to the card bottom so rows align; `IconButton`'s wrapper no longer shrinks. Checked at 1440, 1180, 980, 700, 600, 470, 375 and 320 px (4 to 1 columns) with every tag combination and a long Chinese title: every badge one 20 px line, no overflow, all four buttons fully inside each card, action rows aligned in every grid row, at least 8 px above the divider; move up / down, edit and delete still work.

## Follow-Up Verification

- `npm test`: 192 passed. `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`: passed.
- `prisma migrate diff` after the migration: no difference.
- Browser with a temporary database: server folder import with previews and EXIF; Flickr short link through oEmbed (referenced, title read); image link imported; local address refused; 转为本站托管; 替换图片 from a server file with EXIF (title kept, date and camera taken, old folder removed).
