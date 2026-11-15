---
title: "Story 7.5: A tier's own interval in core"
type: 'feature'
created: '2026-11-15'
status: 'done'
baseline_commit: '2ea0dfccf1ce0900853a84ae652ccf2cce12f1d6'
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
1. [x] Baseline, before any code change: write `compare-7-5.ts` in this session's scratchpad. It prints JSON with `crossFileChecks(tracked, weights)`, `recipeReach` for every active crafted entry × recipe × `CRAFTING_ITEM_LEVELS`, and `rank(...)` at each level, plus `pickUpPurposes` and filter text per recipe. Separately, it prints the fastest of five timed `rank` passes on the committed list. Copy it into `packages/web/` to run it, as 7.2 did, save the JSON as `before.json` and the timing apart, then remove the copy.
2. [x] `packages/core/src/probability.ts` -- add `ownInterval(line, tier, pool)` with its memo. Change the containment signatures and use the own interval in `isCovering`. Update the internal callers.
3. [x] `packages/core/src/cross-file.ts` and `cross-file/*.ts` -- pass the pool, and implement the edge-alignment rule. Export `ownInterval` from `index.ts`.
4. [x] Tests -- cover every matrix row. `probability/own-interval.test.ts` covers the synthetic rows: no overlap, empty own, the decimal grid, and a valueless line. `probability/own-interval.data.test.ts` reads the committed `data/weights.json` for the Bows row. A test of the split pair covers the `contracts` load (`TrackedFileSchema` parse), `crossFileChecks`, `needs` and a `rank` at L 82. Update the callers whose signatures changed.
5. [x] `lookup-mods.ts`, `lookup.ts` and `SKILL.md` -- add the `intervals` field, its tests and the skill text.
6. [x] Comparison -- rerun the script on the new code, then diff it against `before.json`. Record the result and both timings in Implementation Notes. Any difference: HALT and report each change and its cause for the architect.

**Acceptance Criteria:**
- Given the committed `data/`, when the comparison runs, then `after.json` is byte-identical to `before.json`, and `pnpm tracked:check` and `pnpm test:data` pass.
- Given `pnpm tracked:lookup tiers explicit.stat_3336890334 --class Bows`, then the T1 row prints the interval `[101.5, 123]` and the own interval `[103.5, 123]`.
- Given the NFR-6 test (`rank/purity-and-budget.test.ts`, synthetic), then it passes unchanged. The committed-list timing, before and after, is recorded and stays under that test's 100 ms bound.
- Given `pnpm check`, then it passes, and no test makes a network call.

## Design Notes

**Value grid and the derivation.** For each line, `d` is the largest count of fraction digits among the range endpoints of that `statId` across the tiers of the line set. A one-`#` line steps `10^-d`, and a two-`#` line (an average) steps `10^-d / 2`. With `k` the inverse of the step, the own minimum is the first grid value above `hiMax`: with `r = Math.round(hiMax·k)`, it is `r / k` when that exceeds `hiMax`, else `(r + 1) / k`. For an on-grid `hiMax`, every case in the committed data, this is `(r + 1) / k`. IEEE division is correctly rounded, so the result is the same double as its decimal literal, and a curator's band compares exactly. Memoise per pool with `WeakMap<WeightsPool, Map<WeightsLine, Interval>>`.

**`tracked:lookup tiers` output.** `TierRow` gains `intervals: {statId, interval, ownInterval}[]`, one per banded line, beside the verbatim `lines`.

**Why the pool is a parameter, not a registry.** Callers hold scoped entry arrays, but the own interval needs the unscoped pool. A module-level map from a line to its pool would be hidden state (AD-1). The epic says "the slot pool passed into containment".

**Why the page cannot change (agent-browser exemption).** The story changes no `web` source and no file under `data/`. The comparison AC proves that every `rank` result, every purpose and every filter text on the committed data is byte-identical before and after. So the page renders the same output, and no agent-browser check list applies.

## Verification

**Commands:**
- `pnpm check` -- expected: green.
- `pnpm test:data` and `pnpm tracked:check` -- expected: pass.
- `node compare-7-5.ts` (copied into `packages/web/`), diffed against `before.json` -- expected: no difference.

## Implementation Notes

- **Comparison.** `compare-7-5.ts` (in the session scratchpad) ran on the baseline and on the new code. `after.json` is byte-identical to `before.json` (`cmp`). It holds 0 cross-file failures, 0 unvalidated marks, 8,384 reach verdicts, and both `rank` results with purposes and filter text per recipe at 79 and 82. The fastest of five `rank` passes on the committed list at L 82 was 68.95 ms before and 57.26 ms after. Both are under the 100 ms bound, and the difference is run-to-run noise. Those passes are warm: the memo is already full. A cold first pass in a fresh process took 79 to 86 ms before and 88 to 97 ms after (3 and 5 runs). That pass includes module JIT, and it is close to the bound. Deriving the own interval of all 9,015 lines in `data/weights.json` from cold takes about 52 ms. A ranking pass derives only the crafted classes.
- **Grid step.** `nextOnGrid` takes `r = Math.round(hi·k)` and returns `r/k` when it is already above `hi`, else `(r+1)/k`. For an on-grid `hi` (every case in the committed data) this is the formula in Design Notes. For an off-grid `hi` (the synthetic T7/T8 fixture: a two-`#` max of 56.5 beside a one-`#` line) it gives 57, the next grid value, where the literal formula gives 58.
- **Signatures.** `isCovering(rl, line, tier, pool)`, `isContaining(ref, entry, pool, summed?)`, `containedIn(ref, set, pool)`, `coOccur(scoped, pools)` and `coRollable(refs, scoped, floor, pools)`. The `max-params` lint rule (4) made the reference checks take a `SlotScope` `{scoped, pool}` (`cross-file/slot-scope.ts`) in place of the scoped array. The grid helpers live in `probability/value-grid.ts` because of the `max-lines` limit (300) on `probability.ts`. `ownInterval` stays in `probability.ts`.
- **Code Map miss.** `sync`'s `pricing/price-entry.summed.test.ts` calls `contains` from `@poe/core`. It now passes a pool. No source file outside `core` and the lookup changed.
- **Edge-alignment detail.** It now reads `…its edges are not the extremes [<interval min>, <max>] (own minimum <own min>) of the tiers it contains (…)`.

