# Claude Code Review: Stage 7

Date: 2026-10-31

Scope: photo management and upload pipeline (schema and migrations, repository, image processing, admin and public photo routes, `/uploads`, admin Photos page, web image component).

## Findings Fixed

- Medium: Prisma migration files followed `core.autocrlf`, so Windows checkouts had CRLF and Linux/VPS checkouts LF. Prisma checksums migration bytes, so the same migration would look modified across machines. Added `.gitattributes` forcing LF for `apps/api/prisma/migrations/**`.
- Medium: images of hidden (draft) photos were served to anyone who knew or guessed the URL (file name plus 24 random bits). `/uploads` now looks the photo up: public photos are served with a one-year immutable cache, hidden photos only to a signed-in admin with `private, no-store`, unknown or deleted photos are 404.
- Low: every generated size decoded the full original again. The original is now decoded, rotated and downscaled once; all sizes render from that raw image.
- Low: any error while buffering the upload was reported as "file too large". Only the multipart size-limit error maps to 413; other failures return 400 `UPLOAD_INTERRUPTED`.
- Low: a photo uploaded before the admin list finished loading was dropped from the cache update. The list is refetched instead.

## Checked and Not an Issue

- Multipart uploads are not limited by the 1 MB JSON `bodyLimit`: a 5+ MB PNG upload was verified to succeed.

## Follow-Up Verification

- `npm test`: 47 passed (photo tests now also cover hidden-image access, published-image caching and 404 after delete).
- `npm run typecheck`, `npm run build`: passed.
