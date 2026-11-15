---
title: 'Story 7.4: The item-level toggle'
type: 'feature'
created: '2026-11-15'
status: 'ready-for-dev'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-7-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `web` ranks at a constant ilvl 82 (`FIRST_VISIT_CRAFTING_ITEM_LEVEL`), so at league start the player cannot rank for the ilvl 79 bases they hold. An entry that does not count at the level (floor above it, or unreachable under the recipe) shows today as an ordinary line with its own price trust, among the counted ones, and a class with no counted entry reads `no prices yet`.

**Approach:** Add `{components.level-toggle}` (`ilvl` · `79` `82`) to the header between the recipe and the threshold. Persist it next to the recipe, and pass it to `rank`, so the list and the filter follow it. `core` marks each not-counted combination with its reason, and adds a `nothing-counts` row reason. `web` puts those lines last behind `+ N not counted` (states 48 and 49, Interactions 1b and 3a). Fix the first-visit recipe to `perfect` when it is published (*What survives a reload*).

## Boundaries & Constraints

**Always:** The level options come from `CRAFTING_ITEM_LEVELS` only. A level switch is a synchronous re-rank: no request, no debounce, open panels stay open. Strings are verbatim from the Copy Deck (*Header, list and tooltips*). The look is DESIGN.md `level-toggle` and `expansion-line.notCounted`. Storage access is guarded as `recipe-storage.ts` is. A stored value that is not an offered level reads as absent. Floor reason wins over reach. Unreached is exactly `recipeReach` false, which is a probability result that is `empty-contained` or `p === 0`. Derive it from that result, with no second call. The rule order of `craftedTrust` is uncostable, all-broken, nothing-counts, no-prices. All-broken reads only the counted entries, as today. The first-visit recipe matches on the option word `perfect` (`recipeWord`), not the id. `RankedRow` schemas are `core` output types, not artifacts, so extending them changes no artifact schema.

**Never:** No change to `data/`, `sync`, any artifact schema, `packages/web/vite.config.ts` or an owner document (DESIGN.md, EXPERIENCE.md, spine, PRD). No Mantine `SegmentedControl` (its animated indicator is banned). No re-render of the retired state 36 reason.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| First visit | empty storage; recipes `greater`, `perfect` | `perfect` and `82` active |
| Saved recipe gone | stored `regular`, not published | first published recipe (`greater`) |
| Reload | stored `79` and `greater` | both come back |
| Bad stored level | stored `80` or junk | `82` |
| Storage throws | `getItem` and `setItem` throw | page works at first-visit values, the toggle still switches |
| Switch to 79 | click `79` | ranks, EV, verdicts and chase cells change in one render, no request |
| Floor above level | entry `itemLevelMin 82`, level 79 | line in `+ N not counted`, dimmed, price `—`, reason `needs ilvl 82`, no mark, no link |
| Unreached | `recipeReach` false at the level | reason `<recipe> orbs can't roll this at ilvl <level>` |
| Both | floor above and unreached | floor reason |
| Nothing counts | every entry of a class not counted | pending row, EV `—`, reason `nothing rolls at ilvl <level>`, trails as state 18; panel holds only `+ N not counted` |
| Nothing counts, all broken | every entry not counted and broken | `nothing rolls at ilvl <level>`, because all-broken reads counted entries only |
| Panel closes | open the group, close the row, reopen | group collapsed again |
| Filter | switch to 79, download | filter text equals the one generated from the 79 ranking |

## Decisions

- **Header overrun (human, 2026-11-15): option A.** The brand block yields as it does today (`minWidth: 0`), so the title nearly vanishes and the eyebrow is cut with an ellipsis. Measure the bar in agent-browser checks 1 and 2. Record the overrun in Implementation Notes, and append one `deferred-work.md` entry for a UX decision, with no `retry_when`. Measured before the build: controls 809.6px, brand 205.4px, eyebrow 110.6px at the target frame.

</frozen-after-approval>

## Code Map

