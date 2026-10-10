---
title: 'Story 4.7: The recipe floor per modifier group'
type: 'bugfix'
created: '2026-10-10'
status: 'done'
baseline_commit: '566ab0c1c1bef5ed6c50fc34bdc2ef04fea328a0'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/sprint-change-proposal-2026-10-10.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** AD-17 models a recipe's `modifierLevelMin` as a cut of every tier below the floor. In the game the floor never removes a modifier type: a group whose top tier sits below the floor still rolls that top tier. Every greater and perfect ranking is wrong, and `tracked:lookup` advises pruning reachable picks.

**Approach:** Apply the floor per `modGroup` of each slot, as decided in section 1 of the sprint change proposal (`docs/sprint-change-proposal-2026-10-10.md`). `core` exposes a reach verdict per `(entry, recipe)` that replaces `canRecipeRoll`. `pnpm tracked:check` gains an `unreachable` list. The docs edits of proposal section 4 are master's `78af60e`, and this story follows them.

## Boundaries & Constraints

**Always:**
- A group with a tier at or above the floor loses only its tiers below the floor. A group whose top tier is below the floor keeps that top tier alone, at its own weight. The floor never removes a whole group (AD-17 as rewritten).
- The group's top tier is taken from the unscoped pool. Item-level scope (AD-5) still applies after, so a group whose top tier is above the entry's item level and whose other tiers are below the floor contributes nothing.
- A hybrid `modGroup` is its own group. Groups are keyed by `modGroup` alone and never merged by `statId`.
- Survivors renormalise before containment. Coverage stays on the unrestricted pool (AD-17, AD-27).
- `modifierLevelMin` `0` goes through the same code path and changes nothing.
- Ranking keeps the backstop: an unreachable entry makes its `(itemClass, recipe)` pair unrankable.
- The docs edits are master's `78af60e`. Its message carries the decision and the three rejected alternatives that proposal section 5 names. Where this spec and those docs differ, the docs win.

**Never:**
- No change to `data/weights.json`, the weights schema, `sync` run logic or any production `web` file. Web test fixtures that encode the old floor follow the new rule.
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
- Docs targets (proposal section 4), landed on master in `78af60e`: `ARCHITECTURE-SPINE.md` AD-17 lines 1299–1330; `AGENT-WORKFLOW.md` near line 104; `EXPERIENCE.md` line 821 (state 36); `.claude/skills/tracked-json/SKILL.md` lines 20, 36, 58; `docs/epics.md` Story 3.4 (line 2054) and a new Story 4.7 after Story 4.6.

## Tasks & Acceptance

**Execution:**
- [x] Docs targets above -- apply proposal section 4 verbatim; add Story 4.7 with the proposal section 5 criteria -- landed on master in `78af60e`.
- [x] `packages/core/src/probability.ts` -- add `floored(pool, modifierLevelMin)` (the per-group floor, unscoped); rebuild `eligible` on it; add the reach verdict `recipeReach(pools, entry, modifierLevelMin)`, unreachable when `combinationProbability` is not defined, as the ranking backstop requires; delete `canRecipeRoll` -- AD-17.
- [x] `packages/core/src/index.ts` -- export the new functions in place of `canRecipeRoll`.
- [x] `.claude/skills/tracked-json/scripts/lookup-mods.ts` -- `reached` is membership of the tier in `floored(pool, recipe.modifierLevelMin)`; update its doc comment.
- [x] `packages/sync/src/curation/check.ts` -- load recipes; add the `recipe-reach` check and an `unreachable` list of `{ entryKey, recipeId, slot }` with the entry path; `ok` is false while it is non-empty.
- [x] Tests -- update the files in the Code Map; add the three-group fixture of the matrix to `probability.test.ts`; add `check.test.ts` cases for unreachable, absent and refused recipes; assert `unreachable: []` in `check.data.test.ts`.
- [x] `data/tracked.json` -- only if `pnpm tracked:check` reports an unreachable pair, prune it with the tracked-json skill.

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

- `recipeReach` returns `{ reached: true }` or `{ reached: false, slots }`; `slots` names each slot whose contained set is empty, or the slot that a first draw exhausts. `tracked:check` emits one `unreachable` row per named slot. Classes with an absent or partial pool are skipped, as they are already `unvalidated`. A refused weights file makes `recipe-reach` `skipped`.
- `unreachable` rows stay out of `issues`; `ok` is false while the list is non-empty.
- Boundary deviation: four `web` test and fixture files (no production `web` file) encoded the old floor in their fixtures and failed under the new rule. Their fixtures now share a `modGroup` where a tier must be floored, and the frozen-data appendix test expects an empty appendix. Kept in a separate commit.
- `SKILL.md` follows master's `78af60e`. Only its `unreachable` line differs: it names the fields that `check.ts` emits (`path`, `entryKey`, `recipeId`, `slot`), because the code owns the report field identifiers.
- No `data/tracked.json` change: `pnpm tracked:check` reports `unreachable: []` on the live data.

