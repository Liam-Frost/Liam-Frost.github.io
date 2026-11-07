# Loading, debug UI and missing-page diagnostics

The performance panel groups motion, filters, image resolution and speculative prefetch into independent budget cards, with effective values and manual/auto controls. Frame metrics refresh once per second only while expanded. Restoring defaults resets all overrides. A compact collapsed panel avoids covering mobile player controls.

Shared loading shapes now cover project/collection lists, project detail, media/person drawers, home asynchronous content, route fallbacks, technical-stack placeholders, and admin content lists/forms/analytics views. Dashboard placeholders use the shared sweep styling. Image placeholders preserve the existing image dimensions and stop on load/error. Skeletons are aria-hidden inside named busy/status containers; reduced-motion uses static placeholders. Existing data remains visible during background refetches.

The embed player marks its automatic presentation in sessionStorage. It automatically opens at most once per tab session; refreshes keep it collapsed, while explicit player commands and clicks still open it. Dismissing before load also consumes the automatic opening. Blocked session storage gracefully falls back to in-memory state.

Missing route page views keep the existing * totals and additionally record a bounded path-only diagnostic in the existing event detail field. Query/fragment data and control characters are removed. Daily aggregation preserves per-path counts; the admin overview shows the top 100 missing paths separately. Earlier events without path details cannot be reconstructed. No database migration is needed.

Validation: 337 tests passed, including ingestion/aggregation of missing paths with query stripping; workspace typechecks, lint, formatting and admin production build passed. Isolated 390px/1440px browser checks covered independent controls, slow-loading skeletons, session refresh suppression, manual player opening, admin loading forms and displayed missing-path rows. Browser runtime errors: none.

Preview content maintenance and private operational evidence remain outside this repository. Production promotion remains on hold at the user's request.
