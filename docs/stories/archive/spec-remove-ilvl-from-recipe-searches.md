---
title: 'Remove ilvl from recipe (crafted) searches'
type: 'feature'
created: '2026-10-09'
status: 'done'
route: 'dispatch'
baseline_commit: '3c28555f931297657f6c98bebbfead6c935790d5'
review_loop_iteration: 1
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The crafted-entry trade search sends `type_filters.ilvl.min = itemLevelMin`. The banded stat filters already set the minimum mod values, so the item-level filter is not needed for recipe searches (deferred-work entry "Remove ilvl from recipe searches").

**Approach:** `buildSearchBody` stops emitting `ilvl` for `crafted` entries on all three discriminator arms. A `raw` (white base) entry keeps `ilvl.min = itemLevelMin`. `itemLevelMin` stays on crafted entries: probability scoping (AD-17), the canonical key and the load checks still read it.

## Boundaries & Constraints

**Always:** Raw bodies are byte-identical to today. Crafted bodies keep the current key order of the remaining fields (`category`, `rarity`), because fixtures key on the body bytes. The human re-records fixtures with `pnpm fixtures:record`, and the new captures are committed with the code.

**Never:** No hand-written or hand-renamed fixture. No change to `TrackedEntry`, the tracked schema, canonical keys, weights scoping or the shared-floor check. No PRD business-rule change (decided by the user, 2026-10-09).

**Decision (user, 2026-10-09):** Reword `prd.md:87` (Item Level Floor) and the FR-22 lead sentence (`prd.md:392`) so they say what the floor scopes and do not mention the search. This is a wording fix only: every rule stays as it is.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Raw entry | `kind: raw`, `itemLevelMin: 82` | `type_filters.filters` = `{ ilvl: { min: 82 }, rarity: normal }` | N/A |
| Crafted, defence arm | `Boots_str_int` | `type_filters.filters` = `{ category, rarity: magic }`, no `ilvl` key | N/A |
| Crafted, type arm | `jewel` / `Time-Lost_Diamond` | `query.type` set, no `ilvl` key | Unknown base type still throws `UnknownClassBaseTypeError` |
| Crafted, none arm | `Amulets` | category + rarity only, no `ilvl` key | N/A |

</frozen-after-approval>

## Code Map

- `packages/sync/src/pricing/search-body.ts` -- `buildSearchBody` (line 159): `ilvl` built at 161, used by raw at 170 and crafted `typeFilters` at 180. `SearchBody.type_filters.filters.ilvl` (line 65) is required; make it optional because crafted bodies omit it.
- `packages/sync/src/pricing/search-body.test.ts` -- arm 1 (line 40) and arm 3 (line 83) expect `ilvl: { min: 75 }`; the raw test (line 24) stays as is.
- `fixtures/tracked.json` -- 3 crafted entries (all `itemLevelMin` 75) + 4 raw. Only the 3 crafted digests change.
- `fixtures/trade-search-*.json`, `fixtures/trade-fetch-*.json` -- re-recorded by the human. Old crafted captures become orphans; the recorder's diff should drop them (check after recording).
- Tests that fail until re-record (verified by a trial edit): `src/pricing/price-entry.fixtures.test.ts` (5), `src/dry-run/repository-snapshot.test.ts` (1). Do not change them.
- `docs/architecture/.../ARCHITECTURE-SPINE.md` -- AD-16 table row `type_filters.ilvl` (line 906); AD-17 assumption (lines 1186-1188) and the rejected alternative "Per-band conditional item level" (lines 1916-1918) both say "the `ilvl >=` search".
- `docs/epics.md:716` -- raw only; unchanged.
- `docs/stories/deferred-work.md:27-31` -- the entry to remove in the last commit.

## Tasks & Acceptance

**Execution:**
- [x] `packages/sync/src/pricing/search-body.ts` -- move `ilvl` into the raw branch only; make the `SearchBody` `ilvl` field optional -- crafted bodies omit it.
- [x] `packages/sync/src/pricing/search-body.test.ts` -- drop `ilvl` from the arm 1 and arm 3 expectations; add an assertion that no crafted arm body has an `ilvl` key -- covers the matrix.
- [x] `ARCHITECTURE-SPINE.md` -- AD-16 row: `raw` entry only; a `crafted` entry emits no item-level filter. AD-17 assumption and the rejected alternative: the crafted search has no item-level filter, so it returns a superset over item level. Rationale goes in the commit message, not the doc.
- [x] `docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md` -- reword line 87 and the FR-22 lead sentence (line 392) per the decision; keep the citations (FR-22, AD-17, AD-5) and the "PRD-owned" markers. `PRODUCT.md` needs no refresh (no user, positioning or constraint fact changes).
- [x] HUMAN: run `pnpm fixtures:record` with `POE_SYNC_USER_AGENT` set; commit the fixture diff.
- [x] `docs/stories/deferred-work.md` -- remove the entry in the last commit.

