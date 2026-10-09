---
title: 'Story 2.2: The raw ranking branch, league-scoped and computed at read time'
type: 'feature'
created: '2026-09-26'
status: 'done'
route: 'dispatch'
baseline_commit: 'a8a1e9d6169f436362665c1181921b9bf7a375bc'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `core` has no valuation. Nothing turns the published `dataset.json`, `tracked.json` and the active league into an ordered list, and Stories 2.3–2.8 have no `RankedRow` to render.

**Approach:** Add a `RankedRow` schema to `contracts`. Add one pure `core` function, `rank`. It takes the tracked entries, the dataset, the active league and the Payout Threshold as values. It returns a typed `Ranking`: the ordering, a below-threshold group, and one group for each non-`priced` Price State. This story builds the raw branch only, and it does not wire `web`. Story 2.3 renders from `rank`.

## Boundaries & Constraints

**Always:**
- The epics.md Story 2.2 ACs are normative. The rules are AD-17 (raw branch, threshold, tie-break), AD-9 (states), AD-19 (league), AD-4/AD-1 (purity) and IN §4.1/§4.2.
- `contracts` lands first, in its own commit. `RankedRowSchema` is a discriminated union on `kind` with one arm: `raw` = `{ kind, entryKey, baseTypeId, itemLevelMin, status: 'active'|'pinned', ev, craftCost: 0, observation: PriceObservation, lastAttemptedAt? }`. The type is `z.infer`red from the schema. Epic 3 adds the crafted arm. Barrel + barrel test.
- A raw row's `ev` is `observation.priceDivine`, unchanged. There is no rounding and no arithmetic.
- An entry is below the threshold when `priceDivine < threshold`, and survives when `priceDivine ≥ threshold`. A below-threshold entry is a `RankedRow` in `belowThreshold`. It never enters the ordering or any state group.
- A `priced` observation whose `league !== activeLeague` is restated as `{ state: 'not-yet-synced', reason: 'league-mismatch' }`. Only `observation.league` is compared. `dataset.league` is not read.
- A tracked entry with no dataset entry is `not-yet-synced` / `never-synced`. A dataset entry whose key is not tracked is ignored. `pruned` entries are excluded from every group. `crafted` entries are out of scope and do not appear in the `Ranking`.
- **Tie-break (decision 2026-09-26, option a):** `compareRankedRows` compares kind first (raw before crafted), then `compareCanonicalKeys` within the kind, then the recipe id. This follows the AD-17 and AC sentence that a raw row sorts before a crafted row at an equal EV. AD-17 gets a one-line clarifying note in a separate `docs` commit, and its `.memlog.md` records it.
- Ordering: `ev` descending, then the tie-break comparator. Every group other than the ordering is in canonical key order (`compareCanonicalKeys`), because Story 2.7 prints the league reset in canonical order.
- Non-`priced` groups are `noListings`, `notYetSynced` (each item carries its reason) and `unresolvable`. Each item carries the entry, its `entryKey` and, if present, `lastAttemptedAt`. Story 2.3 needs it for the *tried* clock.
- `core` returns and never throws. `core` never reads `lastSearchId` or `lastSearchLeague` (AD-9). `web` joins them by `entryKey` in Story 2.5.
- Tests use vitest with local fixture helpers, following `chunk-order.test.ts`.

