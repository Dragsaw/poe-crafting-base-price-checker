---
title: 'Story 4.2: The price-trust verdict in core'
type: 'feature'
created: '2026-10-09'
status: 'done'
route: 'dispatch'
baseline_commit: '4f6b13c2ecdcee2248ea18513ccb56b7bb24407c'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-4-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `core` returns no price-trust verdict. `web` computes its own freshness mark (`list/format.ts`: a 48h cut-off, no thin rule, no share rule), and that contradicts `EXPERIENCE.md` *Price trust* and AD-10, which make the verdict a `core` fact.

**Approach:** `core` computes the four-state verdict (current, rough, pending, broken) and a structured reason for each non-pruned entry and each row, under `EXPERIENCE.md` *Price trust* and AD-17 *Price trust*. It reads the age against a clock that the caller passes in `RankInput`. It returns the verdict on every `RankedRow`, on every summand, on every non-summand combination of a crafted row, and on every raw pending or broken entry.

## Boundaries & Constraints

**Always:**
- The old, thin and share bounds are named constants in one `core` module. Each cites *Price trust*, and no other package holds them.
- The age is `observedAt` when an observation exists, otherwise `lastAttemptedAt`. A never-synced entry has no age. `now` is an ISO string in `RankInput`, as `chunkOrder` takes it. The ESLint core block bans `Date.now()`.
- A reason is data, never a display string. It is a discriminated union: an old reason with whole days rounded down, a thin reason with a listing count, and one kind for each pending or broken cause, with days for `no-listings`. The crafted row kinds are uncostable, all-broken, no-prices and unreliable-share, with whole percent rounded down. `EXPERIENCE.md` owns the words, and Story 4.3 or 4.4 maps the kinds to them.
- A priced observation in the wrong league is pending `league-mismatch`, the same as the existing raw grouping. Reuse that rule and do not duplicate it.
- A crafted row applies the ordered rules, and the first match wins: uncostable, then all-broken, then no-prices, then share, then current. The share sums gross `P × price` over every priced, non-pruned, active-league entry of the pair, below-threshold entries included. Pending and broken entries are in neither sum. There is no zero-gross fallback.
- The weakest-input propagation stays AD-10's existing fold. Add no second rule.
- `RankedRowSchema` and the new trust schema live in `contracts`, as strict zod objects.

**Never:**
- Changes to `sync` or to the ranking order or EV arithmetic. A new `web` rendering of the verdict (Stories 4.3 and 4.4).
- A threshold or config value for the bounds. A verdict on an Unrankable class.
- The *no recipe published* rule. With no recipe, `rank` returns no crafted row, so the rule has no row to carry it.

