---
title: 'Story 7.1: The recipe floor per modifier, after the level scope'
type: 'bugfix'
created: '2026-11-14'
status: 'ready-for-dev'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/docs/stories/epic-7-context.md'
  - '{project-root}/docs/epics.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** `core` applies the recipe floor per `modGroup` on the unscoped pool, before the item-level scope. A greater or perfect recipe therefore loses tiers that the game can roll, for example T2 Cold Spell levels on an ilvl 79 Wand under perfect. One unreachable entry also makes its whole `(itemClass, recipe)` pair unrankable (`RECIPE_UNREACHABLE`, the retired state 36).

**Approach:** Use the AD-17 order: scope to `L`, then floor each modifier (one `modGroup` plus one line set) on its own, then renormalise, exclude and renormalise. Pass `L` as an explicit value. Until 7.2 the value is the entry's own `itemLevelMin`. The reach verdict becomes per `(entry, recipe, L)`, and an unreachable entry is not a summand. `tracked:check` fails only for an entry that no recipe reaches at any offered level, and those levels are exported once from `core`.

## Boundaries & Constraints

**Always:** Cite AD-17, FR-26, FR-38 and FR-4. Do not copy their text into comments. A transform truncates and renormalises, and it never reweights. `modifierLevelMin = 0` runs the same code path and changes nothing. A modifier is the key `[modGroup, lineSet(entry)]`. Its highest tier is its best tier with positive weight among the tiers with `itemLevelMin <= L`. Its tiers below the floor go only when one of its positive-weight scoped tiers is at or above the floor. The offered levels `[79, 82]` live in one exported `core` constant. The edge-case fixture uses real Wand tiers, copied verbatim from `data/weights.json`, because NFR-2 requires real data.

**Never:** No `L` in `rank`'s input and no UI. Those belong to 7.2 and 7.4. No change to `data/tracked.json` or to any artifact schema. No change to the shared-floor check or to `pairOverlap` (7.2). Never edit an owner document (PRD, spine, `EXPERIENCE.md`). Do not rewrite other entries in `deferred-work.md`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Error Handling |
|---|---|---|---|
| Tier at or above the floor | modifier tiers 40, 75 at L 82, floor 70 | only the 75 survives | — |
| All scoped tiers below the floor | tiers 55, 81 at L 79, floor 70 | the 55 survives at its own weight | — |
| Top tier above L | tiers 60, 80 at L 79, floor 44 | the 60 survives, and 80 is out of scope | — |
| Two modifiers in one `modGroup` | Cold (55, 81) and Fire (55, 75) in `IncreaseSocketedGemLevel`, L 79, floor 70 | Cold keeps 55, Fire keeps 75 | — |
| Floor 0 | any pool | equals the scoped pool | — |
| Entry `empty-contained` or `p === 0` at its scope | `rank` | not a summand, out of the trust sums, still listed in `combinations`. The pair still ranks. With nothing counted, the pair goes to `unpricedCrafted` (`no-prices`) | — |
| `empty-eligible-pool` at the scope | `rank` | pair unrankable, reason `pool empty`, with `recipeId` | — |
| `augment-exhausted` | `rank` | pair unrankable, reason `augment exhausted`, with `recipeId` | — |
| Class pool total weight 0 | `rank` | class unrankable, reason `pool empty`, no `recipeId` | — |

</intent-contract>

## Code Map

