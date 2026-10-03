---
title: 'Add the hybrid reference arm to TrackedFileSchema'
type: 'feature'
created: '2026-10-03'
status: 'done'
baseline_commit: '192f566a2e213b36e97365908938f207b9fd37c5'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/specs/spec-tracked-hybrid-mods/SPEC.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A `ModifierRef` names one `statId` (AD-5), so a curator cannot write one reference for every stat line of a hybrid modifier. SPEC-tracked-hybrid-mods CAP-1 adds the third AD-5 kind, `hybrid`.

**Approach:** Add a `hybrid` arm to `ModifierRefSchema`: `{ kind: 'hybrid', lines, acceptedTier? }`. Validate the lines with the IMPLEMENTATION-NOTES §4.1 shape rules and sort them by `statId` on parse. Encode the arm with §4.1's `["hybrid", [line, …]]` form. Keep every consumer compiling. Do not price, check or render a hybrid yet. Stories 4–8 do that.

## Boundaries & Constraints

**Always:** Cite §4.1 and §2.1. Do not restate them. A line takes its kind from its edges: it has both edges or none, and carries no `kind` and no `acceptedTier` (§4.1). The single-line encodings and the 2.0.0 tracked version do not change. `contracts` evaluates overlap only for a pair whose four references are single-line (§2.1 *Who evaluates a pair*). Follow the AGENTS.md MCP tool rule.

**Decision (interim consumers):** Until stories 4–8 land, each core, sync and web `hybrid` branch throws an explicit error that names the story that will replace it, for example `hybrid references are not supported yet (SPEC-tracked-hybrid-mods story 4)`. The committed data holds no hybrid, so this branch is unreachable today. The user chose this over an interim unvalidated mark and over a schema-only arm.

**Never:** Implement CAP-2..CAP-7: probability, cross-file checks, the `line-set-completeness` enum value, the search body, summed `statId`s or labels. Edit owner documents. Change the weights contract. Add a hybrid entry to committed data (story 9).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Banded hybrid | Bows prefix with lines `stat_691932474 [a,b]` and `stat_1509134228 [c,d]` | parses; lines sorted by `statId` | N/A |
| Mixed lines | one banded line and one `{statId}` line | parses | N/A |
| Reordered lines | the same lines in two orders | equal canonical keys | N/A |
| Key shape | hybrid affix | `["hybrid", [[s1,min,max],[s2,null,null]]]`; differs from each line encoded alone; ignores `acceptedTier` | N/A |
| Too few lines | 0 or 1 line | rejected at `lines` | schema issue |
| Repeated / empty `statId` | two lines with one `statId`, or `statId: ''` | rejected at the line | schema issue |
| Bad band | `min > max`, a negative value, `Infinity`/`NaN`, or one edge only | rejected at the line | schema issue |
| Line extras | a line with `kind` or `acceptedTier` | rejected (strict) | schema issue |
| Hybrid pair in contracts | two crafted entries, either one with a hybrid reference | the within-file overlap does not evaluate the pair | N/A |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/modifier-ref.ts` -- add `HybridLineSchema` (a union of a strict `{statId, valueMin, valueMax}` and a strict `{statId}`) and `HybridModifierRefSchema`. Use `lines: z.array(line).min(2)` with a duplicate check and a sorting `.transform` that uses `compareByCodeUnit`. Keep the transform on the `lines` field, not on the object, so the object stays a `ZodObject` inside `discriminatedUnion` (zod 4.6.5). Export a `SingleLineModifierRef = Banded | Valueless` type for code that reads `.statId`.
- `packages/contracts/src/canonical-key.ts` -- `CanonicalAffix` gains `readonly ['hybrid', readonly CanonicalLine[]]`. Add a `hybrid` case to `encodeAffix`. `compareByCodeUnit` is already here. Import it into `modifier-ref.ts` without an import cycle: `canonical-key.ts` imports only types.
- `packages/contracts/src/overlap.ts` -- `CoOccur`/`slotOverlapBranch` take `SingleLineModifierRef`. `overlapBranches` returns `undefined` when any of the four refs is hybrid, and the comment cites §2.1. `envelopes.ts` `TrackedFileSchema` needs no change beyond that.
- `packages/contracts/src/index.ts` -- export the new schemas and types.
- Consumers that switch on `ref.kind` or read `ref.statId` (the interim throw goes here): `packages/core/src/probability.ts` (`contains`, `containedIn`, `affixProbability`, `combinationProbability`), `packages/core/src/cross-file.ts` (`formatRef`, `REF_CHECKS`, the pair loop), `packages/sync/src/pricing/search-body.ts` `statFilterOf`, `packages/sync/src/chunk/catalogue-check.ts:75`, `packages/web/src/list/combination-text.ts` `affixText`.
- Tests: `modifier-ref.test.ts`, `canonical-key.test.ts`, `tracked-entry.test.ts`, `envelopes.test.ts` (an entry with a hybrid parses through `TrackedFileSchema`; a hybrid pair is not refused), `overlap.test.ts`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/modifier-ref.ts` -- the hybrid line and arm, the shape rules, the sort, and the `SingleLineModifierRef` type -- CAP-1.
- [x] `packages/contracts/src/canonical-key.ts` -- the hybrid encoding -- §4.1.
- [x] `packages/contracts/src/overlap.ts` -- skip pairs with a hybrid -- §2.1.
- [x] `packages/contracts/src/index.ts` -- the exports.
- [x] core, sync and web consumers in the Code Map -- the interim `hybrid` throw, one test for each package -- the build compiles.
- [x] contracts tests -- one test for each row of the matrix.

