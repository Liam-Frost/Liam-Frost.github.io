# Claude Code Review: Stage 15

Date: 2026-11-03

Scope: books and comics (`a37fb45..HEAD`): `MediaKind` migration, Open Library / AniList / Bangumi book sources, redirect-following poster downloads, publication details, validation of kinds and sources, suggestions across anime, comics and light novels, admin tabs and editor, site tabs and panel.

## Found During Live Verification (Fixed)

- High: AniList's default relation types call a source ADAPTATION, so an anime's manga was suggested as an adaptation of the anime (the link pointed the wrong way). Relations are now read with `relationType(version: 2)`, which has SOURCE; a test checks the query and the kinds.
- Medium: Open Library subjects mix genres with other languages' headings ("Liebesbeziehung"); only common genres are kept, translated into every site language.
- Low: Open Library publishers start with an invisible U+200E; source text drops direction marks.
- Low: Bangumi's 漫画 tag repeated the platform as a genre; tags equal to the platform are dropped.

## Findings Fixed

- Medium: poster downloads refused redirects, and Open Library covers always redirect (to archive.org). Redirects are followed by hand, up to three hops, each checked against the image host list; a redirect to any other host is refused (test).
- Low: the home page's 最近在看 would have mixed books and comics into "recently watched"; it keeps films, series and anime.
- Low: saved display settings without book and comic switches would have failed validation and fallen back to the defaults; the switches default to on.

## Not Changed

- AniList has no Chinese titles; comics imported from it show the English title in Chinese until one is added (Bangumi has Chinese names).
- Open Library keeps one title per work, usually the original language's, and English descriptions.
- Google Books is not used (needs a key); see the decision record.

## Follow-Up Verification

- `npm test`: 139 passed. `npm run typecheck`, `npm run build`: passed.
- `prisma migrate diff` from the migrated temporary database to the schema: empty.
