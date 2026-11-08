# CupertinoCN (local copy)

Source: https://github.com/vantezzen/cupertinocn at commit `394cd5d`, `src/registry/ui/`.

**The repository declares no license.** This copy is for local evaluation only. Before any of it
ships or is published, ask the author for a license or replace it.

| File                  | Compared with the original                                                                                                                                                                                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `glass-optics.ts`     | Unchanged.                                                                                                                                                                                                                                                                                                |
| `liquid-glass.tsx`    | `cn` comes from this project; Tailwind utilities became `.cupertino-glass` rules; `GlassSurface` takes an optional `host` and rebuilds its maps at most every 120ms.                                                                                                                                      |
| `tab-gestures.ts`     | Matches `[data-slot="tab-bar-trigger"]` and `data-active` instead of tab roles; Ctrl/Cmd/Shift-click is left to the browser; a drag starts after 5px of travel; a tab counts as under the lens when the lens reaches it.                                                                                  |
| `tab-bar.tsx`         | Tabs render as links, in a plain group inside the page's `<nav>`: no tab roles, no focus activation, no `TabBarContent`. `TabBarList` takes the glass variant and strength.                                                                                                                               |
| `slider.tsx`          | `cn` comes from this project; Tailwind utilities became rules in `cupertino-slider.css`.                                                                                                                                                                                                                  |
| `cupertino-glass.css` | The Liquid Glass and Tab Bar rules of `cupertino.css`, verbatim, without `@layer`. Tokens moved from `:root` to `.glassScope` (`components/navigation/navigation.css`); Tailwind utilities became rules. The lens and its copy read one animated value (`--lens-*`), and the copy is as wide as the list. |
