---
title: 'Jewel Craft Cost is 0 under every recipe'
type: 'bugfix'
created: '2026-10-23'
status: 'done'
baseline_commit: '1a4a4c99212769f604e4c83874753a1af3ed77a1'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `rank` subtracts the active recipe's Craft Cost (greater or perfect transmute plus augment) from every crafted row, the `jewel` category included. Greater and perfect currency does not affect jewel mods, so a player crafts jewels with basic currency, and the jewel EV comes out too low by the recipe cost (deferred-work entry, source `ARCHITECTURE-SPINE.md`, AD-20, FR-26).

**Approach:** In `core`, a crafted row whose `categoryId` is `jewel` gets Craft Cost `0` under every recipe, so its EV equals its gross payout. Raw rows already carry `0`. Other classes keep the recipe's cost.

## Boundaries & Constraints

**Always:** The predicate is the trade category `jewel` (all eight jewel classes), owned by `core` code and its tests (AGENTS.md owners). The recipe's `modifierLevelMin` floor still applies to jewel rows unchanged. `craftCost` and the header's recipe cost (`packages/web/src/recipe/recipe-view.ts`) stay per recipe.

**Never:** No change to `data/recipes.json`, `contracts` schemas or a new recipe. No UI copy other than the jewel context-line clause of EXPERIENCE.md rev 31 (memlog 294). The header Craft Cost and the EV tooltip stay unchanged. No spine edit. Do not apply the zero to raw rows (already `0`) or to any non-jewel category.

**Decisions:**
- A jewel row under an uncostable recipe stays uncostable. The zero applies only when the recipe is costable, so FR-26's uncostable consequences hold unchanged.
- The rule is written as one consequence line of `prd.md` FR-26 in this branch: "A jewel's Craft Cost is 0 under every recipe: greater and perfect currency does not affect jewel mods, so jewels are crafted with basic currency *(PRD-owned)*."

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Jewel, costable recipe | Emerald class, recipe `greater` with rates | `craftCost: 0`, `ev === grossPayout` | N/A |
| Non-jewel, costable recipe | Bows, recipe `greater` with rates | `craftCost === GREATER_COST`, unchanged | N/A |
| Jewel, nothing clears | Emerald, no summand above threshold | `ev: 0`, `summands: []` | N/A |
| Jewel, uncostable recipe | Emerald, recipe with a missing rate | stays uncostable: `craftCost: { kind: 'uncostable' }`, `ev: null`, like every crafted row of that recipe | N/A |

</frozen-after-approval>

## Code Map

- `packages/core/src/rank.ts` -- `rankCraftedClass` loops `costed` and passes `cost` to `craftedRow`; override the cost here when `isJewelCategory(first.categoryId)`. `costed` is built once per recipe in `rank`; `uncostableOf(costed)` feeds `Ranking.uncostableRecipes` and must stay per recipe.
- `packages/core/src/rank-crafted-row.ts` -- `craftedRow` maps `cost` to `craftCost`, `ev` and `craftedTrust({ uncostable })`; no change needed if the override passes an `ok` result `{ ok: true, divine: 0, asOf: [] }`.
- `packages/core/src/craft-cost.ts` -- `CraftCostResult`; reuse the type, do not change `craftCost`.
- `packages/core/src/rank-raw-groups.ts:73` -- raw rows' `craftCost: 0`, the precedent.
- `packages/web/src/recipe/recipe-view.ts` (`recipeCostLine`, `expectedValueCost`), `packages/web/src/App.tsx:201`, `packages/web/src/list/row/ExpectedValueTooltip.tsx` -- the header Craft Cost and the EV tooltip are per recipe, on the column header, not per row; unchanged (Never).
- `packages/core/src/index.ts` -- export the jewel predicate (`isJewelCategory`, defined in `craft-cost.ts`) beside `craftCost`, so `web` reads the rule from `core` and does not restate `'jewel'`.
- `packages/web/src/list/display-rows.ts` -- `ClassDisplayRow` has no `categoryId`; add `isJewel`, set in `classRow` (line 231). `figure(ev)` sets `negative` from the printed minus or `< 0.00`; state 21's jewel `0.00` needs a dim too: `classRow` passes `row.summands.length === 0` as an extra dim input. `ExpectedValueCell.tsx:40` consumes `negative`; keep the field name.
- `packages/web/src/list/format.ts` (`ESTIMATED_ODDS_CONTEXT`), `packages/web/src/list/ExpansionPanel.tsx` (`ContextLine`, line 43), `packages/web/src/list/expansion.test.tsx` -- the context line and its ≈ clause. Add `JEWEL_CONTEXT = 'No Craft Cost: jewels craft with basic orbs.'` (Copy Deck, EXPERIENCE.md line 440) after the ≈ span, joined with `JOINER`, when `row.unit === 'class' && row.isJewel && row.ev.kind === 'figure'`.
- `packages/core/src/rank/crafted-branch.test.ts`, `packages/core/src/rank/test-support.ts` -- `chase`, `poolsFile`, `rankCrafted`, `GREATER`, `GREATER_COST`, `published`, `priced`; add jewel cases here.
- `data/weights.json` -- every Emerald entry has `itemLevelMin` 75, so both recipes' floors (44, 70) keep the whole pool; jewel rows are equal under both recipes after this change.