**Acceptance Criteria:**
- Given the re-recorded fixtures, when `pnpm check` runs, then it passes, including `price-entry.fixtures.test.ts` and `repository-snapshot.test.ts`.
- Given the re-recorded fixtures, when `pnpm sync:dry` runs, then no fixture-workload entry is `unrecorded`.
- Given the fixture diff, when it is inspected, then only the 3 crafted search/fetch pairs changed and the raw captures are byte-identical.

## Implementation Notes

## Spec Change Log

- 2026-10-09 (user decision): `pnpm fixtures:record` re-records every capture live, so the raw search/fetch captures and `trade-data-items`/`trade-data-stats` changed too, and the third AC (raw captures byte-identical) cannot hold. The user chose to keep the full re-record. The hand-worked prices in `price-entry.fixtures.test.ts` ("takes the lower median") were re-derived from the new fetch captures and the pinned rates, and they match the code. The frozen rule "raw bodies are byte-identical" still holds: the raw request digests did not change.

## Review Triage Log

Loop 1 (2026-10-09). Route: **intent_gap** (root cause inside the frozen block), which makes the lower entries moot.

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | blind | `prd.md:135` promises that probability and price are both scoped to the Item Level Floor; a crafted price is no longer scoped | high | `prd.md:135` reads "both are scoped to the Tracked Entry's Item Level Floor (AD-17, FR-16)". The crafted search now admits listings below the floor, so the price population is wider than the probability population. The frozen "No PRD business-rule change" and the drop of the filter cannot both hold. | intent_gap |
| 2 | blind | Bands do not floor the tier: adjacent tiers overlap on two-number mods | high | Spine OQ-21 (`ARCHITECTURE-SPINE.md:1960-1972`) and `.memlog.md:117`: adjacent tiers overlap on 53 of 63 classes, so a lower-ilvl item on a lower tier can match the band. This contradicts the frozen premise "the banded stat filters already set the minimum mod values". | intent_gap |
| 3 | edge | A crafted entry with a `valueless` line has no value floor and now no ilvl floor | medium | `search-body.ts` emits a valueless line with no edges (test "sends a valueless stat as value {} with no edges"). `data/tracked.json` has 0 valueless lines today, but the schema allows them. Same premise as #2. | intent_gap |
| 4 | edge, blind | The JSDoc on `SearchBody.ilvl` says the stat bands floor a crafted entry's mods | medium | False per #2 and #3. Same root cause. | intent_gap |
| 5 | edge, blind | The AD-17 assumption and the rejected alternative blame a missing API filter, but `ilvl.min` exists and is now dropped by choice | medium | The text at `ARCHITECTURE-SPINE.md:1186-1189` and `:1917-1919` keeps "needs an exact-item-level filter the trade API does not offer" as the reason, which does not cover the new downward superset. Follows from #1. | intent_gap |
| 6 | blind | The price move is not recorded (crafted medians 0.3119 to 0.161 and 0.2012 to 0.0805) | medium | The halving is consistent with low-ilvl listings entering the sample. Market drift also moved the raw prices (100 to 125), so this is not settled. Evidence for #1. | intent_gap |
| 7 | blind | The PRD edits change a business rule | false | The rewording was decided by the user (frozen Decision). It removes the search mechanism and changes no rule. | reject |
| 8 | blind | The deferred-work entry is not removed | false | The spec plans its removal in the last commit, which has not been made yet. | reject |
| 9 | blind | The fixture re-record is unexplained | false | The Spec Change Log records the user decision, and the commit message will carry it. | reject |
| 10 | blind | No byte-exact test for the raw body | false | The raw search fixture names (request digests) did not change, and `price-entry.fixtures.test.ts:71-78` would fail on any change to a raw body's bytes. | reject |
| 11 | blind | The worked comment covers only two of the six values | low | Cosmetic, and moot under the loopback. | reject |
| 12 | blind | Ragged reflowed lines and an uncited AD-16 row in the spine | low | Cosmetic, and moot under the loopback. | reject |

Resolution (user, 2026-10-09): rows 1-6 are kept as built. The PRD update for `prd.md:135` goes to the PM as a `[NOTE FOR PM]` entry in `deferred-work.md` (`retry_when: never — needs a human`). No code change.

## Verification

**Commands:**
- `pnpm --filter @poe/sync exec vitest run src/pricing/search-body.test.ts` -- expected: pass before re-record.
- `pnpm check` -- expected: pass after re-record.
- `pnpm sync:dry` -- expected: no fixture-workload entry `unrecorded`.
