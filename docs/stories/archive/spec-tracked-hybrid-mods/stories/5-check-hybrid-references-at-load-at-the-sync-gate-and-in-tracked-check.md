---
title: 'Check hybrid references at load, at the sync gate and in tracked:check'
type: 'feature'
created: '2026-10-03'
status: 'done'
baseline_commit: 'a4c3def0c0b0ff84e45009bc5a3c13a9a9aeae7e'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/archive/spec-tracked-hybrid-mods/SPEC.md'
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/IMPLEMENTATION-NOTES.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The cross-file checks throw on a hybrid reference (`assertSingleLine(…, 5)`), and so does the sync catalogue check. No check catches a hybrid that names a subset of a tier's lines, or a single-line band that reaches into a hybrid tier. A crafted entry that no pool check covers is silently skipped and is not marked unvalidated. SPEC-tracked-hybrid-mods CAP-4.

**Approach:** Implement IMPLEMENTATION-NOTES §2.1–§2.5, §2.7, §2.8 and §8 `needs` for every reference kind, in `core` and `contracts`. Cite those sections and do not restate them. Summed `statId`s (`S`) are story 7's, so this story evaluates §2.1/§2.2 with `S = ∅`. Web load, the sync gate and `tracked:check` keep calling the one `crossFileChecks`.

## Boundaries & Constraints

**Always:** One predicate per §, defined once. `contracts` evaluates only all-single-line pairs, and `core` evaluates every pair with a hybrid reference (§2.1, *Who evaluates a pair*). Each payload names what its § lists. `mixedGroup` names `weights.json` as the file at fault. A mark is never a failure (§2.8). Follow the AGENTS.md MCP tool rule.

