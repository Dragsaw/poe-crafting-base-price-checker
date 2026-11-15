---
title: "Story 7.5: A tier's own interval in core"
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

**Problem:** Where tier N's interval begins inside tier N-1's interval, no band can contain tier N without also reaching into tier N-1. So T1 and T2 of a value-overlapping line, for example "Adds # to # Lightning Damage" (`explicit.stat_3336890334`) on Bows, cannot be tracked as two entries. Story 7.3's split fails `empty-containment-set` today.

**Approach:** Add `ownInterval` beside `interval` in `packages/core/src/probability.ts`, as AD-11 defines it. Containment (`isCovering`, `isContaining`, `containedIn`) tests a tier against its own interval, so the unscoped slot pool is passed into containment. Edge alignment accepts the own minimum or the interval minimum as the lower edge (AD-17). `pnpm tracked:lookup tiers` prints each line's interval and own interval.

## Boundaries & Constraints

**Always:**
- Own interval as AD-11 defines it, per banded line. "Begins inside" is inclusive at both ends. "The first value the line can take" is the next value on the line's value grid (Design Notes). A valueless line keeps its interval. Edges are exact, with no tolerance (AD-5).
- Every tier of the unscoped slot pool takes part, including weight-0 and untrackable ones, as AD-11 says ("another tier … in the class's slot pool"). On the committed data no shift comes from such a tier.
- The own interval is the same at every `L` and under every recipe. One ranking pass on the committed Tracked List stays within NFR-6.
- Edge alignment: the upper edge is the highest contained interval maximum. The lower edge is either the lowest contained own minimum or the lowest contained interval minimum. Any other edge is rejected.
- `isMeeting` (line-set completeness) keeps `interval`: a search can match every roll of a tier.
- `needs`, reach and `rank` pick up the own interval only through containment. They get no other change.

**Never:**
- No change to any file under `data/`, to any `contracts` schema or check, or to `web` source.
- No second derivation of the own interval in `cross-file`, `lookup` or tests. All of them call `ownInterval`.
- No epsilon in any edge comparison.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Bows lightning | committed Bows prefix tiers of `stat_3336890334` | T2 (75) own `[80.5, 103]`, T1 (81) own `[103.5, 123]`, T3 (65) own `[57, 80]` | N/A |
| No overlap | tier not inside another tier of its line set | own interval equals `interval` | N/A |
| Empty own | another tier covers this tier's whole interval | own interval equals `interval` | N/A |
| Split pair | two Bows entries that differ only in prefix `[103.5, 123]` @81 and `[80.5, 103]` @75 | `contracts` loads both (no overlap); each contains one tier; `needs` gives 81 and 75; no cross-file failure; neither is `unreachable`; at L 82 each counts at its own floor and no tier counts in both | N/A |
| Hybrid | hybrid reference, with each line banded on that line's own interval | contains the tier only when the line sets are equal and every line is covered | N/A |
| Clipping band | band `[90, 123]` on Bows lightning | contains T1 only; `edge-alignment` rejects the lower edge 90 | failure names the extremes |

</frozen-after-approval>

## Code Map

- `packages/core/src/probability.ts` -- `interval` (L48). `isCovering` (L89) and `isContaining` (L110) gain the tier and the unscoped `WeightsPool`. `containedIn` (L189) gains the pool. Their internal callers already hold the pool: `needs` (`pool`), `affixProbability`, `combinationProbability` and `recipeReach` (`pools[slot]`). `lineSet` gives the line-set key.
- `packages/core/src/cross-file.ts` -- `ReferenceCheck`, `FLOOR_CHECKS`/`WIDEST_CHECKS` (L155-170), `scopeCache`/`Scope` (L181-209), `referenceFailures`, `coOccur` (L140), `lineSetCompleteness` (its `containedIn` call), `isMeeting` (keep `interval`). Thread `pools[slot]` through `Scope` to each check.
- `packages/core/src/cross-file/edge-alignment.ts` -- `extremesOn` returns the interval min, the own min and the max. Keep the detail prefix `…its edges are not the extremes [` stable: `cross-file.test.ts:12`, `sync` `check.test.ts:169` and `web` `unrankable-appendix.test.tsx:178` match it. Add the own min after it.
- `packages/core/src/cross-file/empty-containment.ts`, `cross-file/co-rollable.ts` -- callers of `isContaining`, `isCovering` and `containedIn`. Pass the pool.
- `packages/core/src/index.ts` (L60-78) -- export `ownInterval`. No caller outside `core` uses the changed signatures (`web` and `sync` only match detail text).
- `packages/contracts/src/overlap.ts` -- `areLinesIntersecting` (L64) compares band values only, so disjoint bands such as `[80.5, 103]` and `[103.5, 123]` already load. No change.
- `.claude/skills/tracked-json/scripts/lookup-mods.ts` -- `TierRow` and `lookupTiers` (L95-145). Tests: `lookup.test.ts`, `lookup.end-to-end.test.ts`.
- `.claude/skills/tracked-json/SKILL.md` -- sweep every "per `interval`" instruction: L20 (floor rule), L23 ("derives no interval"), L31 (step 3) and L33 (hybrid bands). Do the same in the `lookup.ts` L1 header. A curator now reads `ownInterval` from the lookup and writes it for a single tier. Cite AD-11 and do not restate it.
- Test callers of the changed signatures: `core/src/probability/*.test.ts`, `core/src/cross-file*.test.ts` and `core/src/cross-file/*.test.ts`. Find the full set with `find_referencing_symbols`.
- Comparison baseline: the 7.2 script `C:/Users/ilyal/AppData/Local/Temp/claude/26e3858fb0c54881/20295f5c-5f1f-4a2b-97f1-8b260b2c6aa7/scratchpad/filter-baseline.ts` shows how to call `rank` on the committed `data/`. Two prototypes are in `C:/Users/ilyal/AppData/Local/Temp/claude/26e3858fb0c54881/430ad3b3-0137-41c3-9f74-5c8a575398dd/scratchpad/`. `proto.mjs` finds 255 shifted lines and 0 changed containment sets on the committed Tracked List. `grid.mjs` finds 0 off-grid neighbour maxima, 0 mixed precisions and 0 shifts caused by a weight-0 tier.