**Never:**
- No `web` change, no memoisation hook, no threshold input. Stories 2.3 and 2.4 own them.
- No zod import in `core`. depcruise `no-core-to-npm-package` forbids it.
- No rank numeral, `< 0.01` string or 2dp formatting in `core` or in `RankedRow`.
- No league filter or precomputation in `sync`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output |
|----------|--------------|-----------------|
| Priced, clears | raw, 0.5 div, active league, threshold 0.25 | in `ordering`, `ev` 0.5, `craftCost` 0 |
| Exactly at threshold | 0.25 at 0.25 | in `ordering` |
| Below | 0.1 at 0.25 | in `belowThreshold` only |
| Old league | priced, `observation.league` = previous league | `notYetSynced`, reason `league-mismatch`; not below-threshold |
| Never synced | tracked, no dataset entry | `notYetSynced`, reason `never-synced` |
| Other states | `no-listings`, `unresolvable`, `not-yet-synced`/`no-exchange-rate` | their own group, input reason kept |
| Pruned / crafted | status `pruned`, or kind `crafted` | absent from every group |
| Equal EV | two raw rows at 0.5 | tie-broken per the comparator; stable across input order |
| 4dp value | 0.1235 | `ev` 0.1235 exactly |
| Nothing clears | every price < threshold | `ordering` empty, all in `belowThreshold` |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/dataset.ts` -- `PriceStateSchema`, `NotYetSyncedReasonSchema` (has `league-mismatch`), `DatasetEntrySchema` (`entryKey`, `price`, `lastAttemptedAt?`, search fields); reuse, do not change.
- `packages/contracts/src/price-observation.ts` -- `PriceObservationSchema` (`league`, `observedAt`, `priceDivine`, `sampleSize`, `exchangeObservation`); embed as-is in `RankedRow`.
- `packages/contracts/src/tracked-entry.ts` -- raw arm `{kind:'raw', baseTypeId, itemLevelMin, status, prunedReason?}`. The arm schema is not exported; derive the `RankedRow` fields from primitives or export the arm internally.
- `packages/contracts/src/canonical-key.ts` -- `canonicalKey(entry)`, `compareCanonicalKeys(a,b)` (UTF-8 code-unit order); reuse for joining and tie-breaks.
- `packages/contracts/src/primitives.ts` -- `DivineAmountSchema`, `IsoTimestampSchema`, `ItemLevelSchema`.
- `packages/contracts/src/index.ts` + `index.test.ts` -- barrel groups (`export {}` then `export type {}`, `.ts` specifiers); add `RankedRowSchema` to the one-schema-per-concept list.
- `packages/core/src/chunk-order.ts` (+ test) -- precedent: readonly input object, instant passed in, local fixture helpers (`raw`, `published`), fixed `NOW`.
- `packages/core/src/index.ts` -- barrel; `CORE_PLACEHOLDER` stays.
- `packages/sync/src/chunk/publish-dataset.ts` -- confirms `sync` carries old-league observations unfiltered (AD-19); do not change.
- `depcruise.rules.mjs` -- `no-core-to-npm-package`, `no-core-to-node-builtin`, `no-core-to-sync`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/ranked-row.ts` (+ test), `index.ts`, `index.test.ts` -- `RankedRowSchema` / `RankedRow`; the test rejects a non-zero `craftCost`, a `pruned` status and a missing observation -- AD-3 schema first.
- [x] `packages/core/src/rank.ts` -- `rank(input: RankInput): Ranking`, `compareRankedRows`, the `Ranking` / `UnrankedEntry` types -- the raw branch.
- [x] `packages/core/src/rank.test.ts` -- every matrix row; determinism (shuffled input gives an identical `Ranking`); `rank` does not throw on any matrix input; a timing test: 5,000 raw entries rank in < 100 ms.
- [x] `packages/core/src/index.ts` -- export `rank`, `compareRankedRows` and the types.
- [x] `docs/architecture/.../ARCHITECTURE-SPINE.md` AD-17 + `.memlog.md` -- one clarifying sentence: at an equal EV, kind orders first (raw before crafted), and the serialised canonical key breaks ties within a kind -- separate `docs` commit.
- [x] `docs/stories/deferred-work.md` -- append one entry: a `no-listings` state recorded in a previous league stays `no-listings` after a reset, because it carries no league. Core cannot restate it without reading `lastSearchLeague`, which AD-9 forbids.

**Acceptance Criteria:**
- Given two `rank` calls over the same inputs, when both run, then the results are deep-equal, and `core/src/rank.ts` references no `Date`, `Math.random`, `process` or `import.meta`.
- Given a raw row, when the result is parsed with `RankedRowSchema`, then it parses. No other `RankedRow` definition exists outside `contracts`.
- Given `pnpm check` and `pnpm test`, when they run, then both pass.

