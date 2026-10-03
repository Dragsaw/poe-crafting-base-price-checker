---
title: 'Epic 3 retro item 28: one isEmptyPool definition, coverage on the failure path'
type: bugfix
created: '2026-10-03'
status: 'done'
baseline_revision: '23562c6d1f29eb1326d521f6a6def219bd83dc4f'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/docs/stories/epic-3-retro-2026-10-03.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `unrankableReasonOf` (`rank.ts`) tests only `poolCoverage === 'partial'`, while `poolCoverage` (`coverage.ts`) also tests `!isEmptyPool`. A `complete` pool of only weight-0 tiers is uncovered in the report and rankable on the page. In `run-chunk.ts`, a failure before the weights read writes a report with no coverage figures, so the panel prints "not measured" with `weights.json` loaded (retro D1, D2).

**Approach:** `unrankableReasonOf` calls `isEmptyPool` (the one definition, IN §3). An empty slot makes the class unrankable with the existing reason `recipe cannot reach this class`, recipe-free. The failure path seeds the coverage figures from the previous report, as the pause branch does.

## Boundaries & Constraints

**Always:** Reuse `isEmptyPool` from `probability.ts`. Keep both coverage fields together or both absent (AD-27). `core` stays pure.

**Never:** Add a new reason string (PRD/UX own them). Edit PRD, spine or UX documents. Change `poolCoverage`'s semantics. Touch the D3 no-recipe gap.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Empty complete pool | class whose prefix or suffix is `complete` with total weight 0 (no entries, or only weight-0 tiers) | one `unrankable` row, reason `recipe cannot reach this class`, no `recipeId`, no `provenance`; no class row, no per-recipe row | No error |
| Partial and empty | a `partial` slot | still `pool partial` | No error |
| Failure before weights read | `ports.load` or catalogue throws, previous report has both coverage fields | failure report keeps the previous pair | No error |
| Failure, no previous pair | previous report lacks them | fields absent | No error |
</intent-contract>

## Code Map

- `packages/core/src/rank.ts:276-290` -- `unrankableReasonOf`; add the empty-pool test; `RECIPE_UNREACHABLE` is at line 201; doc comments at 126-132 and 170-176.
- `packages/core/src/probability.ts:151` -- `isEmptyPool` (exported, in `core` index).
- `packages/core/src/coverage.ts:35-41` -- the covered predicate; read-only reference.
- `packages/core/src/rank.test.ts:1042-1047` -- test that pins the per-recipe row; update.
- `packages/sync/src/chunk/run-chunk.ts:580,740` -- `coverageFigures` declaration and assignment; the pause branch at 551-557 is the pattern.
- `packages/sync/src/chunk/run-chunk.test.ts:2582` -- carry-over test, pattern for a new failure-path test.
- `packages/web/src/list/active-ranking.ts:40` -- shows a recipe-free unrankable row under every recipe; no change.

## Tasks & Acceptance

**Execution:**
- `packages/core/src/rank.ts` -- return `RECIPE_UNREACHABLE` when a slot's pool `isEmptyPool`, after the partial test; update the comments on `recipeId` and `unrankable` -- one definition with coverage
- `packages/core/src/rank.test.ts` -- change the 1042 test to one recipe-free row; add a weight-0-only tier case and a partial-wins case
- `packages/sync/src/chunk/run-chunk.ts` -- seed `coverageFigures` from `previousReport.figures` when both fields exist -- failure path keeps the figure
- `packages/sync/src/chunk/run-chunk.test.ts` -- failure before the weights read keeps the previous pair

**Acceptance Criteria:**
- Given a complete pool of only weight-0 tiers, when `rank` runs with recipes, then one recipe-free `recipe cannot reach this class` row exists and `poolCoverage` counts the class as uncovered.
- Given a run that fails before the weights read and a previous report with coverage, when the report is written, then it carries that pair.

## Verification

**Commands:**
- `pnpm check` -- expected: exit 0
- `pnpm --filter @poe/core test` and `pnpm --filter @poe/sync test` -- expected: pass

## Review Triage Log

### 2026-10-03 — Review pass
- verdicts: 18 findings — high 0, medium 0, low 5, false 6, maybe-false 0 (7 more rejected as not defects of this change)
- findings:
  - `[low]` `patch` JSDoc of `weightsWith` sat above `SLOT_FILLER` (blind, edge) — moved back above `weightsWith`.
  - `[low]` `patch` "partial beside empty" test built no empty slot (blind) — rebuilt with a partial prefix and a populated suffix; asserts `pool partial`.
  - `[low]` `patch` empty suffix / weight-0 suffix / both-empty untested (blind, edge) — added a table test; each also asserts `poolCoverage` is 0.
  - `[low]` `patch` no test ties `poolCoverage` to `rank` (blind, intent) — the same table asserts both.
  - `[low]` `patch` over-long comment line in `Ranking.unrankable` (blind nit) — left as is; eslint passes. Rejected as cosmetic.
  - `[reject]` Ledger: D3 no-recipe gap has no entry (ledger auditor) — retro action item 29 (`sprint-status.yaml`) tracks it with an owner.
  - `[reject]` Seeded coverage may be stale or outlive a removed weights file (edge x2) — same carry-forward the pause branch makes (`run-chunk.ts:551`); the retro asks for exactly this.
  - `[false]` Other tests may rely on empty complete pools (edge, blind) — full suite passes, 112 files, 1682 tests; the helper change is documented in the test.
  - `[reject]` Failure tests cover one trigger (blind) — the seed happens at declaration, so every earlier trigger shares the path.
  - `[reject]` Reason wording suits a recipe-free row (blind) — the string is PM/UX-owned (`[NOTE FOR PM]` from story 3.4); not edited here.
  - `[reject]` No web test (blind, intent) — `active-ranking.ts:40` already shows recipe-free rows; no web change.

## Auto Run Result

Status: done

- **Change:** `unrankableReasonOf` uses `isEmptyPool`, the one definition `poolCoverage` uses. A class with an empty slot is one recipe-free `recipe cannot reach this class` row. `run-chunk.ts` seeds the coverage pair from the previous report, so a failure before the weights read keeps it.
- **Files:** `packages/core/src/rank.ts`, `rank.test.ts`, `packages/sync/src/chunk/run-chunk.ts`, `run-chunk.test.ts`.
- **Review:** 5 patches applied (low), 7 rejected with reasons above, none deferred.
- **Follow-up review recommended:** false.
- **Verification:** `pnpm check` exit 0; `pnpm vitest run` 112 files, 1682 tests passed.
- **Residual risk:** the empty-pool row now has no recipe id, so it appears under every recipe. No browser check was run.
