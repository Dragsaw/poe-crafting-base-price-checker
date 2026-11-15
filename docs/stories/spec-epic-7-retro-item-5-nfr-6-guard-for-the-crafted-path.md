---
title: 'An NFR-6 guard for the crafted path, and one eligible set per pool and scope'
type: 'feature'
created: '2026-11-15'
status: 'done'
route: 'dispatch'
review_loop_iteration: 1
baseline_commit: '33f3292ab7f64a10307378a45f1e7a2df610a719'
context:
  - '{project-root}/docs/stories/epic-7-retro-2026-11-15.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic 7 retro action item 5 (D2, ADV-4). No committed test ranks a crafted row or the committed `data/tracked.json` against NFR-6 (AD-24: under 100 ms). `purity-and-budget.test.ts` ranks synthetic raw entries only. On HEAD `33f3292` (bare `node`, every active entry priced), `rank` took a warm 88–90 ms at 82. The first pass after `crossFileChecks` took 99–110 ms, and the first pass in a fresh process took 125 ms. The warm margin is under 10 ms, so the retro's condition for ADV-4 holds. `combinationProbability` rebuilds the `eligible` set and its total weight for every entry, although one set serves every entry of the same pool, level and recipe floor.

**Approach:**
- A `*.data.test.ts` guard (so `pnpm check` runs it). It parses the committed `tracked`, `weights`, `recipes`, `dataset` (only `currencyRates`) and `config` files with their schemas. It prices every non-pruned entry in the active league, and it ranks at each level of `CRAFTING_ITEM_LEVELS` as `App.tsx` does. One pass covers every recipe (AD-4).
- One `eligible` set and its total weight are cached per `(pool, itemLevel, modifierLevelMin)`, keyed on pool identity as `ownInterval` is. `eligible` itself stays a plain function.

**Decision (agent), the timed cases:** each case is the fastest of five samples at each level.
- **Warm:** the same parsed inputs (a threshold change).
- **Memo-empty:** a fresh parse of the raw weights before each sample, outside the timed region. This bounds a level switch onto lines not yet derived (AD-4).
- The fresh-process first pass is one JIT-cold sample per process, so it is recorded and not asserted.

**Decision (human, 2026-11-15, review 1), not vacuous:** the guard asserts only that at least one crafted row exists and that some row has a summand. It asserts no empty bucket on the live data: `uncostableRecipes` follows the tick-owned `currencyRates`, and `unpricedCrafted` holds FR-38 states. Each timing failure message lists the samples.

**Decision (human, 2026-11-15), the bound in the gate:** the timed assertions use **250 ms**, not 100 ms. Stage B of `pnpm check` runs `test`, `test:data` and `build` in parallel, and that load roughly triples the samples. The gate catches gross regressions. The 100 ms NFR-6 bound itself is verified by a run alone, recorded in Implementation Notes. `pnpm check`'s stages do not change.

**Decision (human, 2026-11-15, review 1), off the deploy path:** `deploy.yml` runs `pnpm check` on every push to `master`, including each 4-hourly Pi tick. The timed cases skip there, so runner noise never blocks a price deploy. They still run on a pull request and at pre-push. `deploy.yml` sets an environment variable on its `pnpm check` step, and the guard reads it. The non-timed tests still run on deploy.

## Boundaries & Constraints

**Always:** `rank` output is byte-identical before and after the cache. The cache is module-local and keyed on pool identity (a `WeakMap`). Comments state only a non-obvious why, in three lines or fewer, citing AD-24.

**Never:** change `tools/check/`, `vitest.config.ts` or the 5,000-raw test. Never suppress `max-lines`. Never export the cache from `@poe/core`. Never edit `AGENT-WORKFLOW.md` (architect-owned): ledger a note instead.

</frozen-after-approval>

## Code Map