## Implementation Notes

- The source-purity AC (no `Date`, `Math.random`, `process`, `import.meta` in `rank.ts`) is checked in root `test/core-rank-purity.test.ts`, because `core`'s tsconfig carries no Node types to read a file from a core test.
- The 5,000-entry timing test measures with `Date.now()` after one warm-up call (`performance` is untyped in `core`). It ran in ~13 ms locally; a slow CI runner is the flake risk.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Route | Evidence |
|---|-------|---------|---------|-------|----------|
| 1 | blind, verification-gap | Purity test is a raw substring match (false positive on comment prose, misses `performance.now`) | low | patch | Case-sensitive `toContain('process')` fails on "processed"; fixed with word-boundary regexes. Missing other globals: the AC names exactly these four. |
| 2 | blind | No raw-vs-crafted tie-break test; recipe-id term not in code | false | reject | Only the `raw` arm exists; `KIND_ORDER` is `Record<RankedRow['kind'], number>`, so Epic 3's arm is a compile error until ordered. The recipe-id term is Epic 3's, noted in the comparator doc. |
| 3 | blind | `RawRankedRowSchema` does not refine `ev === observation.priceDivine` or key consistency | low | reject | Rows are only produced by `rank`, which sets both from one source; a refinement adds complexity for a state no path produces. |
| 4 | blind, edge-case, verification-gap | Repeated `entryKey` in the dataset: last-wins `Map` makes `rank` order-dependent | maybe-false | defer | `DatasetFileSchema` (`envelopes.ts:121`) has no uniqueness rule, unlike `TrackedFileSchema`. Pre-existing contract gap; whether `sync` can emit a repeat is unverified. |
| 5 | blind, edge-case | Repeated canonical key in `tracked` yields duplicate rows | false | reject | `TrackedFileSchema` (`envelopes.ts:43`) rejects a repeated canonical key, and the parsed file is the only source of `tracked`. |
| 6 | blind, edge-case | `threshold` NaN/negative/Infinity silently misgroups | maybe-false | defer | No caller exists yet; Story 2.4 owns the threshold input and its validation. Would be medium if an invalid value reached `rank`. |
| 7 | blind | Deferred entry omits a published `not-yet-synced` reason outliving a reset | low | patch | `no-exchange-rate` also carries no league and keeps its old reason after a reset; one clause added to the entry. |
| 8 | blind, edge-case, verification-gap | NFR-6 timing test is single-sample wall clock | low | patch | One `Date.now()` sample; now fastest of several runs after warm-up. |
| 9 | blind | No test for a priced row whose dataset entry lacks `lastAttemptedAt` | low | patch | The conditional spread in `rank.ts` was never exercised on the absent branch; test added. Unresolvable ordering and pinned-below-threshold share tested paths; rejected. |
| 10 | blind | AD-17 paragraph left a ragged `**A class whose` line | low | patch | Re-flowed, no wording change. |
| 11 | blind | Spec not in the diff | false | reject | The spec is the claims file and is committed with the story's close. |
| 12 | blind | Stray blank line in `rank.test.ts`; `compareRankedRows` test does not show EV is ignored | low | patch (blank line) / false | Blank line removed. The test input has A at 0.3 and B at 3; sorting yields A before B, contrary to EV order, so EV is shown ignored. |
| 13 | edge-case | `switch (price.state)` has no exhaustive `default` | low | reject | A fifth `PriceState` arm is a contract change no one is making; guarding it adds a branch for an undemonstrated state. |
| 14 | edge-case | League ids differing by case/whitespace misclassed | false | reject | AD-19 compares the league verbatim; `observation.league` and the config league come from the same configured string. |
| 15 | deferred-ledger | — | none | — | Zero findings: the one carve-out has its ledger entry. |

## Verification

**Commands:**
- `pnpm check` -- expected: typecheck, lint, depcruise clean.
- `pnpm test` -- expected: all green, no escaped-request failures.
