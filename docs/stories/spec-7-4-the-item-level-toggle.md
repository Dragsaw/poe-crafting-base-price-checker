---
title: 'Story 7.4: The item-level toggle'
type: 'feature'
created: '2026-11-15'
status: 'done'
baseline_commit: 'f515107565cba58558510336561dfa444de0aa68'
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
- [x] `packages/contracts/src/ranked-row.ts`, `ranked-row/price-trust.ts` -- add `notCounted` and `nothing-counts`, with schema tests.
- [x] `packages/core/src/rank-crafted-row.ts`, `price-trust.ts` -- mark not-counted combinations and the nothing-counts verdict. Add tests in `core/src/rank/crafting-item-level.test.ts` for floor, unreached, both, and nothing-counts.
- [x] Time a full re-rank of the committed list at both levels with a scratch script outside the repo (fastest of 5, every active entry priced, as 7.3 did). Record it. If 82 passes 100 ms, stop and report.
- [x] `packages/web/src/level/level-storage.ts` (+ test) -- `poe-cbpc.craftingItemLevel`, guarded, validated against `CRAFTING_ITEM_LEVELS`.
- [x] `packages/web/src/recipe/recipe-storage.ts` (+ test) -- first visit `perfect`, else first. A stored id that is gone gives the first.
- [x] `packages/web/src/recipe/CraftRecipe.tsx`, new `packages/web/src/level/LevelToggle.tsx` -- shared segmented group. Label `ilvl`, segments from `CRAFTING_ITEM_LEVELS`.
- [x] `packages/web/src/frame/HeaderBar.tsx`, `header-controls.tsx`, `App.tsx` -- the level slot, state, persistence and `rank` input.
- [x] `packages/web/src/list/display-rows.ts`, `ExpansionPanel.tsx`, `ExpansionLine.tsx`, `row/trust-words.ts` -- the not-counted group, the line treatment and the reasons.
- [x] Web tests -- one per I/O row, including the no-request proof through the MSW callback and the filter-at-79 check.

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

- **NFR-6 timing** (scratch script outside the repo, committed `data/`, every active entry priced synthetically, `rank` over every recipe, fastest of 5, three runs): 60.3–61.0 ms at 79 and 91.7–92.8 ms at 82. Below 100 ms, with a thin margin at 82 (7.3 measured 88.7 ms before the not-counted marks).
- **Header measurements** (agent-browser, Inter, first visit, `perfect` and `82` active, Craft Cost `0.35 div / craft`). The level slot is 103.3px, so `HEADER_SLOT_WIDTHS.level` is 104. The controls span 913px.
  - Viewport 1063px (bar 1015px): brand block 80px. The eyebrow needs 111px and the title needs 148px, so both cut with an ellipsis. The bar stays on one line and nothing leaves it.
  - Viewport 1000px (bar 952px): brand block 17px. Both cut. One line.
  - This is the overrun of Decision A. It is recorded in `deferred-work.md` (spec-7-4, a UX decision, no `retry_when`). The static budget test in `App/header-bar.test.tsx` now asserts that the title room is above 0 and below the title width at both frames.
- **Agent-browser checks 3–7:** switching to 79 with the Bows panel open moved `+ 31 not counted` to `+ 56 not counted`. The panel stayed open, and the network log recorded no request. The not-counted lines were dimmed, not struck through, with `—`, `needs ilvl 81` or `needs ilvl 82`, no mark and no link. After a reload, `greater` and `79` came back. The inactive segment went from text-secondary to text on hover with a pointer cursor. The active segment was weight 600 on the accent-soft fill. The filter download at 79 raised no page error.
- `core` sorts not-counted combinations after the counted ones (`compareCombinations`). `web` groups them by the `notCounted` field, not by position.
- The segment CSS moved from `recipe/recipe.css` to `shared/segmented.css` (class `fg-segment`), and both toggles use `shared/SegmentedGroup.tsx`. The line builders moved to `list/expansion/class-lines.ts` because `list/` hit its 25-file cap.
- Tests that assumed `greater` on a first visit now store `greater` first. This covers `ready()` in `App/pick-up-filter-support.tsx` and `beforeEach` in three `craft-recipe/` files, so they keep their figures. The first-visit `perfect` has its own tests.
- The three spec-7-1 entries in `deferred-work.md` that this story lands (the not-counted marker, `nothing rolls at ilvl <level>` and the transcription of `level-toggle`) are still in the file. Remove them in the last commit of the branch.
- The I/O-row web tests, the filter-at-79 check among them, are in `packages/web/src/level/level-toggle.test.tsx`. The no-request proof spies on `fetch` around the click, as the recipe-download test does, and the MSW callback in `test/setup.ts` still guards every test. `test-support/dom.tsx:99` keeps the first-visit constant: it ranks with `weights: undefined` and raw entries only, so the level cannot change its result. `expectedFilterText` in `App/pick-up-filter-support.tsx` takes a level.
- Agent-browser check 6 tried the hover state only. The pressed state (`:active`) is the same `fg-segment` CSS rule that the recipe toggle uses.