**Never:** Summed-`statId` sums, the summed valueless/missing-bound rejections, or the summed search (story 7). The search body (story 6). Labels (story 8). `lookup.ts` and `SKILL.md` (story 9). Edit an owner document. Bump a schema version (SPEC *Artifacts*). Edit `data/`. The §2.3 within-file kind refusals, including the first one ("two tracked lines … wherever each line sits"): the human decided that story 7 owns them, and `stories.yaml` story 7 names them.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Correct hybrid | Bows-like pool, hybrid tiers T1/T2 {A,B}, a reference naming A and B at T1's edges | no failure | N/A |
| Misaligned line | line B covers T1 only, line A spans T1–T2 | `edge-alignment` names line A, its edges, the {T1} extremes, T1 | fails |
| Subset reference | hybrid {A,B} vs a tier {A,B,C} | `line-set-completeness` names the tier and the omitted C | fails |
| Single band reaches hybrid | banded A intersects the {A,B} tier's A interval | `line-set-completeness`, *band reaches into a hybrid tier* | fails |
| Empty set | hybrid matches no tier; a {A,B,C} tier covers A and B | `empty-containment-set` lists the {A,B,C} tier and C | fails |
| Mixed modGroup | contained tiers in two modGroups (synthetic) | `line-set-completeness` blames `weights.json` | fails |
| Valueless hybrid line | valueless line B, a banded B line in scope | `kind-agreement` names line B and one `sourceModifierId` | fails |
| Hybrid vs single overlap | both contain one scoped tier, bands on the shared line intersect | `co-occur` on both entries | fails |
| Old unequal-`statId` branch | two single-line entries, different `statId`s, one tier holds both | no `co-occur`. §2.7 fails each band instead | fails (§2.7) |
| Weights absent | crafted entries, no weights file | no failure, one `weights-absent` mark per entry | listed, exit 0 |
| Partial pool | a class with a `partial` slot | no pool failure, one `partial-pool` mark per entry | listed, exit 0 |
| `needs` | hybrid with a banded line / all valueless / nothing contained | max / min `itemLevelMin` over the unscoped containment set / `undefined` | N/A |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/overlap.ts` -- `slotOverlapBranch` follows §2.1 with `S = ∅`: no shared `statId` → `undefined`. `linesIntersect` runs over the shared `statId`s. When both references are single-line, the result is `both-valueless` or `bands-intersect`. Otherwise it needs `coOccur` and returns a new branch `co-occur`, with new words. Delete the old unequal-`statId` branch. `CoOccur` takes `ModifierRef`. `overlapBranches` evaluates every pair. Add a local `statIdsOf(ref)`: `contracts` cannot import `core`.
- `packages/contracts/src/envelopes.ts:96-122` -- skip a pair that has any hybrid reference, so `contracts` keeps its §2.1 scope. Update the doc at `:49-54`.
- `packages/contracts/src/sync-run-report.ts:162` -- add `'line-set-completeness'`.
- `packages/core/src/cross-file.ts` -- remove all four `assertSingleLine(…, 5)` calls. `formatRef` renders hybrid lines. `kindAgreement` and `edgeAlignment` run per line (`linesOf(ref)`), and the payloads follow §2.3 and §2.4. `emptyContainment` adds the §2.5 hybrid exclusions. Add a new `lineSetCompleteness` (§2.7: `meets`, `reached`, `incomplete`, `mixedGroup`) to `REF_CHECKS`. `coOccur` follows §2.2 (`statIds` intersect ∧ one weight > 0 tier contains both). The pair loop (`:295-319`) evaluates only pairs with a hybrid and calls `overlapBranches` once. The result changes to `{ failures, unvalidated }`, where `UnvalidatedMark = { entryKey, categoryId, className, reason: 'weights-absent' | 'partial-pool' }`. The module doc says six checks.
- `packages/core/src/probability.ts` -- reuse `contains`, `containedIn`, `covers`, `lineSet`, `statIds`, `untrackable`, `interval` and `eligible`. Add `needs(ref, pool)` (§8, unscoped `containedIn`). Delete `assertSingleLine` when it has no caller left.
- `packages/core/src/index.ts` -- export `needs`, `lineSetCompleteness` and the `UnvalidatedMark` type.
- `packages/sync/src/chunk/catalogue-check.ts:76-79` -- check each hybrid line's `statId`, and remove the throw.
- `packages/sync/src/chunk/cross-file-gate.ts:33` -- `.failures`. The gate ignores marks.
- `packages/sync/src/curation/check.ts:176-192` -- call `crossFileChecks` also when the weights file is absent. The report gets `unvalidated` and keeps `ok` unchanged by it. The status is still `skipped` when the weights file is absent. Update the module doc.
- `packages/web/src/App.tsx:64` -- `.failures`.
- Tests: `core/src/cross-file.test.ts` (helpers `tier`, `line`, `band`, `pools`, `bows`, plus a committed-file test at `:309` that must pass), `contracts/src/overlap.test.ts` (the old `co-occur` tests at `:26-40` and `:161-175` change), `contracts/src/envelopes.test.ts:587`, `sync/src/curation/check.test.ts` and `sync/src/chunk/catalogue-check` tests.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/{overlap,envelopes,sync-run-report}.ts` + tests -- the §2.1 predicate, the `contracts` pair scope, and the new check value.
- [x] `packages/core/src/cross-file.ts`, `probability.ts`, `index.ts` + tests -- §2.2–§2.5, §2.7, §2.8 marks and §8 `needs`. One test for each matrix row.
- [x] `packages/sync/src/chunk/{catalogue-check,cross-file-gate}.ts`, `curation/check.ts` + tests -- hybrid catalogue lines, `.failures`, and the `unvalidated` list.
- [x] `packages/web/src/App.tsx` -- `.failures`.

