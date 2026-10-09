---
title: 'Compute hybrid probability from the containment set'
type: 'feature'
created: '2026-10-03'
status: 'done'
route: 'dispatch'
baseline_commit: '0abe73ef1bff3415e8dc6738973a6a3e10757d4f'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/archive/spec-tracked-hybrid-mods/SPEC.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `core` throws on a hybrid reference (story 3's interim branch), so a hybrid entry has no probability. SPEC-tracked-hybrid-mods CAP-3 prices it from the weights of the hybrid tiers it contains.

**Approach:** Implement IMPLEMENTATION-NOTES §1 *Line sets and the null-line rule* and *Containment* in `core/probability.ts`: `lineSet`, `untrackable`, `statIds`, `covers`, and a hybrid arm of `contains`. §11 then runs unchanged on the containment set. Remove the story-4 interim throws.

## Boundaries & Constraints

**Always:** Cite §1 and §11. Do not restate them. A hybrid tier counts its whole weight once. Never multiply across lines. The §11 formula and its denominators do not change. `lineSet` and `untrackable` read the weights file alone, so story 9's `tracked:lookup` can call them. Follow the AGENTS.md MCP tool rule.

**Never:** Implement CAP-4 checks (§2.2–§2.7, `coOccur` for hybrids, the modGroup-span rejection) — story 5 keeps its `assertSingleLine(…, 5)` throws in `cross-file.ts`. Touch sync, web or `lookup.ts`. Edit owner documents. Change the weights contract.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Hybrid + pure share a `statId` | prefix pool: hybrid tiers {A,B} and pure tiers {A} whose A lines the band covers | P is the hybrid tiers' weight sum over W only | N/A |
| Superset line set | a tier {A,B,C} with A and B covered | not contained | N/A |
| Two hybrid families, one slot | families {A,B} and {A,C} | each reference contains only its own family | N/A |
| Hybrid prefix, suffix in its modGroup | §11 exclusion across slots | matches a by-hand two-order sum | N/A |
| Internal engine line | `weight > 0` tier {A,B,null} in a `complete` pool | contained by a {A,B} reference | N/A |
| Valueless hybrid line | `{statId}` line vs a banded weights line | not covered | N/A |
| Weight-0 hybrid tier | lines covered, `weight: 0` | not contained; stays in W | N/A |
| `untrackable` | `not-in-game`; `partial` + null line; `complete` + null line; `partial`, no null | true; true; false; false | N/A |

</frozen-after-approval>

## Code Map

- `packages/core/src/probability.ts` -- `contains(ref, entry)` (line 110) keeps its signature. Extract `covers(rl, line)` from its body for both arms. Add exported `lineSet(entry)` and `statIds(ref)`, each a `readonly string[]` sorted with `compareByCodeUnit` from `@poe/contracts`. The schema already sorts hybrid lines (§4.1), so set equality is element-wise. Add exported `untrackable(entry, pool: Pick<WeightsPool, 'poolCoverage'>)`. Delete the `assertSingleLine(…, 4)` calls in `contains`, `containedIn`, `affixProbability` and `combinationProbability`. Keep `assertSingleLine` itself: `cross-file.ts` calls it with story 5. Update the module doc.
- `orderedTerm`/`exclusionSums` -- no change. `g(e) = e.modGroup` equals the family's modGroup on every file that loads: §2.7 (story 5) rejects a containment set that spans more than one.
- `packages/core/src/index.ts:52-69` -- export `lineSet`, `statIds`, `untrackable`, `covers`.
- `packages/core/src/probability.test.ts` -- reuse `tier`, `line`, `band`, `pools`, `pOf`, `isCloseRelative`. Add a `hybrid` helper next to `band`. Replace `describe('a hybrid reference (interim)')` (line 328) with the matrix tests. Pools are built in the test (NFR-2). The committed-file test (line 292) must still pass.
- Do not change: `cross-file.ts`, `rank.ts`, `@poe/contracts`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/core/src/probability.ts` -- `lineSet`, `statIds`, `untrackable`, `covers`, the hybrid arm of `contains`, remove the story-4 throws -- §1, CAP-3.
- [x] `packages/core/src/index.ts` -- the exports.
- [x] `packages/core/src/probability.test.ts` -- one test for each matrix row. The three CAP-3 cases go through `affixProbability`/`combinationProbability`.

**Acceptance Criteria:**
- Given the repo, when running `pnpm typecheck`, `pnpm lint` and `pnpm test`, then all pass.
- Given the committed data, when running `pnpm tracked:check`, then it passes and `git diff --stat data/` is empty.
- Given `packages/core/src`, when searching for `story 4` or `assertSingleLine(` with `, 4)`, then nothing matches.

## Design Notes

**`contains` does not take the pool's coverage.** §1 writes `contains ⇔ weight > 0 ∧ ¬untrackable(entry) ∧ …`. The `not-in-game` half is already `weight > 0`: the weights schema forces weight 0 on such tiers (`weights-file.ts:62`). The `partial` half never reaches `contains`. `rank.ts` `unrankableReasonOf` returns `pool partial` before it computes a probability, and `cross-file.ts` `isPoolCheckable` skips partial classes. §1 says the same thing: "A class with a `partial` slot gets no pool check at all". The JSDoc states this so that a new caller sees the precondition.

```ts
// hybrid arm
haveSameIds(lineSet(entry), statIds(ref)) &&
  ref.lines.every((rl) => entry.lines.some((line) => covers(rl, line)))
```

## Verification

**Commands:**
- `pnpm typecheck` and `pnpm lint` -- expected: no errors.
- `pnpm test` -- expected: all pass.
- `pnpm tracked:check` -- expected: pass.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | blind, edge-case, verification-gap (other) | Module doc says `tracked:lookup` already calls `lineSet`/`untrackable` | low | `lookup.ts` imports neither; a story-9 reader would take the work as done. Direct doc correction. | patch |
| 2 | verification-gap | `lookup.ts:269` keeps its own null-keeping line-set copy; `lookup.test.ts:336` pins `[null]` | medium (pre-verified) | Frozen scope forbids touching `lookup.ts`; story 9 owns CAP-5. | defer |
| 3 | blind | `statIds` re-sorts hybrid lines against the contracts "no consumer re-sorts" comment | false | Code Map directs both functions to sort; the sort copies a fresh array and changes no result. No named harm. | reject |
| 4 | blind | Tests build hybrid refs without the schema | false | Parsed refs are sorted, distinct and ≥ 2 lines, a subset of what the helper builds; `contains` handles both orders. | reject |
| 5 | blind | No test of an equal line set with one banded line out of band, or of inclusive hybrid edges | low | `covers`' banded branch is the single-line path, edge-tested already; `every` is pinned by the valueless-line test (verification-gap layer). Fix is new tests, unlikely to catch a defect. | reject |
| 6 | blind | No positive test of a mixed banded + valueless hybrid | low | `covers` valueless branch is unit-tested true and false; the `every` arm is pinned. Unlikely to bite. | reject |
| 7 | blind | No hybrid-suffix, both-hybrid, `empty-contained` or `augment-exhausted` hybrid tests | low | The reason logic in `affixProbability`/`combinationProbability` is unchanged and reads only the containment set, which is kind-agnostic. | reject |
| 8 | blind, edge-case | `¬untrackable` precondition only in JSDoc; a `partial` pool would count null-line tiers | false | The only probability caller, `rank.ts:280`, returns `pool partial` first (`rank.test.ts:445-448`); `cross-file.ts` skips partial classes (`cross-file.test.ts:262-265`). Design Notes record the choice. | reject |
| 9 | edge-case | Hybrid ref with `lines: []` contains an all-null tier | false | `HybridLinesSchema` `.min(2)` (`modifier-ref.ts:106`); no code builds a hybrid ref outside parse. | reject |
| 10 | blind | Engine-line matrix test does not go through `affixProbability` | false | The matrix row expects "contained by a {A,B} reference", and the test asserts exactly that in a `complete` pool. | reject |
| 11 | blind | `covers` switches on `'valueMin' in rl`, fooled by `valueMin: undefined` | false | Both valueless schemas are `strictObject`s with no `valueMin`; the only code-built valueless refs (`list-fixtures.ts:31-32`) omit the key. | reject |