### Agent browser checks (after review)

- Session: `poe-79ae64f4395d`. `pnpm dev` ran in the background on port 5173, and `pnpm dev:stop` stopped it at the end.
- Local time of the run: 2026-11-15 15:37:27 to 15:38:53 WEST.
- `git rev-parse HEAD`: `f515107565cba58558510336561dfa444de0aa68`. The tree was dirty: 47 `git status --porcelain` entries, which hold the uncommitted 7.4 work including every review fix.
- All 7 checks pass.

1. **Header at the target frame (viewport 1063px, bar 1015px)**, first visit with storage cleared. The slots read recipe, level, threshold, filter, sync on one line (bar height 64px). The toggle reads `ilvl` `79` `82` after Craft Cost, with `perfect` and `82` active. Measurements: recipe 274.2px, level 103.3px, threshold 248.5px, filter 65px, sync 134px, controls 913px. The brand block is 80px. The eyebrow `Forbidden Rites` needs 111px and the title needs 148px, so both are cut to 80px with an ellipsis. This is the Decision A overrun. Screenshot: `C:\Users\ilyal\AppData\Local\Temp\claude\26e3858fb0c54881\079f299e-cdf7-4aee-a534-c84bd5cd3933\scratchpad\after-review\check1-header-1063.png`
2. **Header at content-min (viewport 1000px, bar 952px).** One line. The control widths are the same, controls 913px. The brand block is 17px, and the eyebrow (111px) and title (148px) are both cut to 17px. Screenshot: `C:\Users\ilyal\AppData\Local\Temp\claude\26e3858fb0c54881\079f299e-cdf7-4aee-a534-c84bd5cd3933\scratchpad\after-review\check2-header-1000.png`
3. **Switch to 79 with the Bows panel open.** `+ 31 not counted` became `+ 56 not counted`, and `+ 52 more combinations` became `+ 27`. The panel stayed open. The network log was cleared before the click and recorded no request after it. Screenshot: `C:\Users\ilyal\AppData\Local\Temp\claude\26e3858fb0c54881\079f299e-cdf7-4aee-a534-c84bd5cd3933\scratchpad\after-review\check3-switch-to-79.png`
4. **Not-counted group (Bows at 79, `perfect`).** `+ 56 not counted` opened to 56 lines. The combination and its tiers are in text-tertiary, rgb(138, 138, 142); the counted lines are in rgb(136, 136, 255). The lines are not struck through. Every price is `—`. The trust cell holds the reason alone in text-secondary, rgb(154, 154, 154): `needs ilvl 81` or `needs ilvl 82`. No line has a mark or a ↗. This Bows set at 79 has no unreached entry, so the recipe reason did not occur here. `level-toggle.test.tsx` and `crafted-states.test.tsx` cover it. Screenshot: `C:\Users\ilyal\AppData\Local\Temp\claude\26e3858fb0c54881\079f299e-cdf7-4aee-a534-c84bd5cd3933\scratchpad\after-review\check4-not-counted-lines.png`
5. **Reload.** I switched the recipe to `greater`, so storage held `79` and `greater`. After the reload, `greater` and `79` were active again, and no panel was open.
6. **Hover and pressed states.**
   - At rest, the inactive `82` is rgb(154, 154, 154), weight 400, cursor pointer, with no fill. The active `79` is weight 600 and accent rgb(191, 167, 122) on the accent-soft fill rgba(191, 167, 122, 0.14), with cursor default.
   - Hover on `82`: the text went to rgb(217, 217, 217), and the fill did not change. Screenshot: `C:\Users\ilyal\AppData\Local\Temp\claude\26e3858fb0c54881\079f299e-cdf7-4aee-a534-c84bd5cd3933\scratchpad\after-review\check6-hover.png`
   - Pressed: the mouse went down on `82` and stayed down. `:active` matched, and the computed background was rgb(44, 44, 49), which is `--fg-color-surface-raised` #2C2C31. Screenshot: `C:\Users\ilyal\AppData\Local\Temp\claude\26e3858fb0c54881\079f299e-cdf7-4aee-a534-c84bd5cd3933\scratchpad\after-review\check6-pressed.png`
   - On release, the click switched to `82`. I clicked `79` again before check 7.
   - The active segment differs by weight and fill, not by colour alone.
