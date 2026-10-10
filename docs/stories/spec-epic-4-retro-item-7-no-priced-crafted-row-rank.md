---
title: 'Epic 4 retro item 7: a crafted row with no priced combination trails the ranking; floor/scope order wording'
type: 'bugfix'
created: '2026-10-10'
status: 'done'
baseline_commit: '5973e6cab2ef5f4bb6a8e95deb4e89356a865981'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** R4: a costable crafted row with no priced combination (state 18 pending, state 41 all broken) ranks at `EV = −craftCost` with a numeral, while web prints `—`. It sits among real negative figures in an order the player cannot read, and a missing price acts as zero (against FR-1 "not zero, nothing" and FR-9). R15: the spine says the recipe floor runs after the item-level scope, but the code and AD-17's "unscoped pool" sentence run the floor first. The `floored()` JSDoc says the floor "never drops a type", but the scope after it can drop the group.

**Approach:** Ruling (user, 2026-10-10): such a row leaves the ordering. It sits after every ranked row, unnumbered, beside the unpriced Raw Bases. `core` returns it in a new `Ranking` group. `web` trails it. PRD FR-1, spine AD-17 and EXPERIENCE.md state the rule, each at its own altitude. The same change fixes the R15 wording in the spine and in two `probability.ts` comments. Scope decision (user): R4 and R15 ship together.

## Boundaries & Constraints

**Always:** The predicate is `trust.verdict ∈ {pending, broken} && ev !== null`. It is not `summands.length === 0`, because state 25 (priced, all below the threshold) stays ranked at `−craftCost`. `ev` keeps its contract value (`null` only when uncostable). `web` filters and trails the group. It never re-ranks it. Each owner doc gets a revision bump and a memlog row. The PRD states the rule, and EXPERIENCE.md owns the numeral and the trail order.

**Never:** No change to uncostable (state 35) or recipeless (state 43) handling, to `RankedRowSchema`, or to state 25. No new on-screen string. No `ev: null` for these rows.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior |
|----------|--------------|---------------------------|
| Pending crafted | costable recipe, every entry of the class unpriced | Not in `ordering`; in `unpricedCrafted`; row unnumbered, tier 3, EV `—`, ○ |
| All broken | every entry `unresolvable` | Same, ✕ |
| Below threshold | priced entries all < threshold | Unchanged: ranked, numbered, `−0.03` dimmed (state 25) |
| Uncostable | active recipe uncostable | Unchanged: in `ordering` with `ev: null`, state 35 branches |
| Trail order | pending + broken crafted, pending + broken raw | Pending crafted, pending raw (no-listings, not-yet-synced), broken crafted, broken raw; each block in key order |
| League reset | nothing priced (state 23) | Unchanged: one canonical sequence; the new group is counted and joined |

</frozen-after-approval>

## Code Map

- `packages/core/src/rank.ts:82-103,236-248,292-300` -- `Ranking` (plain TS interface); `rankCraftedClass` pushes every row to `raw.surviving`. Route rows that match the predicate to the new `unpricedCrafted` group. Sort it with `compareRankedRows` (class key, then recipe id).
- `packages/core/src/rank-order.ts` -- `compareRankedRows` is the reused tie-break. `compareOrdering` does not change.
- `packages/core/src/price-trust.ts:103-130` -- `craftedTrust`: with cost ok, pending/broken means no entry priced in the active league. Read only.
- `packages/core/src/probability.ts:126-129,254` -- R15 comments: floor over the unscoped pool, then the scope, which can drop a group.
- `packages/web/src/list/active-ranking.ts:22` -- `forRecipe` filters the new group by recipe id, as it filters `ordering`.
- `packages/web/src/list/display-rows.ts:279-320` -- `unpricedRow`/`trailingRows`; add class trailing rows (reuse the crafted detail of `rankedRows` with `numeral: undefined, tier: 3`). `toListBranches` empties the group in the raw branch.
- `packages/web/src/list/list-statement.ts:30-55` -- `isHonestEmpty` and `isEveryRowBroken` include the group. `isNothingClearing` stays `ordering`-based.
- `packages/web/src/list/RankedList.tsx:101-108` -- the 20-row slice already counts trailing rows. No change.
- Tests that change: `core/src/rank/trust.test.ts:139-152` (pending/broken rows read from the group); `web/src/recipe/craft-recipe/crafted-states.test.tsx:41` (Staves loses numeral `2`); `web/src/list/row/display-row-trust.test.ts:79`; `web/src/list/ranked-list/unpriced-trail.test.tsx`; `web/src/list/list-statement.test.ts:241`; `web/src/list/row/trust-words.test.ts:54` (revision pin).

## Tasks & Acceptance

