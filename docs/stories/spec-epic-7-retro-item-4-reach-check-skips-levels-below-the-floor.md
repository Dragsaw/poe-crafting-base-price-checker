---
title: 'The tracked:check reach check skips levels below the entry floor'
type: 'bugfix'
created: '2026-11-15'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-7-retro-2026-11-15.md'
  - '{project-root}/docs/reviews/review-epic-7-diff.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic 7 retro action item 4 (finding ADV-1). `isReached` in `classUnreachable` (`packages/sync/src/curation/check.ts`) counts an entry as reached when any recipe reaches it at any offered crafting level, including a level below the entry's own `itemLevelMin`. `rank` never counts an entry at such a level (`countedProbability`, `packages/core/src/rank-crafted-row.ts`). So an entry with floor 82 that is reached only at 79 passes `tracked:check` but counts at no level, and it still costs one search and one fetch per rotation.

**Approach:** In `isReached`, test only the levels of `CRAFTING_ITEM_LEVELS` at or above `entry.itemLevelMin`. Add a case to `packages/sync/src/curation/check.recipe-reach.test.ts`: the review's fixture with the entry floor set to 82, reached only at 79, is listed as unreachable. The existing "reaches at 79 only" case (floor 75) stays unlisted.

**Decision (agent):** An entry with a floor above every crafting level (above 82) is now listed as unreachable. `rank` counts it at no level, so the gate agrees with `rank`. The committed `data/tracked.json` has no crafted floor above 82, so the committed data still passes.

</frozen-after-approval>

## Implementation Notes

**Agent browser checks:** none needed. The change touches only `packages/sync/` and `docs/`, outside the paths that need a list.

- `packages/sync/src/curation/check.ts` -- `isReached` in `classUnreachable` tests a crafting level only when `entry.itemLevelMin <= itemLevel`, the same skip as `countedProbability` in `rank`.
- `packages/sync/src/curation/check.recipe-reach.test.ts` -- `inputsOf` takes an optional entry floor. New cases: floor 82 reached only at 79 is listed (the ADV-1 case); floor 84 with the outer tier at 85 (reached at both levels if the floor were ignored) is listed. Both fail on the old `check.ts` (checked by stashing it). The existing "reaches at 79 only" case (floor 75) still passes.
- `pnpm tracked:check` on the committed `data/tracked.json` -- `unreachable: []`, as the review's scratch count of 0 predicts.
- The frozen Decision (floor above 82 → listed) reopens 7.2 Blind 3 (`reject`: "nothing reports a crafted floor above 82"). Such an entry is now reported, under `unreachable`, because `rank` counts it at no level.
- `.claude/skills/tracked-json/SKILL.md` -- the `unreachable` rule, the step-4b recipe-reach check, step 7 and the draft step now say "at or above the entry's floor". Step 7 sends the curator to *The floor rule* first when an entry is reached only below its floor. This keeps the skill in step with the command (Story 7.2 AC).
- `docs/stories/sprint-status.yaml` -- action item 4 → `done`, `last_updated` refreshed.
- `docs/stories/deferred-work.md` -- one `[NOTE FOR ARCHITECT]` entry: AD-17 and AGENT-WORKFLOW.md do not name the floor in the gate sentence. Those files are architect-owned (Review brief rule 2).
- `pnpm check` -- 8 passed, 0 failed before review and again after the review fixes (`test:data` included).
- Follow-up after review -- the `CheckUnreachable` JSDoc in `check.ts` names the floor, and the skill cites FR-38 by id only. `recipeReach` has no other non-test caller. `tracked:lookup` prints per-tier advice rows only, and `tracked:regenerate` does not prune by reach, so no other tool can pass an entry the gate refuses.

## Review Triage Log

Layers: Blind Hunter, Deferred Ledger Auditor (zero findings), OCR delegate (zero findings). Impeccable design review skipped: no file under `packages/web/src/`.

- BH-1 no test pins the `<=` boundary -- low, patched: "floor 82 reached at 82 is not listed". It fails when the guard is mutated to `<`.
- BH-2 the floor skip is a second copy of `rank`'s predicate; `core` should export one "counted at (entry, recipe, L)" predicate -- low, rejected. The copy is one comparison, and the AGENT-WORKFLOW rule cited is about the cross-file checks, not this guard. A shared predicate adds a new public `core` API, and the retro set "none beyond the fix" for this item.
- BH-3 SKILL.md, AGENT-WORKFLOW.md and AD-17 still state the old rule -- medium, patched for SKILL.md (it is in step with the command per the Story 7.2 AC). Deferred for AGENT-WORKFLOW.md and AD-17 as an architect note: those documents are architect-owned.
- BH-4 an `unreachable` row gives no reason, and the skill's remedy is to prune -- low. Patched in the skill: step 7 now checks the floor first. A `reason` field on `CheckUnreachable` is rejected: that is new report API for a case the committed data never hits.
- BH-5 the Decision reopens 7.2 Blind 3 without citing it -- low, patched in Implementation Notes (the frozen block is not edited).
- BH-6 the spec does not close the action item -- low, patched: `sprint-status.yaml` item 4 → `done`.
- BH-7 no `pnpm check` record -- low, patched: recorded in Implementation Notes.
- BH-8 the floor-84 test does not assert `report.ok` -- low, patched: `expect(report.ok).toBe(false)`.