**Acceptance Criteria:**
- Given the repo, when running `pnpm typecheck`, `pnpm lint` and `pnpm test`, then all pass.
- Given the committed data, when running `pnpm tracked:check`, then it exits 0 and `git diff --stat data/` is empty.
- Given `packages/`, when searching for `story 5` or `assertSingleLine(`, then nothing matches.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Route | Evidence |
|---|-------|---------|---------|-------|----------|
| 1 | verification-gap | §2.7 `reached` weight-0 / `not-in-game` exclusion untested | low | patch | Pre-verified: no fixture holds a zero-weight or not-in-game tier wider than the reference, so deleting the guard passes every test. |
| 2 | verification-gap | valueless half of `meets` untested | low | patch | Pre-verified: no test or committed data reaches `line.ranges.length === 0` in `meets`. |
| 3 | verification-gap | `hasHybridAffix` skips and the `coOccur` shared-`statId` conjunct are redundant | false | reject | §2.1 *Who evaluates a pair* and §2.2's first conjunct require them. They encode the owner rule and are not dead guards. |
| 4 | blind-hunter | `stories.yaml` story 7 copies §2.3 text and adds history | low | reject | Human edit made before this build. The fix edits this spec's story list. |
| 5 | blind-hunter | Verification says "only the entries of `partial` classes", but the output is `[]` | false | reject | No committed class is partial, so "only partial entries" is the empty list and the claim holds. |
| 6 | blind-hunter | Code Map and diff disagree; Implementation Notes empty | low | reject | `envelopes.test.ts:587` already asserts the skip. The extra payload ids are what §2.4/§2.3 list. The fix edits this spec. |
| 7 | blind-hunter | `linesOf` written twice; `core` exports an unused `linesOf` | low | patch | The spec sanctions a local helper in `contracts`. The public `core` export has no consumer (grep), so delete it from `index.ts`. |
| 8 | blind-hunter | §2.1 pair split coded at two call sites | low | reject | Both sites use the one `hasHybridAffix` predicate as the Code Map directs. A new `isCorePair` adds public surface for a drift no caller shows. |
| 9 | blind-hunter | no test that `core` stays silent on an all-single-line overlapping pair | low | patch | The old `CAN_NEVER_CO_OCCUR` guard is gone. No `cross-file.test.ts` case has two single-line entries with intersecting bands on one `statId`. |
| 10 | blind-hunter | no end-to-end hybrid–hybrid `co-occur`, and no suffix-slot hybrid | low | patch | Every `core` hybrid fixture is in the prefix. Hybrid–hybrid runs only against the `ALWAYS` stub in `contracts`. |
| 11 | blind-hunter | hybrid-vs-single `co-occur` test filters out the `line-set-completeness` that also fires | low | patch | `band(30, 40, A)` meets H1's A line, so §2.7 fires too. The test filters to `co-occur` and does not pin the full list. |
| 12 | blind-hunter, edge-case-hunter | §2.5 payload omits weight-0 equal-set tiers | false | reject | §2.5 lists only line-set-differs and `not-in-game` exclusions, and the code lists exactly those. |
| 13 | blind-hunter, edge-case-hunter | valueless single-line `incomplete` prints "band reaches into a hybrid tier … [1, 1]" | false | reject | §2.7 fixes the reason literal for single-line references, and §2.3 reads a valueless tier as `[1, 1]`. |
| 14 | blind-hunter | dead `line === undefined ? ''` branch in `lineSetCompleteness` | low | reject | Unreachable, but `find` is typed as possibly undefined. Removing it needs a non-null assertion or a restructure, not a deletion. |
| 15 | edge-case-hunter | the `named.filter(...)` half of `differ` in `hybridExclusions` is dead | low | patch | A tier that covers every reference line carries every named `statId`, so that half is always empty. Direct deletion. |
| 16 | blind-hunter | `tracked:check` says `cross-file: passed` when every class is partial | low | reject | Matches the Code Map and §2.8. Class discriminability did run, and the skipped pool checks are listed in `unvalidated`. |
| 17 | blind-hunter | `EXPERIENCE.md` still says five cross-file checks | low | defer | UX-owned (AGENT-WORKFLOW Review brief rule 2). §2.7 already named six before this story, so the drift predates it. [NOTE FOR UX] ledger entry. |
| 18 | blind-hunter | `SKILL.md` still says five checks and omits `unvalidated` | low | defer | An agent-context file that story 9 owns. Ledger entry. |
| 19 | blind-hunter | `needs` tests sit in `cross-file.test.ts`, and no weight-0 / `not-in-game` case | low | patch | `needs` lives in `probability.ts`, which has its own `probability.test.ts`. §8 states that a weight-0 or untrackable tier never sets a floor. |

## Design Notes

`S = ∅` keeps story 7 additive: story 7 adds `summed` and the sum conjunct to the same predicate. With `S = ∅`, §2.1's first branch never fires.

A pair loop that reports only hybrid pairs replaces the old trick "real coOccur hit, NEVER miss". With the old branch gone, a single-line pair never reads `coOccur`.

## Verification

**Commands:**
- `pnpm typecheck`, `pnpm lint` and `pnpm test` -- expected: all pass.
- `pnpm tracked:check` -- expected: exit 0, and `unvalidated` lists only the entries of `partial` classes.