7. **Filter modal at 79** (`greater`, `79`). With the name `My` the download was enabled. Clicking it closed the modal. The page recorded no `error` and no `unhandledrejection`, and the console had no errors. Screenshot: `C:\Users\ilyal\AppData\Local\Temp\claude\26e3858fb0c54881\079f299e-cdf7-4aee-a534-c84bd5cd3933\scratchpad\after-review\check7-filter-modal-79.png`

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | verification-gap | Core sort test passes with the not-counted clause of `compareCombinations` removed | medium | `cheap` (floor 75) already sorts before `top` (floor 82) by verdict tie and canonical key | patch |
| 2 | verification-gap | No test clicks the level toggle while pending | medium | Filed pre-verified: cold-load test only finds the toggle; all level tests click after `ready()` | defer |
| 3 | deferred-ledger | Check 6 tried hover only, not pressed | low | Implementation Notes say so; the spec's check 6 names both states | patch (run in the after-review browser checks) |
| 4 | ocr | `notCountedCopy` duplicates `prunedCopy` | low | Same glyph and count format in two bodies; one can drift from the other | patch |
| 5 | ocr | `./level` import splits the `./frame/*` imports in `App.tsx` | low | Lint does not enforce it; direct correction | patch |
| 6 | ocr | Type cast on a DOM node in `level-toggle.test.tsx` | low | `as HTMLElement` where `getAttribute` needs no cast | patch |
| 7 | blind | sprint-status `in-progress` vs spec `in-review` | false | The story key moves to `review` only after the after-review browser record (agent-browser-checks rule 7) | reject |
| 8 | blind | `nothing rolls at ilvl 82` for tag-blocked classes misleads | false | Matrix row "Nothing counts" and the Copy Deck define not counted as floor or unreached at any level; the words are verbatim | reject |
| 9 | blind | Nothing-counts rests on an unasserted invariant | false | `rank.ts:280` drops pruned entries and `rankCraftedClass` returns when no keyed entry exists, so a crafted pair always has a non-pruned entry | reject |
| 10 | blind | `nothing-counts.itemLevel` schema differs from `ItemLevelSchema`; `core` types it `number` | low | Schema: same constraint (`int().min(1)`), no harm. Type: direct correction to `CraftingItemLevel` | patch (type only) |
| 11 | blind, edge-case | `craftedDetail` throws with no recipe word | false | Crafted rows exist only when a recipe is costed (`rank.ts` fills `recipeless` otherwise), and `App.tsx` always passes `recipe?.word`; `dom.tsx:99` ranks with no weights, so no crafted row | reject |
| 12 | blind | Header budget test locks in the overrun, `> 0` is vacuous | false | Decision A accepts the overrun; at content-min the brand block is 17px, so no eyebrow minimum can hold; the deferred UX entry owns the flip | reject |
| 13 | blind | Header test comment narrates a decision | low | AGENTS.md comment rule | patch |
| 14 | blind | 148px vs `HEADER_TITLE_WIDTH` 149 | low | Measured vs rounded-up constant; the fix edits this spec's notes | reject |
| 15 | blind | No-request proof is a fetch spy, not the MSW callback | low | MSW intercepts `fetch`, so the spy sees every request the callback would, handled ones too; ranking is a sync memo with no effect; a request listener adds complexity | reject |
| 16 | blind | `filter-text-floors.test.ts` not extended | low | Matrix row "Filter" is covered and ran in `level/level-toggle.test.tsx` | reject |
| 17 | blind, edge-case | Not-counted group state survives a level switch to count 0 and back | false | EXPERIENCE.md Interaction 3a resets the group only when the panel closes; open panels stay open across a switch | reject |
| 18 | blind | Unreached reason not tested across a recipe switch; pinned not-counted line untested | low | Reason follows the memo's `recipe` dependency; test-only gaps unlikely to regress | reject |
| 19 | blind | `aria-label="ilvl"` duplicates the visible label | false | Accessibility Floor (AGENT-WORKFLOW.md *Review brief* rule 1); the recipe toggle has the same shape | reject |
| 20 | blind | Removal of the three landed spec-7-1 ledger entries is untracked | low | AGENTS.md: remove in the last commit of the branch that lands the work | patch (at commit) |
| 21 | edge-case | Recipeless rows show floor-82 lines as ordinary at 79 | low | State 43 rows have no EV, so no line counts toward anything; marking them needs a new `core` branch | reject |
| 22 | impeccable | Level slot makes the eyebrow cut (DESIGN.md `header-bar.layout`) | false | Human Decision A; recorded in `deferred-work.md` as a UX decision | reject |