## Tasks & Acceptance

**Execution:**
- [x] `packages/core/src/craft-cost.ts`, `index.ts`, `rank.ts` -- add and export `isJewelCategory` from `craft-cost.ts`; in `rankCraftedClass`, pass `{ ok: true, divine: 0, asOf: [] }` for a `jewel` class when the recipe's cost is `ok`; pass the uncostable result through unchanged -- the cost is per class, the recipe stays per recipe.
- [x] `packages/core/src/rank/crafted-branch.test.ts` -- cover the I/O matrix rows with a `jewel`/`Emerald` class beside a non-jewel class under one recipe.
- [x] `packages/web/src/list/display-rows.ts`, `format.ts`, `ExpansionPanel.tsx`, `expansion.test.tsx`, `display-rows.test.ts` -- a crafted `jewel` row whose EV is a figure ends its context line with the Copy Deck jewel clause, after the ≈ clause when both apply; a jewel row with EV `—` has no clause. A jewel at EV `0.00` is dimmed (state 21).
- [x] `docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md` -- add the FR-26 consequence line of the Decisions, after the uncostable lines.
- [x] `docs/stories/deferred-work.md` -- remove the jewel Craft Cost entry in the last commit of the branch.

**Acceptance Criteria:**
- Given the committed data, when the player switches between `greater` and `perfect`, then each Emerald row's EV is the same under both and equals the sum of its expansion's summand contributions.
- Given a jewel class and a non-jewel class under one costable recipe, when `rank` runs, then only the non-jewel row subtracts the recipe cost.
- Given an expanded jewel row with a figure, then its context line holds the Copy Deck jewel clause; under an uncostable recipe it does not.

## Verification

**Commands:**
- `pnpm --filter @poe/core test` -- expected: pass, new jewel cases included.
- `pnpm check` -- expected: pass.

**Agent browser checks:**
- Under recipe `greater`, expand an Emerald row; expected: its EV equals the sum of its summand contributions at 2 dp, and its context line ends with the jewel clause; screenshot.
- Switch to recipe `perfect`; expected: the same Emerald row shows the same EV as under `greater`; screenshot.
- Note a non-jewel crafted row's EV under both recipes; expected: it differs by more than zero, in line with the two header Craft Cost figures; screenshot.

## Review Triage Log