- `git stash list` → `stash@{0}` "item5 before loopback" -- the first derivation. Restore the code from it: `git checkout stash@{0} -- packages/core/src/probability.ts` and `git checkout 'stash@{0}^3' -- packages/core/src/probability/pool-memo.ts packages/core/src/rank/budget.data.test.ts` (`^3` holds the untracked files). Do not restore `sprint-status.yaml` or `deferred-work.md` from it. Drop the stash only after `pnpm check` passes.
- `packages/core/src/probability.ts` -- `combinationProbability`'s `setsOf` reads `eligibleSets(pool, "L:mlm", derive)`. Keep as stashed.
- `packages/core/src/probability/pool-memo.ts` -- `memoByPool()`, a `WeakMap<pool, Map<key, V>>`. Keep as stashed.
- `packages/core/src/rank/budget.data.test.ts` -- the guard, restored, then amended (Tasks). `core` has no Node types: read the variable as the file already reads `dirname`, through a cast of `import.meta` (`.env`, which Vitest fills from the process environment; confirm with the AC). The clock stays `Date.now()`.
- `.github/workflows/deploy.yml:47` -- the `pnpm check` step. Its header (lines 7-9) says the gate runs `test:data`.
- `.github/workflows/test.yml:8-10` -- the comment claims `deploy.yml` skips `test:data`. That is false.
- `docs/stories/sprint-status.yaml` -- action item 5.
- `docs/stories/deferred-work.md` -- append only.

## Tasks & Acceptance

