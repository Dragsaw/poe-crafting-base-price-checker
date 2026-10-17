---
type: architecture
title: Web frame, theme and controls
description: How the static page is framed — the App state machine, the dark Rarity token set with bundled Inter, the sticky header bar and its three slots, the Payout Threshold and Craft Recipe controls and what they persist, the sync button with its problem count, the four-column sync report panel, and the refused and failed screens.
tags: [web, react, mantine, theme, design-tokens, header, threshold, recipe, sync-report]
verified:
  - by: openwiki/0.6.0
    at: 2026-10-17T13:54:42.734Z
sources:
  - id: openwiki-source-d952717f7ba616148cf6047b
    resource: repo://packages/web/src/App.tsx
  - id: openwiki-source-e69ba1cc4531b88ce7c676d6
    resource: repo://packages/web/src/frame/header-controls.tsx
  - id: openwiki-source-baf6bac1d9fc92707902acf7
    resource: repo://packages/web/src/frame/HeaderBar.tsx
  - id: openwiki-source-16ad99c7d5e15beeb547ad54
    resource: repo://packages/web/src/frame/panel-columns.ts
  - id: openwiki-source-98485b06ab68e705ce3c5ff7
    resource: repo://packages/web/src/frame/problem-summary.ts
  - id: openwiki-source-c21a138fecee3d1eca80de8d
    resource: repo://packages/web/src/frame/sync-button-face.ts
  - id: openwiki-source-024d0766ba82ba84a5436d71
    resource: repo://packages/web/src/frame/SyncReportPanel.tsx
  - id: openwiki-source-c812fb4551da6f87015e4c84
    resource: repo://packages/web/src/frame/trust-copy.ts
  - id: openwiki-source-be5553cd1ea0004a5af26c8a
    resource: repo://packages/web/src/recipe/recipe-storage.ts
  - id: openwiki-source-095960c6807b9299250d5a75
    resource: repo://packages/web/src/recipe/recipe-view.ts
  - id: openwiki-source-532df2648b3add39258d9418
    resource: repo://packages/web/src/theme/inter.css
  - id: openwiki-source-394a67327bda2f6ef9386bd1
    resource: repo://packages/web/src/theme/PageProvider.tsx
  - id: openwiki-source-717f143b9bad39bbbbe092a7
    resource: repo://packages/web/src/theme/tokens.ts
  - id: openwiki-source-337cf84f2aca0342f7fb21f4
    resource: repo://packages/web/src/threshold/PayoutThreshold.tsx
  - id: openwiki-source-7f1c49c9ea79c77f6775aee2
    resource: repo://packages/web/src/threshold/threshold-storage.ts
generated: { by: "claude-code", at: "2026-10-17T13:54:42.734Z" }
---

# Web frame, theme and controls

`packages/web` is one static page. This page covers everything around the ranked list: the app shell, the theme, the header and its controls, the sync report panel and the failure screens. The list itself, the artifact load and the row and expansion layout are in [Web page: artifact load and ranked list](page-load-and-ranked-list.md). The visual rules come from the UX `DESIGN.md` (tokens and components) and `EXPERIENCE.md` (behaviour, copy and states); the code cites their component names, such as `{components.header-bar}`, and numbered states.

## The app shell

`main.tsx` imports Mantine's CSS and `theme/inter.css`, then renders `<App />` inside `PageProvider` under React `StrictMode`.

`App` (`App.tsx`) is a small state machine over the load:

| View | Renders |
| --- | --- |
| `pending` | the frame, the header with only the threshold control, `RowSlots` (flat skeleton bars in the final four-column grid) and the footer |
| `ready` | the header with all three controls, the optional sync report panel, the list statement, the ranked list, the Unrankable appendix and the footer legend |
| `refused` | `FailureScreen` naming the file, the cause and the declared and expected versions |
| `failed` | `FailureScreen` naming the file, with a retry that reloads |

The view moves from the skeleton to one outcome in a single transition, never row by row. When the set resolves, `App` reads the clock **once** (`now`) and holds it, so ages on the page never tick. It also runs `crossFileChecks` once for the set. `useRanking` then calls `core`'s `rank` with that `now`, the threshold, the weights, the cross-file failures, all recipes and the dataset's rates. `rank` ranks every `(Item Class, recipe)` pair at once, so switching the recipe only re-filters (`forRecipe`) and never re-ranks. Changing the threshold re-ranks.

`Frame` (`frame/Frame.tsx`) is one centred column between `content-min` (1000 px) and `content-max` (1120 px) with a 24 px gutter. It carries `data-state` and `aria-busy` while pending. `renderPending` and `renderReady` are plain calls rather than components, so the frame and header keep their identity across the transition.

## Theme and tokens

- `theme/tokens.ts` transcribes the **Rarity Dark** token set from `DESIGN.md`'s frontmatter; `DESIGN.md` wins on any difference. It exports `colors` (neutrals, the rarity pair `rarity-magic` / `rarity-normal`, one `accent`, and the three trust colours `trust-rough`, `trust-pending`, `trust-broken`), `rounded`, `spacing` (column widths, row heights, header height), the shared `rankedRowGrid`, type styles (`typeStyle`), font stacks and per-component layout numbers.
- `theme/theme.ts` builds the Mantine theme with `createTheme` (accent as primary colour, the sans and mono stacks) and a CSS-variables resolver, plus default props for tooltips and the list of Mantine components whose styles the page overrides.
- `PageProvider` applies the theme once with `forceColorScheme="dark"`: the page has one theme and ignores the OS scheme.
- `theme/inter.css` binds the bundled `@fontsource-variable/inter` files to the family name `Inter` that the tokens use. The font ships with the build; no third-party font host is contacted.