**Decisions:**
- Open Question 1: the recipeless-class group for state 43 is deferred to Story 4.3 or 4.6 (ledger entry). The crafted rule list of this story starts at uncostable.
- Open Question 2: this story deletes `web`'s own cut-off: `FRESHNESS_CUTOFF_HOURS`, `ageMark` and the stale key line that describes its mark. `useRanking` passes `now`. The ranked row's age cell is blank until Story 4.3 renders `core`'s verdict. `combinationAges` and `NEVER_ATTEMPTED` stay, because they hold no cut-off.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Fresh and thick | priced, age < old bound, `sampleSize` ≥ thin minimum | current, no reasons | N/A |
| Exactly old | age equals the old bound | rough, old reason with its days | N/A |
| Old and thin | both triggers | rough, reasons in age-first order | N/A |
| No listings | `no-listings`, with `lastAttemptedAt` | pending, no-listings reason with its days | No `lastAttemptedAt` → no days |
| Never synced | no dataset entry, or `never-synced` | pending, never-synced reason, no age | N/A |
| Unresolvable | `unresolvable` | broken | N/A |
| Crafted, uncostable and all broken | uncostable recipe, every entry broken | pending, uncostable reason | N/A |
| Crafted, no priced entry | entries pending, or some pending and some broken | pending, no-prices reason | N/A |
| Share at the bound | the unreliable gross share equals the bound | rough, the percent rounded down | N/A |
| Threshold moves | the same data at two thresholds | the same crafted verdict | N/A |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/ranked-row.ts` -- `RawRankedRowSchema`, `CraftedSummandSchema`, `CraftedRankedRowSchema`, strict. Add `trust` to each, and add `combinations` (the non-summand, non-pruned entries, each with `entryKey` and `trust`, ordered below-threshold, then pending, then broken, then by key) to the crafted row. Test: `ranked-row.test.ts`.
- `packages/contracts/src/dataset.ts` (`PriceStateSchema`, `NotYetSyncedReasonSchema`) and `price-observation.ts` (`observedAt`, `sampleSize`) -- inputs. Read only.
- `packages/core/src/rank.ts` -- `RankInput` (L29) gains `now`, and `Ranking` (L68) carries the trust. `rank` is at L245.
- `packages/core/src/rank-raw-groups.ts` -- `groupRawEntry` (L63) holds the resolved-state rule (league-mismatch, never-synced). Add `trust` to `UnrankedEntry`/`NotYetSyncedEntry` (L5–14) and to `rawRankedRow` (L45).
- `packages/core/src/rank-crafted-row.ts` -- `scanSummands` (L37) skips non-summands silently. Classify every class entry here for the per-entry trust, the combinations and the share. `craftedRow` is at L70.
- `packages/core/src/chunk-order.ts` -- precedent for `now: string` and `Date.parse`.
- `packages/core/src/index.ts` -- export the verdict function and its types.
- `packages/core/src/rank/test-support.ts` -- builders. `observation()` has a fixed `observedAt` and `sampleSize 10`. Add `now` to `ranked()` and `rankCrafted()`.
- `packages/web/src/App.tsx` L138–156 `useRanking` -- pass `now` (an ISO string of the load-time `Date.now()` at L86).
- `packages/web/src/list/format.ts` (`FRESHNESS_CUTOFF_HOURS` L12, `ageMark` L32), `display-rows.ts` (`rowDetail` L194 `age:`), `KeyBlock.tsx` L56–59 (stale key copy), `format.test.ts` L32 and L49–91 -- delete the cut-off and its readers. Leave `resolvedState`, `combinationAges` and `TrustMark.tsx` to Stories 4.3 and 4.4.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/price-trust.ts` (new), `ranked-row.ts`, `index.ts` -- `PriceTrustSchema` (verdict, reasons) and the schema additions above -- the contract carries the verdict.
- [x] `packages/core/src/price-trust.ts` (new) -- the named bounds, `entryTrust(entry, datasetEntry, activeLeague, now)` and `craftedTrust(...)` with the ordered rules and the share -- one owner of the verdict.
- [x] `packages/core/src/rank.ts`, `rank-raw-groups.ts`, `rank-crafted-row.ts`, `index.ts` -- thread `now` and attach the trust everywhere the Intent lists -- `web` derives no trust fact.
- [x] `packages/web/src/App.tsx` -- pass `now` -- `RankInput` requires it.
- [x] `packages/web/src/list/format.ts`, `display-rows.ts`, `KeyBlock.tsx` and their tests -- delete `FRESHNESS_CUTOFF_HOURS`, `ageMark`, the row `age` and the stale key line. Leave the age cell blank -- Decision 2.
- [x] `packages/core/src/price-trust.test.ts` (new), `rank/trust.test.ts` (new), `contracts/src/ranked-row.test.ts` -- every I/O matrix row, every pending cause, the boundary instants of each bound, and the threshold invariance -- the verdict is pinned.

**Acceptance Criteria:**
- Given any `rank` output, when it is parsed with `RankedRowSchema`, then it is valid, and each row, summand and crafted combination carries a `trust`.
- Given `packages/web/src`, when it is searched for the old, thin and share bounds, then no freshness cut-off, thin minimum or share bound exists.
- Given a crafted pair, when the verdict is computed, then provenance and `asOf` are unchanged from before this story.

## Verification