## Spec Change Log

- 2026-10-10, human: the "Never" boundary on `web` narrowed from any `web` file to production `web` files. Trigger: nine web tests in four web test and fixture files encoded the old floor and blocked `pnpm check`. Avoids: a `pnpm check` gate that cannot pass under the frozen rule. KEEP: no production `web` change.
- 2026-10-10, human: the docs edits follow master's `78af60e`, not this branch's first commit. Trigger: an earlier branch landed the same docs on master before this branch was created from `566ab0c`, and the two versions conflicted. Avoids: two versions of AD-17, Story 4.7 and the tracked-json skill. KEEP: the per-group floor and the reach verdict. Triage rows 13 and 14 concern the replaced branch docs; master carries spine revision 34.

## Review Triage Log

| # | Source | Finding | Verdict | Route | Evidence |
|---|--------|---------|---------|-------|----------|
| 1 | verification-gap, blind | Partial-pool and absent/refused-weights skips of `recipe-reach` are untested | medium | patch | Pre-verified gap; the only partial-pool test never asserts `unreachable` or `recipe-reach`. |
| 2 | verification-gap | Sort order of `unreachable` never observed | low | patch | Every test yields at most one row; adding a test is a direct fix with no product complexity. |
| 3 | blind | `// A mark never moves ok` misleading | low | patch | `ok` now depends on `reach.unreachable.length` on the next line. |
| 4 | edge, blind, verification-gap | Weight-0 test asserts only `toContain`; stray blank lines open two `describe` blocks | low | patch | The tier at 60 survives `floored` but the test does not pin it; the blank lines are cosmetic. |
| 5 | ledger, blind | No deferred-work entry for restoring the 104 pruned entries | medium | defer | Carved out by the Never list. The ledger entry was appended, then removed at the human's request; step 2 of the proposal holds the follow-up. |
| 6 | edge | A weight-0 `absent` tier between a group's top and the floor survives and can turn provenance into `uniform-prior` | low | reject | The schema allows `absent` at weight 0, but the live `weights.json` has none (1995 `absent` tiers, all positive). Unlikely in use, and the fix adds a guard. |
| 7 | edge | An all-weight-0 group is cut flat | low | reject | Such a group carries no mass. Unlikely in use, and the fix adds a branch. |
| 8 | edge | An empty `recipes` array reports `recipe-reach` passed | low | reject | No such file ships. Unlikely, and the fix adds a branch. |
| 9 | edge | A refused recipes file fails even when the schema check failed | false | reject | This mirrors `crossFileOutcome`, which reports a refused weights file before the schema skip. |
| 10 | edge, blind | One empty-containment entry is reported as a `cross-file` issue and as an `unreachable` row | low | reject | It only happens on an entry that is already broken. Developer noise only, and the fix adds a branch. |
| 11 | edge | `epics.md:2134` (Story 3.4) still cites `canRecipeRoll` | false | reject | Proposal §4.2 keeps the Story 3.4 body unchanged under a superseded note. |
| 12 | blind | `tracked:lookup` `reached` ignores the entry's item level | low | reject | The spec task defines `reached` on the unscoped `floored`. The tiers lookup has no entry, and SKILL step 7's `tracked:check` catches the case. |
| 13 | blind | AD-17 names `eligible` and restates a command rule; it drops `[ASSUMPTION]` and the P=0 rule; EXPERIENCE state 36 describes tooling; AGENT-WORKFLOW placement | false | reject | The text is the approved proposal §4 verbatim. A reviewer does not edit an owner document (Review brief rule 2). |
| 14 | blind | Spine revision not bumped; Epic 4 cites revision 32 | low | reject | The approved proposal names no bump. The revision-32 citation predates this change. |
| 15 | blind | Spec/sprint-status status mismatch; web file count and SKILL line numbers in notes | false | reject | Sprint status syncs at presentation. The note fixes edit this spec. The file count was corrected as a factual error. |
| 16 | blind | App appendix test no longer covers a populated appendix | low | reject | The populated state 36 is still covered in `crafted-states.test.tsx` (WANDS) and `list-statement.test.ts`. |
| 17 | blind | Core `GREATER` fixture floor is 0 | low | reject | The fixture predates this change, and `floored` unit tests cover a partial cut that keeps the top tier. |
| 18 | blind | The hand-computed P formula does not show the order term | false | reject | `(wp·ws/S + ws·wp/P)/(P+S)` is identical to `wp·ws/(P·S)`, and the test matches the AC's hand value. |