| # | Layer | Finding | Verdict | Route | Evidence |
|---|-------|---------|---------|-------|----------|
| 1 | edge, blind, design | A jewel's dimmed `0.00` has no minus, so the dim is tone alone against the Accessibility Floor | low | defer | State 21 rev 31 (memlog 294, user ruling) requires the dim; the Floor names only minus and `< 0.00`. Owner-doc conflict: `[NOTE FOR UX]` in deferred-work.md. |
| 2 | blind, design | Two stacked JSDoc blocks on `figure()`; the first is orphaned and outdated | low | patch | `display-rows.ts:34-35`; merged into one. |
| 3 | blind | `core/index.ts` comment says Craft Cost is "never `0`" over the jewel export | low | patch | Reworded: `craftCost` per recipe, jewel class `0` under a costable recipe. |
| 4 | design | `ContextLine` JSDoc omits the jewel clause | low | patch | `ExpansionPanel.tsx:42`. |
| 5 | blind | UJ-2 "Jewel rows do not move" is wrong: rank position can move | low | defer | Ordering is by EV and non-jewel EVs change per recipe. UX doc: `[NOTE FOR UX]`. |
| 6 | edge | A jewel's EV still varies per recipe through `modifierLevelMin`; guard by zeroing the floor | false | reject | Frozen intent keeps the floor. On committed data the Emerald EV is 0.190678… under both recipes (rank run, browser check). |
| 7 | edge | A jewel whose summands total under 0.005 prints `0.00` undimmed | false | reject | `formatDivine` prints `< 0.01` for `0 < v < 0.005` (`shared/money.ts:28`). |
| 8 | edge, blind | PRD line "under every recipe" contradicts the uncostable exemption | false | reject | The frozen Decisions fix the PRD text verbatim and the uncostable lines above it govern; the fix edits the intent. |
| 9 | edge, blind | AC 1 (greater equals perfect) has no automated test; matrix not in `crafted-branch.test.ts` | low | reject | AC 1 is over the committed data, verified by rank run and browser check; a generic test cannot assert equality because the floor applies. The new file exists because of the 300-line lint cap. |
| 10 | blind | Comment for the jewel rule sits on the predicate, not on `JEWEL_CRAFT_COST` | low | reject | Cosmetic; the comment states the rule the predicate selects. |
| 11 | blind | State 25 "the figures tie" is now false | false | reject | Under one recipe non-jewel rows still tie at minus the cost and jewels tie at `0.00`; AD-17's tiebreak still orders each tie. |
| 12 | blind | EV tooltip formula is false for jewel rows | false | reject | Intent: "The header Craft Cost and the EV tooltip stay unchanged" (memlog 294 rejected a tooltip clause). |
| 13 | blind | `jewel-row.test.ts` builds `ordering` by hand, so a `core` regression would pass | false | reject | The `core` rule is covered by `jewel-craft-cost.test.ts`; the web test covers display only. |
| 14 | blind | The `summands.length === 0` dim applies to every class; combos untested; allowlist comment cites FR-26 | low | reject | A non-jewel no-summand row is already negative and dimmed; a jewel with summands is never 0 exact. No changed outcome. |
| 15 | blind | `JEWEL_CRAFT_COST.asOf: []` drops rate dates | false | reject | No row or surface reads the cost's `asOf` (`rank-crafted-row.ts:59`; grep). |

## Implementation Notes

- The I/O matrix is covered in a new `packages/core/src/rank/jewel-craft-cost.test.ts`: `crafted-branch.test.ts` is at the 300-line lint cap.

### Agent browser checks (after review)

Session `poe-5c3930e75846`, run 2026-10-23 22:24 local, against HEAD `1a4a4c99212769f604e4c83874753a1af3ed77a1` with a dirty tree (this change uncommitted), after the last review fix and a passing `pnpm check`.

- `greater` (header `< 0.01 div / craft`): Emerald EV `0.19`; the expanded context line ends `· No Craft Cost: jewels craft with basic orbs.` after the ≈ sentence. EV equal to the sum of summand contributions is checked in `core` (`ev === grossPayout` test; rank run on committed data, 0.190678… both), since the panel prints prices, not contributions. Screenshot: `C:\Users\ilyal\AppData\Local\Temp\claude\C--Users-ilyal-orca-workspaces-poe-crafting-base-price-checker-jewel-craft-price\702537f5-948e-4c08-aebd-13ded216f14d\scratchpad\after-review-emerald-greater.png`.
- `perfect` (header `0.27 div / craft`): Emerald EV `0.19`, the same as under `greater`. Screenshot: `C:\Users\ilyal\AppData\Local\Temp\claude\C--Users-ilyal-orca-workspaces-poe-crafting-base-price-checker-jewel-craft-price\702537f5-948e-4c08-aebd-13ded216f14d\scratchpad\after-review-perfect.png`.
- Non-jewel row Bows: `0.02` under `greater`, `−0.02` under `perfect`: it differs, and it falls with the higher Craft Cost. Screenshot: `C:\Users\ilyal\AppData\Local\Temp\claude\C--Users-ilyal-orca-workspaces-poe-crafting-base-price-checker-jewel-craft-price\702537f5-948e-4c08-aebd-13ded216f14d\scratchpad\after-review-bows-perfect.png`.
- `pnpm dev:stop` freed port 5173; the browser is closed.
