---
title: 'Story 4.7: The recipe floor per modifier group'
type: 'bugfix'
created: '2026-10-10'
status: 'in-progress'
baseline_commit: '566ab0c1c1bef5ed6c50fc34bdc2ef04fea328a0'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/sprint-change-proposal-2026-10-10.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** AD-17 models a recipe's `modifierLevelMin` as a cut of every tier below the floor. In the game the floor never removes a modifier type: a group whose top tier sits below the floor still rolls that top tier. Every greater and perfect ranking is wrong, and `tracked:lookup` advises pruning reachable picks.

**Approach:** Apply the floor per `modGroup` of each slot, as decided in section 1 of the sprint change proposal (`docs/sprint-change-proposal-2026-10-10.md`). `core` exposes a reach verdict per `(entry, recipe)` that replaces `canRecipeRoll`. `pnpm tracked:check` gains an `unreachable` list. The docs edits of proposal section 4 land in the first commit of the branch.

## Boundaries & Constraints

**Always:**
- A group with a tier at or above the floor loses only its tiers below the floor. A group whose top tier is below the floor keeps that top tier alone, at its own weight. The floor never removes a whole group (AD-17 as rewritten).
- The group's top tier is taken from the unscoped pool. Item-level scope (AD-5) still applies after, so a group whose top tier is above the entry's item level and whose other tiers are below the floor contributes nothing.
- A hybrid `modGroup` is its own group. Groups are keyed by `modGroup` alone and never merged by `statId`.
- Survivors renormalise before containment. Coverage stays on the unrestricted pool (AD-17, AD-27).
- `modifierLevelMin` `0` goes through the same code path and changes nothing.
- Ranking keeps the backstop: an unreachable entry makes its `(itemClass, recipe)` pair unrankable.
- The first commit carries the docs edits and, in its message, the decision and the three rejected alternatives that proposal section 5 names.

**Never:**
- No change to `data/weights.json`, the weights schema, `sync` run logic or any `web` file.
- No `P = 0` for an unreachable entry, and no new unrankable reason.
- No restoring of the 104 pruned `tracked.json` entries. That is the follow-up step 2 of the proposal.
- No PRD edit.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Group above floor | Group tiers at 30, 60, 75; floor 70; entry ilvl 82 | Only 75 survives | N/A |
| Group below floor | Group tiers at 10, 40; floor 70 | Only 40 survives, weight unchanged | N/A |
| Top above item level | Group tiers at 20, 85; floor 70; entry ilvl 82 | Nothing survives from the group | N/A |
| Floor 0 | Any pool | Same set as the item-level scope alone | N/A |
| Unreachable entry | Entry's band contains only tiers the floor removes | Reach verdict false; `tracked:check` lists the pair under `unreachable`, exit 1; ranking drops the pair | N/A |
| Recipes file absent | No `data/recipes.json` | Reach check `skipped`, no `unreachable` entries | Not a failure |
| Recipes file refused | Invalid `data/recipes.json` | Reach check `failed` with the refusal message | Exit 1 |

</frozen-after-approval>

## Code Map

- `packages/core/src/probability.ts` -- `eligible` (one-axis filter, line 125) and `canRecipeRoll` (line 134). `affixProbability` and `combinationProbability` call `eligible` and must not change otherwise.
- `packages/core/src/provenance.ts` -- `foldPair` folds over `eligible`; follows it with no own change.
- `packages/core/src/cross-file.ts:67` -- calls `eligible(pool, floor, 0)`; behaviour must stay the same.
- `packages/core/src/rank-crafted-row.ts` -- `scanSummands` returns `undefined` on any non-ok probability. This is the backstop; keep it.
- `packages/core/src/index.ts:56` -- exports `canRecipeRoll`; swap for the new exports.
- `.claude/skills/tracked-json/scripts/lookup-mods.ts:139` -- the only `canRecipeRoll` caller outside `core`; `reached` per tier row.
- `packages/sync/src/curation/check.ts` -- `checkTracked`, `loadTrackedCheckInputs`, `CheckName`. Recipes are not loaded today. Reuse `loadDataFile` from `../load-data-file.ts` with `parseEnvelope(RecipesFileSchema, …)`; an absent file is `skipped`, as `crossFileOutcome` does for weights.
- `packages/sync/src/curation/check.data.test.ts` -- `pnpm test:data` over live `data/`.
- Tests that encode the old rule: `packages/core/src/probability.test.ts` (lines 111–130), `rank/crafted-branch.test.ts:112`, `rank/provenance.test.ts:55`, `provenance.test.ts:51`, `.claude/skills/tracked-json/scripts/lookup.mods.test.ts:166`, `packages/sync/src/curation/check.test.ts`.
- Docs targets (proposal section 4): `ARCHITECTURE-SPINE.md` AD-17 lines 1299–1330; `AGENT-WORKFLOW.md` near line 104; `EXPERIENCE.md` line 821 (state 36); `.claude/skills/tracked-json/SKILL.md` lines 20, 36, 58; `docs/epics.md` Story 3.4 (line 2054) and a new Story 4.7 after Story 4.6.

## Tasks & Acceptance

**Execution:**
- [ ] Docs targets above -- apply proposal section 4 verbatim; add Story 4.7 with the proposal section 5 criteria -- first commit, own message.
- [ ] `packages/core/src/probability.ts` -- add `floored(pool, modifierLevelMin)` (the per-group floor, unscoped); rebuild `eligible` on it; add the reach verdict `recipeReach(pools, entry, modifierLevelMin)`, unreachable when a slot's contained set in `eligible` is empty; delete `canRecipeRoll` -- AD-17.
- [ ] `packages/core/src/index.ts` -- export the new functions in place of `canRecipeRoll`.
- [ ] `.claude/skills/tracked-json/scripts/lookup-mods.ts` -- `reached` is membership of the tier in `floored(pool, recipe.modifierLevelMin)`; update its doc comment.
- [ ] `packages/sync/src/curation/check.ts` -- load recipes; add the `recipe-reach` check and an `unreachable` list of `{ entryKey, recipeId, slot }` with the entry path; `ok` is false while it is non-empty.
- [ ] Tests -- update the files in the Code Map; add the three-group fixture of the matrix to `probability.test.ts`; add `check.test.ts` cases for unreachable, absent and refused recipes; assert `unreachable: []` in `check.data.test.ts`.
- [ ] `data/tracked.json` -- only if `pnpm tracked:check` reports an unreachable pair, prune it with the tracked-json skill.

**Acceptance Criteria:**
- Given the live `data/`, when `pnpm test:data` runs, then it passes with `unreachable` empty.
- Given a perfect-recipe fixture with the three matrix groups, when `combinationProbability` runs, then P matches the hand-computed per-group value.
- Given `pnpm tracked:lookup tiers` on a group whose top tier is below 70, when the perfect recipe is listed, then that top tier shows `reached: true` and its lower tiers `false`.
- Given the change, when `pnpm check` runs, then it passes.

## Design Notes

The top tier is the highest `itemLevelMin` among the group's tiers with `weight > 0`. A weight-0 tier, which includes every `not-in-game` tier, cannot roll, so it is never the top. Tiers tied at the top level all survive. The floor and the scope commute, because the top is read from the unscoped pool.

## Verification

**Commands:**
- `pnpm check` -- expected: exit 0
- `pnpm test:data` -- expected: exit 0
- `pnpm tracked:check` -- expected: exit 0, `"unreachable": []`

## Implementation Notes

## Spec Change Log

## Review Triage Log
