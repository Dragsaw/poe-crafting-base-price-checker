---
title: 'Consolidate the crafted-class grouping, the uncostable derivation and UnrankableClass.provenance'
type: 'refactor'
created: '2026-10-03'
status: 'done'
baseline_revision: '3c70e34c07595e96ee83c90c6f8e1b632b8cc3f3'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/docs/stories/epic-3-retro-2026-10-03.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The "non-pruned crafted entries grouped by `(categoryId, className)`" logic is written four times with differing key formats (`rank.ts`, `cross-file.ts`, `coverage.ts`, `display-rows.ts`); `web` derives "recipe is uncostable" twice (`recipe-view.ts`, `active-ranking.ts`); `UnrankableClass.provenance` is set by `core` and never read (the appendix hard-codes `TrustMark kind="unknown"`).

**Approach:** One grouping helper in `core` keyed by `classKeyOf`, used by all four sites. One owner for "uncostable" (`core`'s `Ranking.uncostableRecipes`). Drop the unread `provenance` field. Behaviour-preserving: no user-visible change.

## Boundaries & Constraints

**Always:** Pure `core` (AD-1); no new dependency edge; iteration and output order unchanged (rows, failures, appendix sort stay byte-identical); `pnpm check` and `pnpm test` pass offline.

**Never:** No change to rendered output, reasons, or the weights/dataset contracts. No new field on `contracts`. Do not hand-edit `openwiki/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Grouping | tracked list with pruned, raw and crafted entries, two entries in one class | one group per class, pruned/raw excluded, insertion order kept | No error expected |
| Uncostable recipe | recipe with a currency lacking a rate | cost line prints the money-slot phrase and `ActiveRanking.uncostable` is true, both from one derivation | No error expected |
| Partial-pool appendix row | class with `pool partial` | row still renders the `unknown` TrustMark | No error expected |

</intent-contract>

## Code Map

- `packages/core/src/rank.ts` -- `classKeyOf` (l.214), grouping at ~l.326-345 (`rankableClasses`, `unrankable` keyed on `JSON.stringify([..])`), `UnrankableClass.provenance` (l.122-) set at the `pool partial` branch.
- `packages/core/src/cross-file.ts` -- `byClass` grouping in `crossFileChecks` (~l.231-240).
- `packages/core/src/coverage.ts` -- `poolCoverage` class set (l.23-28).
- `packages/web/src/list/display-rows.ts` -- `trackedByClass` (l.136-148), already uses `classKeyOf`.
- `packages/web/src/recipe/recipe-view.ts` -- `recipeCostLine` re-derives uncostable via `craftCost(...).ok`; called from `packages/web/src/App.tsx:123`.
- `packages/web/src/list/active-ranking.ts` -- `forRecipe` derives `uncostable` from `ranking.uncostableRecipes`.
- `packages/web/src/list/UnrankableAppendix.tsx:111` -- hard-coded `TrustMark kind="unknown"`.
- `packages/core/src/index.ts` -- public exports; tests: `rank.test.ts` (provenance literals at l.452, 536, 1064), `unrankable-appendix.test.tsx`.

## Tasks & Acceptance

**Execution:**
- `packages/core/src/crafted-classes.ts` -- add `craftedClassesOf(entries)`: non-pruned crafted entries grouped by `classKeyOf`, insertion order -- single grouping owner; export via `index.ts`.
- `packages/core/src/rank.ts`, `cross-file.ts`, `coverage.ts` -- use it; key every class map on `classKeyOf`; remove `provenance` from `UnrankableClass` and its setter.
- `packages/web/src/list/display-rows.ts` -- replace `trackedByClass` with the core helper (keep canonical key attachment).
- `packages/web/src/recipe/recipe-view.ts`, `App.tsx` -- take uncostable from `Ranking.uncostableRecipes` (via `forRecipe`'s flag) instead of a second `craftCost` ok-check; the figure is still core's `craftCost`.
- Tests -- add a `crafted-classes` unit test for the matrix row; drop `provenance` from `rank.test.ts` expectations; keep existing tests green.

**Acceptance Criteria:**
- Given the tracked list, when any of rank, cross-file checks, coverage or the display rows group crafted entries, then all four use the one `core` helper and no `JSON.stringify([categoryId, className])` grouping remains outside it.
- Given an uncostable recipe, when the page renders, then the cost line and the split/uncostable list statement agree and derive from `Ranking.uncostableRecipes` only.
- Given a `pool partial` class, when the appendix renders, then the row shows the `unknown` mark and `UnrankableClass` has no `provenance` field.
- Given the existing suite, when `pnpm check` and `pnpm test` run, then both pass with no changed snapshot or rendered text.

## Design Notes

The `recipes.length === 0` and recipe-scoped `unrankable` keys in `rank.ts` (l.428, 442) also differ in shape; they key distinct things (class vs class+recipe) and stay as local keys, but build them from `classKeyOf` plus the recipe id.

## Verification

**Commands:**
- `pnpm check` -- expected: exits 0
- `pnpm test` -- expected: all pass, no network escape

## Review Triage Log

### 2026-10-03 — Review pass
- verdicts: 20 findings — high 0, medium 0, low 5, false 6, maybe-false 0 (9 rejected as intended or unreachable)
- findings:
  - `[low]` `patch` trailing space in renamed appendix test title (two layers) — fixed.
  - `[low]` `patch` `craftedClassesOf` test thin (empty, pruned-only, same className under two categoryIds) — two cases added.
  - `[low]` `patch` `coverage.ts` one-liner convoluted — now iterates the helper's groups directly.
  - `[low]` `patch` `useMemo` keyed on whole `view` — keyed on `readySet`, `readyFailures`, `threshold`.
  - `[low]` `patch` retro item 32 not marked done — `sprint-status.yaml` updated.
  - `[low]` `reject` `recipeCostLine` still calls `craftCost` (double derivation, 3 layers) — the figure needs it; the flag and cost read the same `craftCost` inputs in `rank.ts`; the throw is for an unreachable state (loud failure is correct).
  - `[low]` `reject` render-time throw / untested throw branch / duplicate recipe ids — unreachable (recipes file schema); no reachable repro shown.
  - `[low]` `reject` App does its own `uncostableRecipes.some` instead of `forRecipe` — `forRecipe` runs inside `ReadyBody` for the list; the cost line sits in the masthead above it; negligible.
  - `[false]` `reject` rank two-pass ordering shift — `unrankable` is sorted by `byItemClass` afterwards and rankable classes keep first-seen order; the `rank.test.ts` suite passes unchanged.
  - `[false]` `reject` key-format change unguarded (`classKeyOf` prefix) — keys are internal to `rank`; `rank.test.ts` covers `class disagrees with weights file`.
  - `[false]` `reject` `envelopes.ts` / appendix React key still stringify pairs — different contract (schema validation, React key), not grouping.
  - `[false]` `reject` unreachable `first === undefined` guards / non-empty tuple type — type-narrowing only under `noUncheckedIndexedAccess`; changing the helper's type adds surface.
  - `[false]` `reject` intent reading C (wire provenance into appendix) — the product prints one `unknown` mark; the field carried nothing to show.
  - `[false]` `reject` stale line numbers in spec, index.ts comment, AD-10 note on removed field — cosmetic / spec edits are out of review.

## Auto Run Result

Status: done

- Summary: one `core` helper (`craftedClassesOf`, `classKeyOf`) now owns the crafted-class grouping for `rank`, `cross-file`, `coverage` and `display-rows`; `recipeCostLine` takes its uncostable flag from `Ranking.uncostableRecipes` (ranking computed once in `App`); `UnrankableClass.provenance` removed.
- Files: `packages/core/src/{crafted-classes,rank,cross-file,coverage,index}.ts`, tests, `packages/web/src/{App.tsx,list/display-rows.ts,recipe/recipe-view.ts}`, `docs/stories/sprint-status.yaml`.
- Review: 5 patches applied (all low), 0 deferred, rest rejected with reasons above.
- followup_review_recommended: false.
- Verification: `pnpm check` and `pnpm test` (re-run after patches, see commit).
- Residual risks: the `data` test project was not run; no browser check.
