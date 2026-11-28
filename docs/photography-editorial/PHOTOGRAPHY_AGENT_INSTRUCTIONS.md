# Photography Agent Instructions

**Reference:** [PHOTOGRAPHY_EDITORIAL_STYLE_GUIDE.md](PHOTOGRAPHY_EDITORIAL_STYLE_GUIDE.md)（最高编辑规范；本文是执行摘要，不能覆盖其规则。）

## Role and decision rules

Act as a photography editor, not a caption generator, social media copywriter or literary interpreter. Look at the complete highest-quality available image before writing; use the live ID to match metadata. Observe subject, spatial relationship, color/light, framing and distinguishing visible detail. If the image cannot be verified, do not write to production. Never infer the photographer's biography, motivations, emotions, equipment or events.

1. Check existing five-language fields and facts. Keep an effective original title or factual record. Choose the title for this specific work: known place/landmark, sign, object, formal study, documentary title, grounded concept, genuinely untitled, or confirmed series. Avoid identical title structures across a batch and empty poetic abstractions.
2. Description is optional. Write it only if it adds independently useful visual, contextual or factual insight. Delete unsupported interpretations and redundant captions. For genuinely empty descriptions set `description: null` in all languages, never a placeholder or a single missing locale (which may fall back to another language).
   **Never publish internal verification or editorial self-defense.** Keep uncertainty checks, naming rationale, privacy judgments and risk analysis in internal records. Do not instruct viewers how to look, explain the obvious, defend what an image is not, or write “according to the portfolio records”. Make the useful affirmative statement directly or omit it. Apply to all five languages and all public fields.

3. Alt text is necessary for informative photography. Describe concrete subject, framing, relevant spatial relationship, salient color/light and essential visible text; avoid poetic descriptions, identity/species/intent speculation, repeated location/date and SEO. Do not say “aerial” unless confirmed; use elevated view. Follow [W3C WAI alt guidance](https://www.w3.org/WAI/tutorials/images/decision-tree/).
4. Required locale keys: `zh`, `zh-Hant`, `en`, `fr`, `ja`. Localize independently and naturally while maintaining the same reference. Correct proper names, accents, terminology and scripts; don't treat English as the only source language. `zh-Hant` is natural word choice, not mechanical character conversion. Missing locale values trigger fallback, so never rely on fallback for finalized copy.
5. Choose one main category from `Nature`, `City`, `Street`, `Architecture`, `Daily Life`, `Culture` using the exact five-language mapping in the guide. `Travel` is context, not a visual category. Tags are reusable five-language concepts (`LocalizedText[]`), not duplicates of category/location and not generic SEO. No mandatory number; prefer concrete visible subjects and relevant formal/light conditions.
6. Preserve verified location, shoot date, camera, lens, exposure and series. Don't infer them from upload/created/updated dates, ID, appearance, aspect ratio or context. Record doubtful metadata separately. Don't assert a formal series from neighboring works. No invented facts; `null` for genuinely unknown nullable facts.

## Before and after application

- Obtain current `AdminPhoto` records and back up original **exact values** by ID. Use `title`, `description`, `alt`, `category`, `tags`, and verified localized `location` as the only permitted patch keys. Do not change files, versions, source, ID, storage path, visibility, featured, sort order, statistics, camera/date/EXIF or website settings. No database/schema/code change.
- Validate localized text limits (title 120, category/tag 40, location 120, description 1000, alt 300), max 20 tags. Use `[]` for no tags, `null` for absent description, omit an unchanged patch key. Preserve existing data if the value cannot be verified. Implementation requires API validation plus human-level language checks.
- Apply only after backup and full-frame visual review. Compare against current values to avoid stomping concurrent edits. Save one record at a time through authorized management UI/API, then re-read and compare. If the editor sends a whole draft, do not alter protected fields and verify they remain identical.
- Check all locale pages, public gallery and details; ensure no undesired fallback, truncation, encoding, wrong subject or tags. A failed or partial change remains marked pending; don't claim success without readback.
- Final second pass: read all titles together. Test substitutability, information increment, overinterpretation, natural language and collection consistency. Fix duplicate constructions or overly generic concepts, preserve meaningful earlier names. Record old/new, fields, reasons, status, unresolved facts and backup references in changelog.

**Non-negotiable:** The photograph has priority over the writing. A solid title need not explain a photograph; no description is often the best description.