- `packages/core/src/probability.ts` -- `floored` (L130) is the old per-`modGroup` floor. Delete it. `eligible` (L143) becomes scope, then floor per modifier. `combinationProbability` (L267), `affixProbability` (L195) and `recipeReach` (L155) read the scope from `entry.itemLevelMin`. `ProbabilityReason` kinds stay as they are.
- `packages/core/src/provenance.ts:23` -- `foldPair` takes the scope from `entry.itemLevelMin`.
- `packages/core/src/rank-crafted-row.ts:55` -- `scanSummands` returns `undefined` on any failure or `p === 0`. That is the backstop to remove.
- `packages/core/src/rank.ts` -- `RECIPE_UNREACHABLE` (L118), the `isEmptyPool` cause (L144), the per-pair unrankable (L255), and the doc text of `UnrankableReason` and `UnrankableClass.recipeId`.
- `packages/core/src/cross-file.ts:69` -- calls `eligible(pool, floor, 0)`. Floor 0 keeps it identical, so leave it.
- `packages/core/src/index.ts` -- exports `floored`, `RECIPE_UNREACHABLE` and `recipeReach`.
- `packages/sync/src/curation/check.ts:212-263` -- `classUnreachable` lists `(entry, recipe, slot)` rows.
- `.claude/skills/tracked-json/scripts/lookup-mods.ts:116-147` -- the `tiers` flag `reached` comes from `floored` on the unscoped pool.
- `.claude/skills/tracked-json/SKILL.md` lines 12 and 37 (step 4b) -- the `unreachable` rule and the `recipes` field.
- `packages/web/src/list/UnrankableAppendix.tsx:14,35` -- `APPENDIX_NOTES` and the state 36 branch.
- Tests to update: `packages/core/src/probability.test.ts`, `probability/blocking-tags.test.ts`, `rank/blocking-tags.test.ts`, `rank/provenance.test.ts`, `packages/sync/src/curation/check*.test.ts`, `lookup*.test.ts`, `packages/web/src/list/unrankable-appendix.test.tsx`, `packages/web/src/App/raw-ranks-note.test.tsx`.
- Real data: the Wands (`weapon.wand`) suffix `explicit.stat_2254480358` has T2 `[4,4]` at ilvl 55 and T1 `[5,5]` at 81, in `modGroup` `IncreaseSocketedGemLevel`. The prefix `explicit.stat_2505884597` (`ColdDamage`) has T2 `[25,27]` at ilvl 60 and T1 at 80. Perfect has `modifierLevelMin` 70. `test/fixtures/frozen-data/weights.json` has no Wands.

## Tasks & Acceptance

**Execution:**
- `packages/core/src/crafting-item-level.ts` (new) -- export `CRAFTING_ITEM_LEVELS = [79, 82] as const` with an FR-38 citation. Re-export it from `index.ts`.
- `packages/core/src/probability.ts` -- add `RecipeScope { itemLevel; modifierLevelMin }`. Rewrite `eligible(pool, itemLevel, modifierLevelMin)` per the Always rules and delete `floored`. `affixProbability`, `combinationProbability(pools, {prefix, suffix}, scope)` and `recipeReach(pools, entry, scope)` take `RecipeScope`. Update the export list in `index.ts`.
- `packages/core/src/provenance.ts` -- `foldPair(pools, entry, scope)`.
- `packages/core/src/rank-crafted-row.ts` -- pass `{ itemLevel: entry.itemLevelMin, modifierLevelMin }` until 7.2. Sort each entry into one of three outcomes: counted; not counted (`empty-contained` or `p === 0`, still listed in `combinations`, no `gross` in the trust sums); or a pair failure that carries its reason (`empty-eligible-pool` → `pool empty`, `augment-exhausted` → `augment exhausted`).
- `packages/core/src/rank.ts` -- delete `RECIPE_UNREACHABLE`. `UnrankableReason` gains `'pool empty'` and `'augment exhausted'`, the causes `core` observed (AD-17, FR-4 paragraph). The empty class pool reports `pool empty`. A pair failure reports its own reason, with `recipeId`.
- `packages/sync/src/curation/check.ts` -- `unreachable` lists each crafted entry with no reach under any recipe at any `CRAFTING_ITEM_LEVELS` value. There is one row per entry, `{path, entryKey}`, sorted by canonical key. Update the doc comments.
- `.claude/skills/tracked-json/scripts/lookup-mods.ts` -- `recipes` gets one item per (recipe, level): `{recipeId, modifierLevelMin, itemLevel, reached}`. `reached` is true when the tier is in `eligible(pool, itemLevel, modifierLevelMin)`.
- `.claude/skills/tracked-json/SKILL.md` -- give step 4b and the `tiers` description the new `recipes` shape, and make line 12 match the command.
- `packages/web/src/list/UnrankableAppendix.tsx` -- remove the `RECIPE_UNREACHABLE` branch and the state 36 doc text. The new reasons take no note, and state 16's note applies to them as to any other reason.
- `test/fixtures/wands-weights.json` (new) -- a weights envelope of `data/weights.json`'s `weapon.wand` `Wands` pools, copied verbatim, with the source `gamePatch` and `producer` kept. Add a note to `test/fixtures/frozen-data/README.md` or next to the file.
- Tests -- cover every row of the I/O matrix (synthetic tiers are fine there), the Wand fixture, the `check.ts` rule across levels, the lookup shape, and the web appendix with the new reasons. Drop the tests of the retired behaviour.
- `docs/stories/deferred-work.md` -- append one entry: FR-4 and the `EXPERIENCE.md` Copy Deck name no words for `pool empty` or `augment exhausted`. AD-17 calls that a PRD finding. Set `retry_when: never — needs a human`.