## The header bar

`HeaderBar` (`frame/HeaderBar.tsx`) is the one pinned region: `position: sticky`, 64 px high, on the ground colour with a strong bottom line. On the left is the brand block: the active league as an uppercase eyebrow (a no-break space while pending) and the title *What's worth picking up*. Both are cut with an ellipsis, so the controls never leave the bar.

It has three slots, in order: `recipe`, `threshold`, `sync`. An empty slot keeps a reserved width (`HEADER_SLOT_WIDTHS`, measured in a browser at the minimum content width), so the layout does not move when a control appears. The sync slot always holds its width, because its face exists only once the set is loaded.

`frame/header-controls.tsx` fills the slots:

- `pendingControls` fills only the threshold, the one control the cold load can show.
- `readyControls` adds the recipe toggle (when a recipe exists) and the sync button, and builds the sync report panel when it is open.
- `useReportToggle` keeps the panel's open state. It starts closed on every load and never persists. Opening it scrolls the page to the top.

## Payout Threshold

`PayoutThreshold` (`threshold/PayoutThreshold.tsx`) is a Mantine `Slider` and `NumberInput` onto one value, from 0 to 3 Divine in steps of 0.05, shown at 2 decimals. A slider move commits at each step. A typed value commits after a 150 ms debounce (`COMMIT_DEBOUNCE_MS`), and blur flushes it. Both share the last valid value, so an invalid draft never reaches the ranking.

`threshold/threshold-storage.ts` persists it under the localStorage key `poe-cbpc.payoutThreshold`. It is read once at mount. Anything but a plain decimal in [0, 3] reads as the default threshold, and a throwing storage is ignored on both read and write. A written value is clamped to [0, 3] and rounded to 2 decimals.

## Craft Recipe

`CraftRecipe` (`recipe/CraftRecipe.tsx`) is a segmented toggle over the published recipes, each labelled by the one word `recipeWord` derives from its currency grade (`contracts`). With one recipe it shows the word alone. Beside it, the cost line shows the active recipe's Craft Cost at 2 decimals (`recipeCostLine`, which calls `core`'s `craftCost`), or *no figure yet* when the recipe is uncostable.

`recipe/recipe-storage.ts` persists the active recipe id under `poe-cbpc.craftRecipe`. `activeRecipe` uses the stored id when `recipes.json` still declares it, else the first recipe. With no recipes, the slot stays empty and the list reads the `no-recipe` cost note. `recipe-view.ts` also maps the cost to the EV column tooltip's variant (`costed`, `uncostable` or `no-recipe`).

## The sync button and the sync report

`SyncButton` (`frame/SyncButton.tsx`) toggles the sync report panel. Its face (`syncButtonFace`) shows either the problem count with its mark, or `Synced <age>`, or `Not synced yet` when no report is published, never both a count and an age.

`problemSummary` (`frame/problem-summary.ts`) counts the problems the page can show without deriving anything new:

- **broken**: dataset entries in state `unresolvable`, except pruned ones;
- **starved**: from a `pinned-starvation` record only when it still describes the loaded curation (same pinned count and `minChunkSearches`, and something pinned).

Any broken entry gives the ✕ (broken) mark; otherwise starvation gives the ◐ (rough) mark.

`SyncReportPanel` (`frame/SyncReportPanel.tsx`) opens under the header: four equal columns with the headings `Problems`, `Sync run`, `Weights coverage` and `Built from` (`PANEL_HEADINGS` in `frame/trust-copy.ts`), with a maximum height and its own scroll. `panelColumns` (`frame/panel-columns.ts`) builds the columns from the published sync report, the weights header, the absent tolerable files, the load's `now`, the problem summary and the cross-file failures. A cross-file failure prints verbatim as `check · canonical key · detail`. Each column is a stack of figure groups made of typed segments (`frame/segments.ts`): figures, missing values, verbatim text and marks.

`frame/header-facts.ts` reads the facts as published: the weights `producer`, `generatedAt` (as a UTC date) and `gamePatch`; `Last synced` as an age from `runFinishedAt` (or `runStartedAt` on an aborted run); and the Tracked List edit date, with a *(not committed)* suffix when its clock was the file's mtime. A missing value prints as *unknown*. `frame/trust-copy.ts` holds these labels and the absence lines, which name each absent tolerable file and what its absence costs (for example `weights.json — every crafted class is unrankable.`).

## Failure screens

`FailureScreen` (`frame/FailureScreen.tsx`) has two variants, both an `alert` section:

- `refused`: a required artifact failed validation or its version check. The sentence names the file, the cause and, for a version refusal, the declared and expected versions. The page shows nothing else, because half a ranking is worse than none.
- `failed`: an artifact could not be fetched. It names the file and offers a retry, which resets the view to `pending` and loads again.

## Related

- [Web page: artifact load and ranked list](page-load-and-ranked-list.md): the load, the list, the rows and the appendix inside this frame.
- [Core: the price-trust verdict](../core/price-trust-verdict.md): the marks the sync button and the rows share.
- [Build, typecheck and deploy](../operations/build-typecheck-and-deploy.md): how the page is built and published.
