# Claude Code Review: Stage 20

Date: 2026-11-02

Scope: branch `stage-20-dashboard`: `GET /api/admin/dashboard` (`DashboardService`, `AnalyticsService.dashboard()` / `system()`), the shared dashboard types, the admin 概览 page, the 只看引用 photo filter and the one-time `?open=` / `?show=` links.

## Found During Verification (Fixed)

- Medium: a failed part sent Prisma's full error text to the page (the query, source file paths, the connection error). Failures now show a short reason (无法连接数据库, or 读取失败，详情见服务器日志); the error is logged once on the server, even when several parts share the failed read.
- Medium: at 375 px the page was 428 px wide. The one-column grid had no explicit track, so lines that do not wrap (truncated names) set its width; it is now `grid-cols-1`.
- Low: without job history, a failed analytics read failed the accounts part too; jobs and source status are now optional extras, so Steam, Spotify and the source keys still show.

## Found in Review (Fixed)

- Medium: two one-time parameters on one page (`?open=add&show=referenced`) were each removed by a separate address update built from the same starting address, so the second update could bring the first parameter back. One hook now removes all of a page's parameters in one update.
- Low: the Steam row and the steam-stale task used different rules (the page ignored when the account was connected). The API now sends `stale` with the account, using the task's rule.
- Low: the Steam status was read twice per request; it is read once and shared. The unused avatar is no longer sent.

## Checked

- Admin only (401 without a session), `cache-control: no-store`; only whether keys are set is returned (test checks that test keys never appear in the response).
- Each part fails on its own (test with an unreachable photo store); traffic is `null` when analytics is off.
- Task rules: hidden photos and projects are not counted for missing English or covers; songs and albums are not counted as unrated; a source counts as failing only when its last failure is newer than its last success.
- Links from tasks and the content tiles point to existing admin routes; the one-time parameters are removed after use, so reloading does not reopen a dialog.

## Not Changed

- Every load lists all content (including hidden) to count it; fine at this site's size, and it refreshes once a minute only while the page is open.
- The seven-day trend reuses the 7-day analytics overview, which also computes the period before it.
- Connections render twice (one hidden by screen width) to keep the phone order 待处理, 账号与服务, 内容概况 with two columns on wide screens.

## Verification

- `npm test`: 196 passed. `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`: passed.
- Browser, temporary database with the sample collection and demo statistics: all parts loaded; no horizontal overflow at 320, 375, 768 and 1280 px; the links opened 添加照片, 新建项目, 添加电影 and the Steam dialog, and filtered referenced photos. The single-update parameter fix was checked by tests and type checks only, not again in the browser.
