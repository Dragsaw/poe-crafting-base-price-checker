---
title: 'Weight-0 tiers do not narrow an own interval'
type: 'bugfix'
created: '2026-11-15'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-7-retro-2026-11-15.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic 7 retro action item 3 (finding ECH-2). `ownInterval` groups every entry of the slot pool by line set, with no weight filter (`packages/core/src/probability.ts:75`). So a weight-0 tier, which cannot roll on the class, can push the own minimum of a tier that can roll above values that only that tier produces. AD-11 says "another tier of the same line set in the class's slot pool" and does not exclude weight 0.

**Decision (human, 2026-11-15, renegotiated after review):** Option A. A weight-0 tier does not narrow another tier's own interval. The human first chose B (keep today's rule). The review then showed that `core` already treats weight 0 as "never drawn" everywhere else: `isContaining`, `eligible`, the wider-tier check in `cross-file.ts`, `kind-agreement` and `empty-containment`. The own interval was the one exception.

**Approach:**
- **Spine:** the AD-11 sentence reads "…another tier of the same line set in the class's slot pool **that can roll on the class (weight above 0)**…".
- **Code:** `ownInterval` narrows only by tiers with `weight > 0`. A weight-0 tier still gets its own interval, derived against the rolling tiers. Weight is a fact of the class, so a tier keeps one own interval at every level and under every recipe.
- **Tests:** flip the "…weight-0 included" test in `own-interval.test.ts`. Add a dead tier below, a dead tier's own interval, and the band containment that changes.
- **Tracker:** close action item 3 in `sprint-status.yaml`.
- **Scope:** untrackable tiers stay in, because they can roll. ECH-3 and ADV-2 stay with item 6. No PRD edit.

</frozen-after-approval>

## Implementation Notes

**Agent browser checks:** exempt. The page cannot change. All 8 weight-0 tiers in the committed `data/weights.json` are `not-in-game` tiers whose lines have `statId: null`. `deriveOwnInterval` returns early on a null `statId`, and `sameLine` matches by `statId`, so these tiers can neither narrow another tier nor be narrowed. A scan of all 9,015 lines in 118 pools, with and without the filter, finds 0 differences, and that result follows from the above. The rule first takes effect when a weight-0 tier with a resolved `statId` shares a line set with tiers that can roll.

- `ARCHITECTURE-SPINE.md` AD-11, revision 50 -- the own-interval sentence reads "…in the class's slot pool whose `weight` is above 0…". The wording is tighter than the frozen Approach's "that can roll on the class (weight above 0)" (BH-1). One added sentence says that a weight-0 tier narrows no tier, and that the `weight` read is the entry's own, never AD-17's tag exclusion (BH-6). The paragraph is reflowed. `.memlog.md` gains the revision-50 decision entry, with rejected option B (BH-2).
- `packages/core/src/probability.ts` -- `ownInterval` builds its `bySet` memo from the `weight > 0` entries only. Its JSDoc and the memo comment say so (BH-10). `deriveOwnInterval` is unchanged: a weight-0 tier is not in `bySet`, so it narrows nothing, but its own line still derives against the rolling tiers.
- `packages/core/src/probability/own-interval.test.ts` -- the old "…weight-0 included" test is split.
  - The line-set half stays.
  - "is not narrowed by a weight-0 tier" asserts `[15, 30]`, and that a live tier beside the dead one still narrows to `[21, 30]`.
  - "narrows a weight-0 tier by the tiers that can roll" pins the choice that a dead tier still derives against the rolling tiers.
  - A new `describe` covers the band containment that changes.
  - Two tests fail on the old `probability.ts` (checked with `git stash`): "is not narrowed by a weight-0 tier" and "does not contain the rolling tier in a band that starts above its low rolls". The `[15, 30]` contains-and-aligns test passes on both versions and guards the positive side (BH-3).
- `docs/stories/epic-7-context.md` -- its copy of the AD-11 sentence gains "whose `weight` is above 0", so it does not drift (BH-7).
- `docs/stories/sprint-status.yaml` -- action item 3 → `done`, `last_updated`, as items 1 and 2 did.
- `pnpm check` -- 8 passed, 0 failed, on the code change before the doc-only review fixes. The probability tests pass after them.

## Review Triage Log

**Round 1 (option B, a tracker-only change).** Layers: Blind Hunter, Deferred Ledger Auditor (zero findings), OCR delegate (zero findings). Impeccable skipped: no file under `packages/web/src/`.
- The Blind Hunter showed that B left the own interval as the one place where a never-drawn tier moves a number. `isContaining`, `eligible`, the wider-tier check, `kind-agreement` and `empty-containment` all skip weight 0 (verified). The human switched to A. Its other points were about B's record and are moot under A.

**Round 2 (option A).** Layers: Blind Hunter, Deferred Ledger Auditor (zero findings), OCR delegate (zero findings).

| Id | Finding | Verdict | Disposition |
|---|---|---|---|
| BH-1 | The AD-11 line is not reflowed, and "class" is repeated. | low | patched |
| BH-2 | No `.memlog.md` decision entry, and no revision bump. | low | patched: revision 50 plus the entry; the rev-48 follow-up is the precedent for an entry with each rule change. |
| BH-3 | The `[15, 30]` test passes on the old code, so the spec's "both fail" claim is wrong. | low | patched: the notes name the two discriminating tests. |
| BH-4 | No `crossFileChecks` or `regenerateEntries` test. | low | rejected. Both read `isContaining` / `ownInterval`, which the new tests pin. An end-to-end case adds fixtures for no new path. |
| BH-5 | The dead-tier test pins nothing new; two dead tiers and a dead hybrid are not covered. | low | rejected. The dead-tier test pins the new memo path, where the tier is absent from `bySet`. The other cases go through the same filter. |
| BH-6 | AD-11 does not say whether `blockedByTags` counts toward "can roll". | low | patched in AD-11 and the memlog. |
| BH-7 | `epic-7-context.md` keeps the old sentence. | low | patched |
| BH-8 | The spec is `in-progress` while the tracker says `done`, and it has no triage log. | false | Finalization sets `done` and adds this log. |
| BH-9 | The frozen Decision holds revision narrative. | false | bmad-build records each human answer as a decision in the frozen block. The AGENTS.md rule binds planning documents, and the rationale is also in the memlog and the commit message. |
| BH-10 | The `ownInterval` JSDoc does not mention the weight filter. | low | patched. `isCovering`'s "`pool` is unscoped" stays true. |