## Spec Change Log

- 2026-11-15, implementation: Design Notes now state the own minimum as the first grid value above `hiMax`. The earlier formula `(Math.round(hiMax·k) + 1) / k` skips one grid value when `hiMax` is off the grid, which contradicts "the next value on the line's value grid" (Always). The two forms agree on the committed data, and the comparison is byte-identical. A synthetic test pins the off-grid case (a 56.5 maximum gives 57).

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | verification-gap, blind | No test proves containment reads the unscoped pool: every split-pair test runs at `modifierLevelMin` 0, where the eligible set equals the pool. | medium | Pre-verified gap. At floor 70 (perfect), T3 (65) leaves the eligible set, and a pool built from that set would move T2's own minimum to 79 without a test failing. | patch |
| 2 | verification-gap, blind, edge-case | Lookup tests do not pin `intervals`: the hybrid test uses `ownInterval`/`interval` as its oracle and maps null and valueless lines, and nothing asserts those lines are left out. | low | Pre-verified gap. Removing the `continue` guard in `tierIntervals` keeps every lookup test green. The fix corrects the test directly. | patch |
| 3 | blind | SKILL.md step 4b names `interval` but not where to read it, beside the new "copy band edges from `intervals`" rule. | low | 4b says "derived interval (`interval`)" and does not name the lookup field. A one-line text fix. | patch |
| 4 | blind | The data test fills the suffix slot with the prefix pool. | low | `own-interval.data.test.ts` builds `{ prefix: pool, suffix: pool }`. The fix uses the real suffix pool directly. | patch |
| 5 | blind, edge-case, verification-gap | The `ownInterval` memo is keyed by line only, ignores `tier`, and does not assert that `tier` is in `pool`. | false | `eligible` (`probability.ts:217`) filters and keeps entry identity. Parsed weights give each tier its own line objects. A tier that overlaps its own copy falls back to its interval, so a shared line still yields the same result. No production caller passes a foreign tier. | reject |
| 6 | blind, edge-case | The own minimum is not taken to a fixpoint, so it can land inside a tier that starts above the interval minimum. | false | AD-11 defines the own interval from the tiers the interval *begins inside*, and the spec's Always section states this. `proto.mjs` found 0 changed containment sets. The code follows its owner document, and a change would be an AD-11 change. | reject |
| 7 | blind | Edge alignment accepts the interval minimum for a single tier, which brings back the overlap. | false | The spec's Always section (AD-17) states that either the lowest contained own minimum or the lowest interval minimum is a valid lower edge. | reject |
| 8 | blind | No test covers half-step band edges in `sync` filter text. | false | `data/tracked.json` already has many `.5` edges (for example `valueMax` 25.5, 30.5, 188.5) that go through pricing and filter text. | reject |
| 9 | blind | The near-bound cold timing has no deferred-work entry. | false | The AC asks for the fastest of five passes, recorded and under 100 ms (68.95 and 57.26 ms). The cold figure is recorded as information, and no work is carved out. | reject |
| 10 | blind, edge-case | `value-grid.ts`: `lineDigits` returns `-Infinity` on empty ranges, exponent notation is not handled, and there are no direct unit tests. | low | Every caller filters out `ranges: []` first. PoE values never reach 1e-6 or 1e21. The grid is tested through `ownInterval`. Unlikely, and the guards would add branches. | reject |
| 11 | blind | The edge-alignment detail always prints `(own minimum X)`. | low | Cosmetic. The fix adds a branch to a message whose prefix other tests match. | reject |
| 12 | blind | The comparison script and its JSON are only in the scratchpad. | low | This follows the 7.2 precedent, and the spec names the scratchpad. The result is recorded in Implementation Notes. Process only, no defect. | reject |
| 13 | blind | `coRollable`/`coOccur` take `pools` as a separate argument, not a `SlotScope`. | low | A consistency preference with no named divergence. Callers build both from one `scopeOf` result. | reject |
| 14 | blind | The status files disagree (spec `in-review`, sprint `in-progress`). | false | The workflow moves sprint-status at presentation (step 5). This state is expected mid-review. | reject |
| 15 | edge-case | `sameLine` mis-pairs when a tier has two lines with the same statId. | low | The committed `weights.json` has 0 such tiers (checked). Guarding it adds complexity for an unreachable case. | reject |
| 16 | edge-case | A valueless tier prints no `intervals` item, but the skill says to copy edges from `intervals`. | false | SKILL.md step 4 handles valueless tiers before the `intervals` instruction (`kind: "valueless"`, or `valueMin`/`valueMax` 1). | reject |
