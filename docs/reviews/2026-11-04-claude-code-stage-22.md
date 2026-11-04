# Claude Code Review: Stage 22

Date: 2026-11-04

Scope: branch `stage-22-admin-ux`: `IntegrationsPage` and `components/integrations/IntegrationItem.tsx`, `OverviewPage`, the shared `Time` component, the task filters on the photos, projects and collection pages, and the `kind` of the 未评分 task in `DashboardService`.

## Found During Verification (Fixed)

- Medium: the first grid let each card stop at its own height, so rows ended at different heights; cards in a row now share its height (no fixed heights).
- Low: below 400 px the KPI cards stacked in one column, four tall cards before anything else; they are two columns down to 320 px (measured: no overflow in a 138 px card).
- Low: the Redirect URI hint said an empty field uses the current address, which is wrong when one is saved (the server keeps it); the hint now depends on whether one is saved.

## Codex Review on PR 41 (Fixed)

- P2: unsaved API 配置 input was lost on in-app navigation. `beforeunload` only covers reloads and closing the tab; a sidebar link or 去连接 unmounted the page and dropped the drafts without asking. The admin uses `<BrowserRouter>`, which has no navigation blocker, so instead of switching routers the drafts are kept outside the page (`components/integrations/drafts.ts`, memory only): leaving and coming back restores them, still marked 未保存. They are dropped on save, 取消修改, sign-out (with the other cached admin data) and reload. Checked in the browser: a draft survived a sidebar round trip and browser Back, and was gone after signing out and in again without a reload.

## Checked

- Secrets: fields stay `type="password"`, saved values are never shown, submitted values are deleted from the mutation after it settles, the field clears after saving; a dummy key never appeared in the page after saving.
- Behaviour kept: save with blank fields keeps values, Spotify's default Redirect URI when none is saved, 停用 and 恢复服务器配置 with confirmations, buttons disabled while a request runs (no double submits), the page updated from the server's reply after each action (checked against `GET /api/admin/integrations`).
- Accordion: buttons with `aria-expanded` / `aria-controls`, a labelled region, closed panels `inert` (not focusable), transition off with reduced motion; one open at a time; drafts kept per service, marked on the row (text on wide screens, a dot and screen-reader text on narrow ones), and leaving the page with a draft asks first.
- Connection status comes only from existing records: the job log's last request for TMDB, Google Books and IGDB, connected accounts for Spotify and Steam; 未检测 otherwise. No new requests to third parties; the page reads the overview's data once a service is opened (cached for a minute).
- Overview: no nested links or buttons inside links; KPI cards are not links (the ⓘ buttons are inside); the 7-day chart has dates, a tooltip and a keyboard-focusable bar per day; failing sources first; edits and jobs in one list sorted by time.
- Every task link opened a filtered list; the filters match the dashboard rules (public only for missing English titles and covers).

## Not Changed

- Projects' manual order cannot be changed while a filter is on (the arrows are disabled), like the photos page.
- The examples under each task still link only where an item has its own page (photos open in a dialog).
- "授权失效" cannot be shown: the server does not report expired Spotify or Steam authorisation separately from a missing account.

## Verification

- `npm test`: 214 passed. `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`: passed.
- Browser, temporary database: see `progress.md` (Stage 22).
