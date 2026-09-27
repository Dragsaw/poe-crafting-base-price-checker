---
title: 'Revision 23 in core: a weight-0 tier is never contained, and an empty pool is total weight 0'
type: 'bugfix'
created: '2026-09-27'
status: 'done'
baseline_commit: '938ddc35a2c9a229af763d9aa1a22db0ebef7977'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/IMPLEMENTATION-NOTES.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Spine revision 23 rules that an entry whose `weight` is `0` is never contained (IMPLEMENTATION-NOTES §1), and that a pool is empty when its total weight is `0` (IN §3, AD-17). `contains` in `packages/core/src/probability.ts` still matches a weight-0 tier that has a resolved `statId`. A band that covers only such tiers therefore gets a non-empty containment set, and Story 3.3's §2.5 check would pass it at `P = 0`. This is the deferred-work entry "Dev. Two `core` changes follow the revision 23 rulings".

**Approach:** `contains` returns `false` for any entry with `weight === 0`, whatever its `weightSource` or lines. Tests pin the new rule and the weight-based emptiness that `probability.ts` already uses. `rank.ts` has no emptiness test today, and `sync` does not build the coverage figure yet, so no emptiness code changes in either.

## Boundaries & Constraints

**Always:** A weight-0 entry stays in the eligible set and in every denominator (it adds 0). An absent affix (`ref === undefined`) keeps the whole eligible set, weight-0 tiers included, so the weight-0 skip in `orderedTerm` (§11) stays and keeps a test. `interval` and the `null`-`statId` rule are unchanged.

**Decision (2026-09-27, ledger):** Remove the deferred entry. Append one PM note. The note says that `docs/epics.md:2412` should cite AD-17's total-weight reading. It also says that the stories which build AD-17's third cause and `sync`'s coverage owe IN §3's `W = 0` test.

**Never:** Do not add an Unrankable reason string to `rank.ts` for AD-17's third cause. FR-4's enum is PRD-owned and has no member for it. Do not edit `data/`, any planning document or `contracts`. Do not export `containedIn`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| not-in-game tier, resolved line | `weight 0`, `not-in-game`, `STAT [10,12]`; `band(10,12)` | `contains` → `false` | N/A |
| published weight 0 | `weight 0`, `published`, `STAT [10,12]` | `contains` → `false` | N/A |
| band covers only weight-0 tiers | pool `[zero(STAT [10,12]), other(STAT [20,30], 100)]`; `band(10,12)` | containment set (pool filtered by `contains`) is empty. It is not a set whose weight is 0 | N/A |
| slot of only weight-0 tiers | slot entries non-empty by count, all weight 0 | `affixProbability` / `combinationProbability` → `empty-eligible-pool` for that slot, never `p = 0` | typed reason |
| absent affix over a weight-0 tier | prefix absent; prefix `[zero(A), a(B,100), b(C,100)]`, suffix `[c(A,200)]` with the suffix band on `c` | `{ ok: true, p: 1 }`, not `augment-exhausted`: the zero first draw is skipped | N/A |

</frozen-after-approval>

## Code Map

- `packages/core/src/probability.ts` `contains` (lines 93–104): add the `weight === 0` guard first, and extend its doc comment to cite IN §1. `containedIn` calls it, and so do both probability functions. `affixProbability` and `combinationProbability` already key `empty-eligible-pool` on `totalWeight === 0`: leave them. `orderedTerm` skips `entry.weight === 0`, and that skip is still reachable through an absent affix: keep it.
- `packages/core/src/probability.test.ts` `tier()` sets `weightSource: 'published'`. Spread it with `weightSource: 'not-in-game'` as line 203 does. The test at line 202 ("skips a weight-0 first draw …") contains a not-in-game tier through `band(10,12)`. Under the new rule it passes vacuously, so rewrite it as the absent-affix row of the matrix.
- `packages/core/src/rank.ts` `unrankableReasonOf`: tests only absence and `partial`. No change.

## Tasks & Acceptance

**Execution:**
- [x] `packages/core/src/probability.ts` -- guard `contains` on `entry.weight === 0` and update its doc comment -- IN §1 revision 23
- [x] `packages/core/src/probability.test.ts` -- add the matrix rows under `contains (§1)` and `eligible (§9)`, and rewrite the line-202 test as the absent-affix row -- pin the rule and keep the §11 skip covered
- [x] `docs/stories/deferred-work.md` -- remove the entry and append the PM note (Decision, ledger)

**Acceptance Criteria:**
- Given the committed `data/` files, when `pnpm test` runs, then the committed-file product test still passes. No committed weight-0 tier has a resolved line, so the change is latent there.

## Implementation Notes

## Spec Change Log

## Review Triage Log

Pass 1 (2026-09-27). Layers: blind-hunter, edge-case-hunter, verification-gap (no gaps), deferred-ledger-audit (zero findings).

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | blind, edge | The `deferred-work.md` hunk also removes the PM AD-10 entry and adds a "PRD revision 23" UX note, which this spec does not authorize | medium | Real in the working tree, but not this build's edit: a concurrent PRD revision 23 pass (uncommitted `prd.md`, `addendum.md`, `epics.md`) made it. Only this build's own hunks may be staged | patch (commit hygiene: stage only this spec's entry removal and note) |
| 2 | edge | A band covering only weight-0 tiers still returns `{ ok: true, p: 0 }` | false | IN §1 puts the refusal in §2.5 (Story 3.3's cross-file check reads `contained(ref)`), not in `probability.ts`. `contains` now makes that set empty, which is what §2.5 needs. Same design as the inverted-band entry (story 3.2) | reject |
| 3 | blind | The PM note cites `epics.md:2412`, which already drifts to 2413 | low | `git show HEAD:docs/epics.md` has it at 2412, and the working tree at 2413 | patch |
| 4 | blind | The Code Map line numbers moved | low | Fix edits this build's spec | reject |
| 5 | blind | The "empty containment set" test only re-runs `contains` | low | `containedIn` is private by the spec's Never list. The row asserts the set the §2.5 consumer will build. No everyday harm | reject |
| 6 | blind | The valueless branch under the weight-0 guard is untested | low | The guard precedes both branches, and one assertion covers it | patch |
| 7 | blind | "revision 23" in the `contains` doc comment is revision narrative | low | AGENTS.md: revision history lives in git and memlog. The rest of the file cites "§1" | patch |
| 8 | blind | The ACs do not restate the new behaviour | low | Fix edits this build's spec. The I/O matrix carries the behaviour | reject |
| 9 | blind | An absent slot of only weight-0 tiers makes a combination `empty-eligible-pool` | false | Pre-existing: `combinationProbability` checks both slots' `W` (§11 divides by `W_P + W_S`), and the existing test "gives empty-eligible-pool for the suffix when only the suffix slot is empty" asserts the same with an absent suffix | reject |
| 10 | blind | The new UX note names no dependent story | false | That entry belongs to the concurrent PRD revision 23 pass, not this build | reject |

## Verification

**Commands:**
- `pnpm test` -- expected: passes, no escaped network URL
- `pnpm check` -- expected: passes