**Execution:**
- [x] `packages/core/src/probability.ts`, `packages/core/src/probability/pool-memo.ts` -- restore from the stash -- ADV-4 headroom.
- [x] `packages/core/src/rank/budget.data.test.ts` -- restore, then: drop the four empty-bucket assertions; skip the two timed cases when `RANK_BUDGET_TIMING` is `off`; reword the `BUDGET_MS` comment so it does not claim a committed 100 ms check; retitle the memo-empty case "every pool memo empty"; make the `everyEntryPriced` JSDoc claim only that pricing gates no crafted row; add one non-timed case per level asserting `rank` with the parsed weights `toEqual` `rank` with `freshWeights()` -- the review 1 decisions and rows 7–10.
- [x] `.github/workflows/deploy.yml` -- `env: RANK_BUDGET_TIMING: 'off'` on the `pnpm check` step; one header sentence on why (runner noise must not block a tick's deploy, AD-24).
- [x] `.github/workflows/test.yml` -- correct lines 8-10: `deploy.yml` runs `test:data` too, with the timed cases off.
- [x] `docs/stories/sprint-status.yaml` -- item 5 `done`, `last_updated`.
- [x] `docs/stories/deferred-work.md` -- append two entries under one `## Deferred from: spec-epic-7-retro-item-5 (2026-11-15)` heading: (1) the `test.yml` `code` filter omits `data/**`, so a data-only PR never runs the timed guard; only pre-push does, which `--no-verify` and web edits bypass, and deploy skips it. (2) `[NOTE FOR ARCHITECT]` the "gate runs in four places" paragraph of `AGENT-WORKFLOW.md` should say `deploy.yml` turns the NFR-6 timed cases off.

**Acceptance Criteria:**
- Given the committed data, when `pnpm check` runs, then it passes and the timed cases run.
- Given `RANK_BUDGET_TIMING=off`, when `pnpm test:data` runs, then the timed cases report skipped and every other case passes.
- Given the committed data, when `pnpm check --only test:data` runs alone with the bound briefly set to 1 ms, then every failure message shows samples under 100 ms.
- Given each level, when the warm-vs-fresh case runs, then the two rankings are equal.

## Spec Change Log

- **Review 1 (2026-11-15), intent_gap, rows 1–5.** `deploy.yml` runs `test:data` on every Pi tick, so the wall-clock cases and the live-data bucket assertions could block a price deploy. The human decided: timed cases off on deploy, non-vacuity only. Amended: the frozen decisions, Code Map, Tasks, AC. Known-bad state avoided: an unmeasured runner or a tick missing one currency rate blocks the 4-hourly deploy. **KEEP:** the cache in `probability.ts` and `pool-memo.ts` as stashed (byte-identical `rank` dumps, lint clean); the guard's loader, `inputAt`, `fastest` and sample messages; `BUDGET_MS = 250`; `SAMPLES = 5`.

## Implementation Notes

**Evidence from the first derivation** (Windows dev machine):
- Without the cache, alone: L82 memo-empty 112 ms. With it, alone, fastest of 5: L79 warm 41, memo-empty 55; L82 warm 55, memo-empty 70 (max single sample 85).
- Inside `pnpm check` at a 100 ms bound: L79 101/119 ms, L82 123/155–180 ms, so the human set 250.
- Fresh process with the cache (bare `node`): first pass L82 81–83 ms, L79 63–64 ms. The `rank` dumps before and after the cache were byte-identical (`cmp`, 7 MB).
- Thread CPU time instead of wall time was tried and reverted: 15.6 ms steps on Windows, and it still doubles under the gate.

**Evidence from the loopback** (same machine, 2026-11-15):
- The Code Map premise is false: Vitest 5's `import.meta.env` holds 5 keys and no unprefixed process variable (a probe read `undefined` with `RANK_BUDGET_TIMING=off`). The guard reads `process.env` through a cast of `globalThis` instead; the `core` purity lint exempts tests. The variable name stays `RANK_BUDGET_TIMING`.
- `pnpm check --only test:data` alone at a 1 ms bound, samples in ms: L79 warm 40, 42, 49, 39, 39; L79 memo-empty 63, 60, 59, 55, 58; L82 warm 59, 54, 56, 61, 54; L82 memo-empty 72, 67, 74, 68, 71. Every sample is under 100 ms.
- `RANK_BUDGET_TIMING=off`: 4 passed, 4 skipped in `budget.data.test.ts`. `pnpm check`: 8 passed, twice.

**Verification after review 2** (same machine, 21:25 local, HEAD `33f3292ab7f64a10307378a45f1e7a2df610a719`, dirty tree: the uncommitted change):
- `pnpm check`: 8 passed, twice (`test:data` 10.4 s).
- `RANK_BUDGET_TIMING=off pnpm test:data`: 14 passed, 4 skipped of 18.
- `pnpm check --only test:data` alone at a 1 ms bound, samples in ms: L79 warm 38, 40, 47, 40, 39; L79 memo-empty 62, 60, 59, 63, 65; L82 warm 53, 54, 50, 51, 51; L82 memo-empty 65, 70, 68, 65, 70. Every sample is under 100 ms. Restored to 250.

## Verification

**Agent browser checks:** none needed. The page cannot change. The cache returns the same pure result (the warm-vs-fresh case and the recorded dumps); the rest is tests and CI config.

**Commands:**
- `pnpm check` -- expected: 8 passed (run twice).
- `RANK_BUDGET_TIMING=off pnpm test:data` -- expected: pass, with the timed cases skipped (count them in the output).
- `pnpm check --only test:data` with the bound briefly 1 ms -- expected: samples under 100 ms in the failure messages. Restore 250.

## Review Triage Log

Review 1 (2026-11-15). Layers: blind-hunter, edge-case-hunter, verification-gap, deferred-ledger-audit (0 findings), ocr-delegate (0 findings). impeccable-design-review skipped: no `packages/web/src/` change.

| # | Layer | Location | Verdict | Route | Evidence |
|---|---|---|---|---|---|
| 1 | edge | `budget.data.test.ts` timed cases | medium | intent_gap (A1) | `deploy.yml:7-9,47` runs `pnpm check` (so `test:data`) on every push to `master`; the Pi pushes every 4 h (`ops/pi/README.md:4-5`). A timed sample over 250 ms on `ubuntu-latest` blocks that tick's deploy. This branch's own PR runs the guard on the runner (the `code` filter fires on `*.ts`), so a systematic overrun is caught before merge; the residue is intermittent runner noise costing one tick. The frozen bound reasons only about the local gate. |
| 2 | blind | `budget.data.test.ts` `BUDGET_MS` | medium | intent_gap (A1) | The 250 ms bound has samples from one Windows machine only; no `ubuntu-latest` sample exists, and the runner gates deploys (row 1). A passing run prints no samples. |
| 3 | verification-gap | `budget.data.test.ts` timed cases | medium | intent_gap (A1) | Same root as rows 1–2: the Pi pushes with `--no-verify`, so on a tick the runner is the only place the guard runs. |
| 4 | edge | `budget.data.test.ts` `uncostableRecipes` assertion | medium | intent_gap (A2) | `uncostableOf` (`rank.ts:288`) lists a recipe whose currency has no rate, a state `rank` handles. `dataset.json` (with `currencyRates`) is tick-owned (`ops/pi/tick.sh:8`), and no other `*.data.test.ts` fails on a missing recipe rate, so a tick that lacks one recipe currency newly fails `test:data` and blocks the deploy. The frozen block mandates the assertion. |
| 5 | edge, verification-gap | `budget.data.test.ts` `unpricedCrafted` and summand assertions | low | intent_gap (A2) | FR-38 nothing-counts rows go to `unpricedCrafted` (`rank.ts:213-215,270-271`); `tracked:check` accepts an entry reached at any offered level (`check.ts:218-222`). A class whose every entry floors above 79 passes curation and fails the guard at L79. `tracked.json` is not tick-owned, so this fails at the curator's pre-push, not on a tick. Passes today. Mandated by the frozen block. |
| 6 | edge, verification-gap, blind | `deferred-work.md` new entry | medium | patch (moot: loopback) | Its evidence repeats the stale `test.yml:8-10` comment. `deploy.yml` does run `test:data`, so "only the pre-push hook runs the guard" and "the fix must keep that path" are false. The Pi pushes with `--no-verify`. |
| 7 | blind | `budget.data.test.ts:21-22` comment | low | patch (moot: loopback) | "a run alone checks 100 ms" — no committed code asserts 100 ms; the check was a manual run with the bound set to 1 ms. |
| 8 | blind | `budget.data.test.ts` memo-empty test title | low | patch (moot: loopback) | "every memo empty" overstates: only pool-keyed memos reset; JIT and the parsed tracked/recipes/dataset objects stay warm. |
| 9 | blind | `budget.data.test.ts` non-vacuity | low | patch (moot: loopback) | Asserts one crafted row with a summand, not every recipe id; the `everyEntryPriced` JSDoc ("every crafted summand is computed") is unverified. |
| 10 | blind | byte-identical constraint | low | patch (moot: loopback) | Checked once by hand (`cmp`); a warm-vs-fresh-weights `toEqual` at each level would commit it cheaply. |
| 11 | blind | `pool-memo.ts` has no unit test | false | reject | `combination.test.ts:15-31` and `crafting-item-level.test.ts` fail if the key drops `modifierLevelMin` or `itemLevel` (verification-gap layer). |
| 12 | blind | `affixProbability`, `recipeReach` bypass the memo | low | reject | Same values; no measured cost outside `rank`; the fix widens scope. |
| 13 | blind | `ownIntervals` keeps its own `WeakMap` | low | reject | Style only; no caller diverges; the fix is a refactor. |
| 14 | blind | loader copied from `own-interval.data.test.ts` | low | reject | `jscpd` passed in `pnpm check`; the fix is a new shared module. |
| 15 | blind | `sprint-status.yaml` item 5 `done` early, `ref` | low | reject | Lands in the same branch as the spec; `ref` cosmetic. |
| 16 | blind | `probability.ts` near `max-lines` | false | reject | `pnpm check` lint passed twice with the change. |
| 17 | edge | stale memo if a pool is mutated | false | reject | No caller mutates a parsed pool; `ownIntervals` already relies on the same invariant. |
| 18 | edge | `inputAt` omits `crossFileFailures` | false | reject | `RankInput` has no such field; `App.tsx:89` feeds it to the view, not to `rank`. |
| 19 | verification-gap | 250 ms does not detect removal of the memo | false | reject | The frozen intent states the gate catches gross regressions and a run alone verifies 100 ms. |
| 20 | (triage) | `.github/workflows/test.yml:8-10` comment | medium | defer (moot: loopback) | Pre-existing: says `deploy.yml` skips `test:data`; `deploy.yml` runs it. |

Review 2 (2026-11-15). Layers: blind-hunter, edge-case-hunter, verification-gap (0 gaps), deferred-ledger-audit (0 findings), ocr-delegate (0 findings). impeccable-design-review skipped: no `packages/web/src/` change.

| # | Layer | Location | Verdict | Route | Evidence |
|---|---|---|---|---|---|
| 21 | edge | `budget.data.test.ts` `inputAt` omits `crossFileFailures` | low | patch | Supersedes row 18, whose refutation was wrong: `RankInput.crossFileFailures` exists (`rank.ts:47`) and `App.tsx:89,165` passes `crossFileChecks(...).failures`. The guard's input differs from the page's whenever the committed data has a cross-file failure. |
| 22 | blind, edge | `deploy.yml:9-10` header sentence; `RANK_BUDGET_TIMING` literal in two files | low | patch | "It turns the NFR-6 timed cases off" reads as `pnpm check`; the step `env` does it, and nothing in `deploy.yml` names the reading file, so a rename on one side silently re-enables timing on deploy. The smallest fix names the variable and `budget.data.test.ts`. Rejecting a loud failure on unknown values: adds a branch for a value only `deploy.yml` sets. |
| 23 | blind | `budget.data.test.ts` equality case uses `toEqual` | low | patch | `toEqual` ignores `undefined`-valued properties; the case carries the byte-identical Always rule, so `toStrictEqual` is the direct correction. |
| 24 | blind | `budget.data.test.ts` warm title "every memo filled" | low | patch | The other two titles say "every pool memo"; only pool memos are in play. |
| 25 | blind | `probability.ts` `eligibleSets` comment "every entry of a pair" | low | patch | "pair" is undefined there; the key is pool plus recipe scope. |
| 26 | blind, edge | equality case cannot see a wrong memo key within one pass | false | reject | `combination.test.ts:15-31` (one pool at `modifierLevelMin` 0 and 70) and `crafting-item-level.test.ts` (one pool at 82 and 75) fail if the key drops either part (review 1, row 11). |
| 27 | edge | timed cases may hit Vitest's 5 s timeout | false | reject | The file's 8 cases ran in 3.2 s alone; single cases measured 243–476 ms, so even the observed 3× gate load stays under 5 s. |
| 28 | blind | a passing run prints no samples | low | reject | Logging adds output code to a test for evidence the PR run can supply; the 100 ms record is in Implementation Notes. |
| 29 | blind | 100 ms re-check needs a source edit | low | reject | Adds an env parameter; the manual procedure is recorded in Verification. |
| 30 | blind | `test.yml:8-10` comment restates a `deploy.yml` fact | low | reject | The comment is accurate and is the spec's task wording; the `data/**` limitation is ledgered. |
| 31 | blind | ledger entries say "two timed cases" and "`deploy.yml` runs `test:data` with" the variable | low | reject | Both are accurate in substance: two timed cases, parameterized per level; the variable reaches `test:data` through the `pnpm check` step. |
| 32 | blind | memo-empty title "a level switch" vs an upper bound | low | reject | The frozen decision names it a bound on a level switch; the title matches it. |
| 33 | blind | cached `eligibleSet` arrays are shared and not frozen | low | reject | No consumer mutates them (`containedIn`, `secondDraw`, `totalWeight` read only; review 2 OCR), the type is `readonly`, and freezing adds code for a state not shown. |