## Tasks & Acceptance

**Execution:**
1. Baseline, before any code change: write `compare-7-5.ts` in this session's scratchpad. It prints JSON with `crossFileChecks(tracked, weights)`, `recipeReach` for every active crafted entry × recipe × `CRAFTING_ITEM_LEVELS`, and `rank(...)` at each level, plus `pickUpPurposes` and filter text per recipe. Separately, it prints the fastest of five timed `rank` passes on the committed list. Copy it into `packages/web/` to run it, as 7.2 did, save the JSON as `before.json` and the timing apart, then remove the copy.
2. `packages/core/src/probability.ts` -- add `ownInterval(line, tier, pool)` with its memo. Change the containment signatures and use the own interval in `isCovering`. Update the internal callers.
3. `packages/core/src/cross-file.ts` and `cross-file/*.ts` -- pass the pool, and implement the edge-alignment rule. Export `ownInterval` from `index.ts`.
4. Tests -- cover every matrix row. `probability/own-interval.test.ts` covers the synthetic rows: no overlap, empty own, the decimal grid, and a valueless line. `probability/own-interval.data.test.ts` reads the committed `data/weights.json` for the Bows row. A test of the split pair covers the `contracts` load (`TrackedFileSchema` parse), `crossFileChecks`, `needs` and a `rank` at L 82. Update the callers whose signatures changed.
5. `lookup-mods.ts`, `lookup.ts` and `SKILL.md` -- add the `intervals` field, its tests and the skill text.
6. Comparison -- rerun the script on the new code, then diff it against `before.json`. Record the result and both timings in Implementation Notes. Any difference: HALT and report each change and its cause for the architect.

**Acceptance Criteria:**
- Given the committed `data/`, when the comparison runs, then `after.json` is byte-identical to `before.json`, and `pnpm tracked:check` and `pnpm test:data` pass.
- Given `pnpm tracked:lookup tiers explicit.stat_3336890334 --class Bows`, then the T1 row prints the interval `[101.5, 123]` and the own interval `[103.5, 123]`.
- Given the NFR-6 test (`rank/purity-and-budget.test.ts`, synthetic), then it passes unchanged. The committed-list timing, before and after, is recorded and stays under that test's 100 ms bound.
- Given `pnpm check`, then it passes, and no test makes a network call.

## Design Notes

**Value grid and the derivation.** For each line, `d` is the largest count of fraction digits among the range endpoints of that `statId` across the tiers of the line set. A one-`#` line steps `10^-d`, and a two-`#` line (an average) steps `10^-d / 2`. With `k` the inverse of the step, the own minimum is `(Math.round(hiMax·k) + 1) / k`. IEEE division is correctly rounded, so the result is the same double as its decimal literal, and a curator's band compares exactly. Memoise per pool with `WeakMap<WeightsPool, Map<WeightsLine, Interval>>`.

**`tracked:lookup tiers` output.** `TierRow` gains `intervals: {statId, interval, ownInterval}[]`, one per banded line, beside the verbatim `lines`.

**Why the pool is a parameter, not a registry.** Callers hold scoped entry arrays, but the own interval needs the unscoped pool. A module-level map from a line to its pool would be hidden state (AD-1). The epic says "the slot pool passed into containment".

**Why the page cannot change (agent-browser exemption).** The story changes no `web` source and no file under `data/`. The comparison AC proves that every `rank` result, every purpose and every filter text on the committed data is byte-identical before and after. So the page renders the same output, and no agent-browser check list applies.

## Verification

**Commands:**
- `pnpm check` -- expected: green.
- `pnpm test:data` and `pnpm tracked:check` -- expected: pass.
- `node compare-7-5.ts` (copied into `packages/web/`), diffed against `before.json` -- expected: no difference.

## Implementation Notes

## Spec Change Log

## Review Triage Log