**Execution:**
- [x] `docs/prds/.../prd.md` + `.memlog.md` -- FR-1: narrow the `−Craft Cost` bullet to "whose priced Combinations all fall below the Payout Threshold". Add a bullet: an Item Class with no priced Combination has no EV, is not ranked, and the list shows it after every ranked row (FR-9, AD-17). Revision 29.
- [x] `docs/architecture/.../ARCHITECTURE-SPINE.md` + `.memlog.md` -- AD-17: one sentence after the `−craftCost` rule. A class with no priced entry is outside the ordering (FR-1), and `core` returns it in its own group by the tie-break. R15: fix the order in the formula note (~1177) and the floor paragraph (~1303) to floor over the unscoped pool, then scope, and say that the scope can drop a group. Revision 36.
- [x] `docs/ux-designs/.../EXPERIENCE.md` + `.memlog.md` -- states 18 and 41: unnumbered, tier 3, after every ranked row, in the trail order of the matrix. Revision 30, memlog 293.
- [x] `packages/core/src/rank.ts`, `probability.ts` -- the group, the predicate, and the R15 comments. Add core tests: pending row, broken row, and the state 25 row that stays.
- [x] `packages/web/src/list/{active-ranking,display-rows,list-statement}.ts` -- filter, trail, count. Update the tests listed in the Code Map, and add a trail-order test.
- [x] `docs/stories/sprint-status.yaml`, `docs/stories/epic-4-retro-2026-10-10.md` -- item 7 `done`, with a status note under action item 7.

**Acceptance Criteria:**
- Given a costable recipe and a crafted class with no priced entry, when the list renders, then the row has no numeral and sits below every numbered row, and ranks 1..n are contiguous over the figured rows.
- Given the state 25 world in `crafted-states.test.tsx`, when it renders, then Bows ranks `1` at `−0.03` and Staves trails unnumbered.
- Given the three owner docs, when grepped, then each states the rule once and carries the new revision and one memlog row.

## Implementation Notes

- Trail order lives in `trailingRows` (`display-rows.ts`): `unpricedCrafted` is split by verdict around the pending raw groups. Recipeless rows (state 43) stay last; they cannot coexist with the group, since it needs a published recipe.
- Besides the Code Map tests, three core tests read the routed rows from the group: `crafted-branch.test.ts` (league reset: `greater` trails, uncostable `perfect` stays ranked), `provenance.test.ts` (two no-summand rows), `recipeless.test.ts`. EXPERIENCE.md state 25 was narrowed too, since it said every crafted class ranks.
- `unpriced-trail.test.tsx` mounts raw-only lists, so the trail-order test is in `display-rows.test.ts`.
- Manual check: the live `data/` set on `pnpm dev` holds no unpriced crafted class (16 rows, ranks 1..16 contiguous), so the pending-row view was verified only through `crafted-states.test.tsx`.

## Spec Change Log

## Review Triage Log

- Blind Hunter 1 (unpriced row keeps `ev = −craftCost` though FR-1 says "no EV") — false: the frozen Boundaries keep `ev` at its contract value (`grossPayout − craftCost`, `null` only when uncostable); the player-level "no EV" is the `—` cell, and the row is outside `ordering`, so no consumer ranks on it.
- Blind Hunter 2 ("priced" not tied to the active league) — false: an observation from another league is Price State `not-yet-synced` (FR-9 reason), not `priced`, so FR-1's "no priced Combination" already covers it.
- Blind Hunter 3 (routing reads the trust verdict) — false: the predicate is the frozen one; with `ev !== null`, `craftedTrust` returns pending/broken only for all-broken or no-prices (`price-trust.ts:103-130`), both of which mean no priced entry.
- Blind Hunter 4 (EXPERIENCE.md state 21 still says every class with no qualifying Combination is ranked) — medium, patched: narrowed to a class whose priced Combinations all fall below the threshold.
- Blind Hunter 5 (state 18's new sentence also catches states 23, 35, 43) — low, patched: scoped to outside states 23, 35 and 43.
- Blind Hunter 6 (state 18 cites state 4 for broken Raw Bases) — low, patched: state 4 is the expansion line; the ranked row is state 40.
- Blind Hunter 7 (tracker says `done` while the spec is `in-review`) — false: earlier retro items flip the tracker in their own landing branch (item 3, `160c93a`); the branch lands only on human acceptance.
- Blind Hunter 8 (Code Map test list is stale) — rejected: the fix edits this spec; Implementation Notes already record the moved test.
- Blind Hunter 9, Deferred Ledger Auditor (browser check of the trailing row not done) — real, deferred: `deferred-work.md` entry; the live data has no unpriced crafted class.
- Blind Hunter 10, Edge Case Hunter 1, Impeccable (`isNothingClearing` silent when only trailing rows remain) — false: the case needs every ranked crafted class unpriced, no Raw Base and a priced entry only in an Unrankable class; and state 25 would then blame the threshold for rows that have no price, so no statement is the honest outcome.
- Blind Hunter 11 (tests copy routing or pre-sort input) — low, rejected: developer-only; the core sort is now pinned by the Verification Gap patch.
- Blind Hunter 12 (`combinationProbability` JSDoc drops a renormalise) — low, patched to the spine's step list.
- Blind Hunter 13 (AD-17 clause names web placement, "term" undefined) — low, patched: the clause ends at the tie-break and cites EXPERIENCE.md state 18.
- Edge Case Hunter 2 (web drops an `unpricedCrafted` row with another verdict) — false: `isUnpriced` in `rank.ts` admits only pending or broken.
- Verification Gap 1 (`unpricedCrafted` key order not pinned) — medium, patched: core test with two classes tracked out of key order.
- Verification run: `pnpm check` failed once on the unrelated `packages/sync/src/shell-fetch.test.ts` loopback test (`bad port`); it passed three isolated re-runs and the next full gate (8/8). Pre-existing flake, deferred.

## Verification

**Commands:**
- `pnpm check` -- expected: passes, with no network call.

**Manual checks:**
- agent-browser on `pnpm dev`, state 25-like data if reachable: the pending crafted row has no numeral and sits after the figured rows.