**Acceptance Criteria:**
- Given the repo, when running `pnpm typecheck`, `pnpm lint` and `pnpm test`, then all pass.
- Given the committed data, when running `pnpm tracked:check`, then it passes, and `git diff --stat data/` shows nothing.

## Design Notes

Sorting happens in the schema, so `z.infer` yields sorted lines, and no consumer re-sorts (§4.1). A strict two-object union gives each line its kind with no `kind` field, and a one-edge line fails both members. The non-negative and finite rules apply only to hybrid lines. §4.1 does not extend them to single-line `banded`.

## Verification

**Commands:**
- `pnpm typecheck` and `pnpm lint` -- expected: no errors.
- `pnpm test` -- expected: all pass.
- `pnpm tracked:check` -- expected: pass.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Route | Evidence |
|---|--------|---------|---------|-------|----------|
| 1 | blind | `catalogue-check.ts` interim throw names story 6 | low | patch | The catalogue check runs at the sync gate and in `tracked:check`, which stories.yaml gives to story 5; story 6 is the search body. |
| 2 | blind | `tracked:check` throws, not reports, on a hybrid | false | reject | The throw is the frozen interim-consumers decision; committed data holds no hybrid until story 9. |
| 3 | blind | A bad hybrid line reports a generic `invalid_union` at `lines.N` | low | reject | Real, but the matrix asks only "rejected at the line" and the Code Map prescribes the strict union; a curator meets it only after story 9, and the fix restructures the schema. |
| 4 | blind | No envelope test for a reordered duplicate hybrid | false | reject | `TrackedFileSchema`'s duplicate rule calls `canonicalKey` (`envelopes.ts:64`), whose order independence `canonical-key.test.ts` pins; no defect. |
| 5 | blind | Missing tests: unknown key on the hybrid, bad `acceptedTier`, `valueMax`-only line, all-valueless hybrid | false | reject | Test-breadth suggestion with no bad outcome: the object is `strictObject`, `acceptedTier` reuses `AcceptedTierSchema`, both strict line members reject one edge either way. |
| 6 | blind | Narrowing `CoOccur` to `SingleLineModifierRef` forces story 5 to widen it | low | reject | The Code Map prescribes it; the widening is a one-type change in story 5 with no user harm. |
| 7 | blind | `assertSingleLine` repeated in `containedIn`/`combinationProbability`; cross-file story-5 throw untested | false | reject | The Code Map names each of those functions for the interim throw; redundancy has no named harm, and the reachable cross-file throws are type-required (verification-gap layer). |
| 8 | blind | Runtime import `modifier-ref.ts` → `canonical-key.ts` has no cycle guard | low | patch | `canonical-key.ts` imports the module as types only; a later value import would TDZ at load. A one-line comment guards it. |
| 9 | blind | The finite rule relies on zod 4 defaults | false | reject | The `Infinity`/`NaN` rows in `modifier-ref.test.ts` fail if a zod change drops the rule. |
| 10 | blind | Dead `...rest` in `withPrefix`; long `flatMap` lines; duplicated test helper | low | patch (rest only) | `...rest` is never passed: direct deletion. Long lines pass `pnpm lint`; the duplicated helper is two test lines — rejected as cosmetic. |
| 11 | blind | `SingleLineModifierRef` hand-written; two hybrid guards | low | reject | The Code Map prescribes `Banded \| Valueless`; no fourth kind is planned; no named harm. |
| 12 | edge | `encodeAffix` does not sort code-built hybrids | false | reject | §4.1 and the Design Notes: the schema sorts on parse and no consumer re-sorts; every ref in production passes the schema. |
| 13 | edge | `overlap()` returns `false` for a hybrid pair | false | reject | No production caller of `overlap()` exists; `core` uses `overlapBranches`, which returns `undefined` per §2.1. |
| 14 | edge | zod skips the duplicate check when a line fails | low | reject | The curator sees the duplicate after fixing the bad line; unlikely, and the fix adds a raw-input pre-pass. |
| 15 | edge | One hybrid aborts the whole catalogue check | false | reject | The frozen interim decision: each hybrid branch throws; committed data holds none. |
| 16 | verification | No gap findings | — | — | Each behavioral change traced to a test. |
| 17 | verification | The pair-loop `assertSingleLine` in `crossFileChecks` is unreachable | low | patch | Confirmed at `cross-file.ts:282-292`: every keyed entry runs REF_CHECKS (`emptyContainment` asserts both slots) before the pair loop. Same root as part of #7. |
| 18 | verification | The envelope hybrid-pair test passes without the `overlapBranches` guard | low | reject | With `NEVER_CO_OCCUR` a hybrid falls through to `false` anyway; the guard is pinned by `overlap.test.ts`. No user harm. |
| 19 | ledger | No findings | — | — | All carved-out work is owned by stories 4–9 in stories.yaml. |
