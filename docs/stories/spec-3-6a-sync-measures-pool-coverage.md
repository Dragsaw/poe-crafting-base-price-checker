---
title: 'Story 3.6a: sync measures pool coverage (AD-27)'
type: 'feature'
created: '2026-10-02'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-3-context.md'
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/AGENT-WORKFLOW.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `SyncRunFiguresSchema` has optional `coverage` and `rankableClassCount`, and `web` already renders them, but nothing in `sync` computes them. With `weights.json` present the panel therefore always says *not measured*. Split from Story 3.6 (the last five ACs of `docs/epics.md` Story 3.6).

**Approach:** A pure function in `core` computes the AD-27 fraction from the tracked entries and the loaded Weights File. `sync` calls it on every report write that has read the weights file and puts both figures into `figures`. Nothing else changes.

## Boundaries & Constraints

**Always:**
- The predicates and the fraction are `IMPLEMENTATION-NOTES.md` §3's. Cite them, do not restate them in code comments or docs.
- The unit is the `(categoryId, className)` pair of a `crafted` entry. A raw entry is in neither half. A class whose every crafted entry is `pruned` is in neither half. An unresolved Stat Line (`statId: null`) does not affect the figure.
- `covered` is a direct lookup at both rungs with no fallback to a sibling class. `core` already exports `poolOf` for this. A pool is empty when its total weight is `0`, so a slot of only weight-0 tiers is not covered.
- `coverage` is a number in `[0, 1]`, never a percentage. `rankableClassCount` is the denominator and is written with it.
- When `data/weights.json` is absent, omit both fields together. With the file present and no rankable class, the fraction is undefined, so omit both then too. Never write `coverage: 0` for a missing figure.
- The figure is recomputed from the file on disk on every report write. No detector, cache or new report field is added.
- `core` stays pure. `sync` imports `core` already (`ALLOWED_EDGES` allows it).
- The paused (`notBefore`) early return carries the previous report's two fields over unchanged.

**Never:**
- No threshold reads the figure. No `web` change. No new `contracts` field. No git write. No network call.
- `web` does not recompute the figure.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mixed | 4 rankable classes; 3 covered | `coverage: 0.75`, `rankableClassCount: 4` | N/A |
| Partial slot | one slot `partial` | class not covered, still in the denominator | N/A |
| Class absent | no `bases[cat][class]` | not covered; no sibling fallback | N/A |
| Empty pool | slot `complete`, total weight `0` | not covered | N/A |
| Pruned only | every crafted entry of a class `pruned` | class in neither half | N/A |
| Raw only | only raw entries | both fields omitted | N/A |
| No file | `weights.json` absent | both fields omitted | run continues as today |
| Invalid file | unknown major or invalid | unchanged: the run refuses | existing `DataFileError` path |

</frozen-after-approval>

## Code Map

- `packages/core/src/probability.ts` -- `poolOf` (two-rung lookup, ~116), private `totalWeight` (~139). Export an empty-pool predicate rather than copy the sum.
- `packages/core/src/cross-file.ts` -- private `isPoolCheckable` tests `!== 'partial'`. It is close to "both slots complete" but not the same predicate. Do not change it.
- `packages/core/src/rank.ts` -- `classKeyOf` (~206) for the class key.
- `packages/sync/src/chunk/run-chunk.ts` -- `writeReport` (~675-696) builds `figures`. `readWeightsIds` runs at ~725, `weights.kind === 'absent'` at ~733. Hoist the figures after the read, as `entries` is. Call sites at ~775, ~865, ~888, ~919. The paused return at ~544 passes bare figures.
- `packages/sync/src/chunk/sync-report.ts` -- `buildSyncReport` already accepts the optional fields. No signature change.
- `packages/web/src/frame/trust-facts.ts` -- `coverageGroup` (~232) reads both fields. Do not change.
- Tests: `chunk/sync-report.test.ts`, `chunk/run-chunk.test.ts` (`harness`, `reportOf`), `dry-run.test.ts` (`reportOf` expectations, `WEIGHTS` ~69), plus a new `core` test beside `probability`.

## Tasks & Acceptance

**Execution:**
- [ ] `packages/core/src/probability.ts` -- export an empty-pool predicate -- one definition of "empty" for the figure
- [ ] `packages/core/src/coverage.ts` -- add pure `poolCoverage(entries, weights)` returning `{ coverage, rankableClassCount }` or `undefined` -- the single implementation of §3; export from the package index
- [ ] `packages/core/src/coverage.test.ts` -- one case per matrix row
- [ ] `packages/sync/src/chunk/run-chunk.ts` -- compute after the weights read; spread into `figures` in `writeReport`; carry the previous fields on the paused return -- every report write states the figure
- [ ] `packages/sync/src/chunk/run-chunk.test.ts` -- present file writes both fields; absent omits both; paused keeps the previous pair
- [ ] `packages/sync/src/dry-run.test.ts` -- update expectations if the fixture weights now yield a figure

**Acceptance Criteria:**
- Given a present Weights File, when a chunk finishes, then `data/sync-report.json` carries `coverage` in `[0, 1]` and `rankableClassCount`, and both parse under `SyncReportFileSchema`.
- Given the weights file is replaced between two chunks, when the second chunk finishes, then the report holds the figure of the new file.
- Given `pnpm sync:dry`, when the weights file is present, then the printed `report.figures` carries both fields and nothing is written to disk.
- Given the figure moves, then no `web` code or layout changes.

## Verification

**Commands:**
- `pnpm check` -- expected: exit 0, no new dependency edge
- `pnpm test` -- expected: all pass, no escaped network URL
- `pnpm sync:dry` -- expected: `report.figures.coverage` present when `data/weights.json` exists