**Acceptance Criteria:**
- Given the Wand fixture and the entry prefix band `25–27` with suffix band `4–4`, when `core` computes under perfect (70), then at L 79 `recipeReach` is reached and `combinationProbability` is above 0, and at L 82 it is not reached.
- Given a fixture with all four modifier shapes of the matrix, when `core` computes the perfect-recipe probabilities, then each equals a hand-computed value under the per-modifier rule.
- Given `(entry, recipe, L)`, when `recipeReach` and the lookup `tiers` both judge it, then both read `eligible` with the same scope.
- Given the committed `data/tracked.json`, when `pnpm tracked:check` runs, then it exits 0 with `unreachable: []`, and `pnpm test:data` passes.
- Given a class with an unreachable entry and a reachable one under a recipe, when `rank` runs, then the pair ranks with the reachable entry's summand only, and `unrankable` has no row for it.
- Given the code, when you search `packages/` for `RECIPE_UNREACHABLE` and `recipe cannot reach this class`, then nothing matches outside `dist/`.

## Spec Change Log

## Review Triage Log

## Design Notes

**Why the new reason names.** AC 7 removes the recipe-unreachable reason. AC 8 keeps the empty pool and the exhausted augment unrankable, each "under its own reason". AD-17 says that `core` reports the cause it observed, and that a missing FR-4 member is a PRD finding, not a licence to relabel the cause. So `core` names the observed causes plainly (`pool empty` sits beside `pool partial`), and the gap goes on the deferred-work ledger. Real data hits neither cause today: the floor never removes a modifier, so an exhausted augment needs one modifier to exclude the whole other slot.

**Why the filter golden may move.** The perfect-recipe EVs change, so `packages/web/src/pick-up-filter/filter-text.test.ts` may change too. If it does, check that every changed block comes from a corrected EV, update the golden, and list the blocks in Implementation Notes.

## Verification

**Commands:**
- `pnpm check` -- expected: passes.
- `pnpm tracked:check` -- expected: exit 0, `unreachable: []`.
- `pnpm tracked:lookup tiers explicit.stat_2254480358 --class Wands` -- expected: T2 is `reached` for perfect at 79 and not at 82.

**Agent browser checks:** The implementing agent runs these itself. Use a named session (`agent-browser session id --scope worktree --prefix poe`, then `--session <id>` on each call), run `pnpm dev` in the background, and run `pnpm dev:stop` at the end.
1. **Perfect list:** open the app and choose perfect. Expected: crafted rows render, no console error, and no page text `recipe cannot reach this class`. Take a screenshot.
2. **Greater list:** switch to greater. Expected: the list re-ranks, there is no console error, and the appendix has no `recipe cannot reach this class` row. Take a screenshot.
3. **A Wand row:** open a Wands row under perfect. Expected: the expansion lists its combinations and the EV is a figure. Take a screenshot.