- `packages/core/src/crafting-item-level.ts` -- `CRAFTING_ITEM_LEVELS`, `CraftingItemLevel`, exported from `core/src/index.ts:14-15`.
- `packages/core/src/rank-crafted-row.ts` -- `scanSummands` (70-105) pushes a not-counted entry (`summandProbability` 65-67: floor, or `p === 0` / `empty-contained`) to `combinations` with no mark. Add `notCounted` there: floor first, else `unreached`. `recipeReach` (`probability.ts:235`) is `ok && p > 0` over the same `combinationProbability` call, so no second call is needed. Other failures already return a pair failure. `craftedRow` passes `itemLevel` to `craftedTrust`.
- `packages/core/src/price-trust.ts:102` -- `craftedTrust`. Add the nothing-counts rule: no counted entry (`entries` empty while the class has non-pruned entries, all marked not counted).
- `packages/contracts/src/ranked-row.ts:64` -- `CraftedCombinationSchema` (strictObject): add optional `notCounted`, a union of `{kind:'floor', itemLevelMin}` and `{kind:'unreached'}`. `ranked-row/price-trust.ts` -- add `{kind:'nothing-counts', itemLevel}` to `PriceTrustReasonSchema`.
- `packages/web/src/shared/product.ts:15` -- `FIRST_VISIT_CRAFTING_ITEM_LEVEL`. Keep it as the first-visit value.
- `packages/web/src/App.tsx:119-161` -- `usePersistedThreshold`/`usePersistedRecipe` are the pattern for `usePersistedLevel`. `useRanking` (157) gets the level as an argument and a memo dependency.
- `packages/web/src/recipe/recipe-storage.ts` -- key pattern `poe-cbpc.*`, guarded read and write, `activeRecipe` (34): split "nothing stored" (perfect, else first) from "stored but gone" (first).
- `packages/web/src/recipe/CraftRecipe.tsx:57-103` -- `RecipeOptions`: the segment markup, `SEGMENT_BOX`, the `fg-recipe-segment` class (hover and pressed CSS), active as `<span aria-current>`. Extract a shared segmented group, and reuse it for the level toggle.
- `packages/web/src/frame/HeaderBar.tsx` -- `HeaderSlot`, `HEADER_SLOTS` (27), `HEADER_SLOT_WIDTHS` (17). Add `level` after `recipe` with its width measured in the browser.
- `packages/web/src/frame/header-controls.tsx` -- `pendingControls` (31) and `readyControls` (57). Render the level toggle in both, because both levels are always offered.
- `packages/web/src/list/display-rows.ts:156` -- `craftedDetail`. Today a priced not-counted entry is wrongly `isBelowThreshold`. Route `notCounted` combinations into a new `notCounted` group with their reason.
- `packages/web/src/list/ExpansionPanel.tsx` -- `ExpansionPanel` (75): top 8, `+ N more`, `+ N pruned`. Add `+ N not counted` last, with local state that resets on close. `list/ExpansionLine.tsx` gets the `notCounted` treatment. `list/row/trust-words.ts` (`FIXED_ROW_REASONS`, `lineTrustParts`) gets the new words.
- `packages/web/src/App/pick-up-filter-support.tsx:138` and `test-support/dom.tsx:99` -- test helpers that call `rank` with the constant. Let them take a level.
- `packages/web/src/pick-up-filter/PickUpFilter.tsx:190` -- purposes come from the header's `ranking`, so the level arrives with no change to `pickUpPurposes`.
- Tests to extend: `App/header-bar.test.tsx` (43 slot order, 126 contents), `recipe/craft-recipe.test.tsx:100` (click, re-rank, reload), `recipe/recipe-storage.test.ts`, `list/expansion.test.tsx`, `recipe/craft-recipe/crafted-states.test.tsx:160`, `core/src/rank/crafting-item-level.test.ts`, `pick-up-filter/filter-text-floors.test.ts`. The MSW callback lives in `test/setup.ts:91`.

## Tasks & Acceptance

**Execution:**
- [ ] `packages/contracts/src/ranked-row.ts`, `ranked-row/price-trust.ts` -- add `notCounted` and `nothing-counts`, with schema tests.
- [ ] `packages/core/src/rank-crafted-row.ts`, `price-trust.ts` -- mark not-counted combinations and the nothing-counts verdict. Add tests in `core/src/rank/crafting-item-level.test.ts` for floor, unreached, both, and nothing-counts.
- [ ] Time a full re-rank of the committed list at both levels with a scratch script outside the repo (fastest of 5, every active entry priced, as 7.3 did). Record it. If 82 passes 100 ms, stop and report.
- [ ] `packages/web/src/level/level-storage.ts` (+ test) -- `poe-cbpc.craftingItemLevel`, guarded, validated against `CRAFTING_ITEM_LEVELS`.
- [ ] `packages/web/src/recipe/recipe-storage.ts` (+ test) -- first visit `perfect`, else first. A stored id that is gone gives the first.
- [ ] `packages/web/src/recipe/CraftRecipe.tsx`, new `packages/web/src/level/LevelToggle.tsx` -- shared segmented group. Label `ilvl`, segments from `CRAFTING_ITEM_LEVELS`.
- [ ] `packages/web/src/frame/HeaderBar.tsx`, `header-controls.tsx`, `App.tsx` -- the level slot, state, persistence and `rank` input.
- [ ] `packages/web/src/list/display-rows.ts`, `ExpansionPanel.tsx`, `ExpansionLine.tsx`, `row/trust-words.ts` -- the not-counted group, the line treatment and the reasons.
- [ ] Web tests -- one per I/O row, including the no-request proof through the MSW callback and the filter-at-79 check.

**Acceptance Criteria:**
- Given the page at rest, when the header renders, then the slots read recipe, level, threshold, filter, sync, on one line.
- Given the committed Tracked List, when the level switches, then one re-rank stays under 100 ms (NFR-6).
- Given the change, when `pnpm check` runs, then it passes, and no test makes a network call.

## Verification

**Commands:**
- `pnpm check` -- expected: pass.

**Agent browser checks:** The implementing agent runs these in a named session with `pnpm dev` in the background, and runs `pnpm dev:stop` at the end.
1. **Header at the target frame (viewport 1063px):** the toggle reads `ilvl` `79` `82` after Craft Cost, with `82` active on a first visit and `perfect` active. One line. Measure the brand block, the eyebrow and the title, and record any overrun. Take a screenshot.
2. **Header at content-min (viewport 1000px):** the same measurements. Take a screenshot.
3. **Switch to 79:** with a Bows panel open, the `+ N not counted` count changes, the panel stays open, and the network log shows no new request. Take a screenshot.
4. **Not-counted group:** open a Bows row at 79 and click `+ N not counted`. The lines are dimmed but not struck through, show `—`, and give `needs ilvl <floor>` or the recipe reason, with no mark and no ↗. Take a screenshot.
5. **Reload:** after a reload, 79 and the chosen recipe come back.
6. **Hover and pressed states:** the inactive segment changes text tone on hover. The distinction is not carried by colour alone: the active segment is weight 600 with a fill. Take a screenshot.
7. **Filter modal at 79:** the download raises no page error.

## Implementation Notes

## Spec Change Log

## Review Triage Log