**Commands:**
- `pnpm check` -- expected: green.
- `pnpm --filter @poe/core test` -- expected: the new trust tests pass.

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | design, edge, blind, gap | `KeyBlock.tsx` still keys the *never attempted* age mark that no row renders | low | `RankedRow.tsx` renders an empty age cell, and `NEVER_ATTEMPTED` reaches the page only through `KeyBlock`. The line describes `ageMark`'s `never` output, which Decision 2 deleted. | patch |
| 2 | design | `KeyBlock.tsx` *Silence* sentence says an empty Age cell means nothing is degraded | medium | The age cell is now empty on old, pending and broken rows, so the key tells the player that every row is healthy, against EXPERIENCE.md *Silence means healthy*. Same root cause as #1, which is the key describing the blanked cell. | patch (with #1) |
| 3 | edge, blind | Zero whole gross gives `NaN` and the crafted row reads current | false | P can be 0 (`probability.ts` contained weight 0) and price is positive. 0/0 is not "at least 70%", so EXPERIENCE.md *Price trust* "Otherwise → no mark" applies, and the spec says "There is no zero-gross fallback". | reject |
| 4 | edge | The percent floor can print 69 when the share passes the bound by tolerance | low | `floor(share*100 + 1e-9)` against `share >= 0.7 - 1e-9`: 0.6999999995 is rough with percent 69, which breaks "the printed figure never contradicts the rule". The fix is a one-line correction. | patch |
| 5 | edge, blind | `assertClock` accepts a non-ISO string that `Date.parse` takes | low | The only caller (`App.tsx`) passes `toISOString()`, and the `chunkOrder` precedent checks the same way. A player is unlikely to meet this, and the fix changes the shared clock check. | reject |
| 6 | edge | An unparseable `observedAt` or `lastAttemptedAt` gives a `NaN` age | false | The dataset reaches `rank` already parsed under `IsoTimestampSchema`, so an unparseable stamp cannot reach `entryTrust`. | reject |
| 7 | edge, blind | The contracts file is at `ranked-row/price-trust.ts`, not at the path in the spec | false | The directory-structure test caps `contracts/src` at 44 files. The only fix is to edit this spec. | reject |
| 8 | blind | `PriceTrustSchema` describes an order and pairing that it does not check | false | The description documents the order the producer emits, and `core` emits it (`pricedTrust` pushes old before thin). No consumer accepts foreign payloads. | reject |
| 9 | blind | Pending causes other than no-listings carry no days | false | The frozen Boundaries give days only to `no-listings`. | reject |
| 10 | blind | `NotYetSyncedEntry.reason` duplicates `trust.reasons[0].kind` | low | Both come from the one `resolvedPrice` call, so they cannot drift in practice. Dropping `reason` changes the public `Ranking` surface. | reject |
| 11 | blind | `resolvedPrice` runs twice per entry | false | The rule has one implementation, called twice, so it is not duplicated. The NFR-6 budget test passes. | reject |
| 12 | blind | `CraftedTrustEntry` lets a caller pass `gross` on any verdict | low | The only caller is `scanSummands`, which sets `gross` only for priced entries. The fix adds type complexity. | reject |
| 13 | blind | `page-chrome.test.tsx` drops the age assertion and adds no replacement | low | `unpriced-trail.test.tsx` and `ranked-list.test.tsx` now assert that the age cell is empty. | reject |
| 14 | blind | Test comments narrate the story plan ("until Story 4.3", "spec 4.2, Decision 2") | low | This breaks the AGENTS.md comment rule (cite an owner id, never decision narrative). The fix is a direct correction. | patch |
| 15 | blind | `CraftedSummandSchema.trust` and `CraftedCombinationSchema.trust` have no `.describe` | low | Every other field in `ranked-row.ts` is described. The fix is a direct addition. | patch |
| 16 | gap, blind | The per-entry rough verdict on a summand or combination, and the place of a rough combination in the order, are untested | medium | Pre-verified: setting the summand trust to CURRENT or `COMBINATION_GROUP.rough` to 1 passes every test. | patch |
| 17 | gap, blind | The `ageMs` clamp for a clock ahead of `now` is untested | medium | Pre-verified: removing `Math.max(0, …)` gives `days: -1` and fails no test. | patch |
| 18 | ledger | No ledger entry for the blank age cell and the mapping of kinds to words | false | `epics.md` Story 4.3 (the mark slot with its reason) and Story 4.4 (trust reasons per line) already own this work, so it is not lost. | reject |
| 19 | ledger | No ledger entry for replacing `resolvedState`, `combinationAges` and `TrustMark` | false | `epics.md` Story 4.4 owns the expansion's price state, trust reason and age (FR-9, FR-12). | reject |
| 20 | blind | The diff leaves out the planning files | false | This is a staging choice of the review step, not a defect in the change. | reject |
