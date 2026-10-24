---
title: 'Price tablets only in their as-dropped condition'
type: 'bugfix'
created: '2026-10-24'
status: 'done'
route: 'dispatch'
baseline_commit: '17078ff29fcb0d466af8c36f3a8d62cc5b3b02ad'
review_loop_iteration: 0
context:
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Raw tablet entries (`categoryId: "map.tablet"`) are priced from searches that admit used tablets, so their prices read too low. A tablet is worth its price only with all 10 uses remaining.

**Approach:** A hand-kept `sync` table keyed by `categoryId` adds condition stat filters to every search body of that category. The only row is `map.tablet` → `pseudo.pseudo_number_of_uses_remaining` `{min: 10}`. The catalogue check covers the table's ids, and the owner documents record the rule. The stale tablet prices are dropped so the next sync refills them.

## Boundaries & Constraints

**Always:**
- The condition belongs to the category. It applies to both entry kinds, so a future crafted `map.tablet` entry gets it too.
- Wire value `{min: 10}`, no `max` (10 is the game maximum; AD-5's closed band binds modifier references, and this is not one).
- A body for a category with no row stays byte-identical to today. No fixture is re-recorded.
- An entry whose own lines name a condition stat id throws before any request, like the summed-valueless guard.
- A condition id missing from the catalogue marks the entry `unresolvable` before any request (AD-9). Recovery is unchanged.
- Owner docs cite and don't copy (AGENTS.md *Known pitfalls*).

**Never:**
- No change to `tracked.json`, its schema, its version or `canonicalKey`.
- Not part of the `className` discriminator. No `Tablet` row in `weights.json`.
- No change to `UnresolvableRecordSchema`. No identifier shown in `web`.
- Never touch `data/dataset.json` or `data/sync-progress.json` while `data/sync.lock` exists.

**Decisions (player, 2026-10-24):**
- PRD: a Raw Base is priced in its as-dropped condition, and the PRD names no item level for it. The ilvl-82 wording goes from `prd.md` `:84`, `:159`, `:401` and `:592`.
- The brief's out-of-scope items stay out of scope. No `deferred-work.md` entries.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Raw tablet | raw `Abyss Tablet`, `map.tablet` | `stats[0].filters` = exactly `[{id:"pseudo.pseudo_number_of_uses_remaining",value:{min:10},disabled:false}]` | N/A |
| Gear unchanged | raw amulet, crafted boots | body bytes equal today's | N/A |
| Crafted tablet | synthetic crafted `map.tablet` | affix filters, then the condition filter | N/A |
| Self-named condition | entry line `statId` = the condition id | throws, names entry and id | no request issued |
| Catalogue miss | condition id absent from `CatalogueIds.statIds` | one `unresolvable` record, `identifierKind: 'statId'` | entry excluded, no request |
| `tracked:check` miss | same | issue at the entry, message names `packages/sync/src/pricing/condition-filters.ts` | check fails |

</frozen-after-approval>

## Code Map

- `packages/sync/src/pricing/search-body.ts` -- `StatFilter` (private interface, :48), `statFiltersOf` (raw returns `[]`), `buildSearchBody` (raw at :162, crafted arms share `stats`). The summed guard at :127 is the throw pattern to copy.
- `packages/sync/src/chunk/catalogue-check.ts` -- `missesOf`: raw early return at :46; condition ids go above it.
- `packages/sync/src/curation/check.ts` -- `catalogueOutcome` (:157) formats each record. Branch the message when `record.identifier` is in `conditionFiltersOf(entry.categoryId)`. Needs the entry; resolve it by `entryKey` from `entries`.
- `packages/sync/src/catalogue/catalogue-ids.ts` -- `statIds` already includes pseudo ids. `data/catalogue/stats.json` carries the condition id.
- `packages/core/src/price-trust.ts:27` -- a missing dataset row reads as `not-yet-synced`/`never-synced`, so dropping the tablet rows is safe for `web`.
- Tests: `search-body.test.ts`, `search-body.test-support.ts` (`crafted` helper), `catalogue-check.test.ts`, `curation/check.test.ts`.
- Data: 8 raw tablet rows in `data/dataset.json` and 8 keys in `completed` of `data/sync-progress.json`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/sync/src/pricing/condition-filters.ts` -- new: export `StatFilter`/`FilterEdge` types (moved from `search-body.ts`), `CONDITION_FILTERS: ReadonlyMap<string, readonly StatFilter[]>` with the one row, `conditionFiltersOf(categoryId)` returning `[]` without a row -- one hand-kept table (AD-16)
- [x] `packages/sync/src/pricing/search-body.ts` -- import the types; stats = `[...statFiltersOf(entry), ...conditionFiltersOf(entry.categoryId)]` for both kinds; throw when an entry's own filter id is a condition id
- [x] `packages/sync/src/chunk/catalogue-check.ts` -- `missesOf` checks each condition id of `entry.categoryId` against `ids.statIds`, above the raw early return
- [x] `packages/sync/src/curation/check.ts` -- a condition-id miss names the table file instead of the entry
- [x] tests in the four test files above -- one per I/O matrix row
- [x] `ARCHITECTURE-SPINE.md` -- AD-16: query-table row "condition filter: every entry, `conditionFiltersOf` keyed by `categoryId`, a hand-kept `sync` constant"; ":900 from the entry alone" → "from the entry, the catalogue and the condition table"; ":923 the one narrowing that is a choice" amended to two, with the cost: rare tablet types show `no-listings` more often. AD-5: ":227 never sent" → "never sent, but read: `categoryId` selects the condition filter"; amend ":264 tracked entry and the catalogue alone". AD-9: detection row "every condition stat id that applies to a tracked entry | before any request | `unresolvable` + `sync-report.json`"
- [x] `prd.md` -- `:159` becomes: a Raw Base is priced as a white base in its as-dropped condition (AD-16), with its "That level is the effective cap" sentence gone; `:84` drops "at item level 82"; `:401` drops "pinned at item level 82"; `:592` drops "at item level 82". No mechanism (no stat id, no filter shape)
- [x] `data/dataset.json`, `data/sync-progress.json` -- with no `data/sync.lock`, remove the 8 tablet rows and the 8 `completed` keys in one commit

**Acceptance Criteria:**
- Given the committed `tracked.json` and catalogue, when `pnpm tracked:check` runs, then the catalogue check passes.
- Given the data commit, when `pnpm check` runs, then it passes with no fixture re-recorded.

## Verification

**Commands:**
- `pnpm check` -- expected: pass, no network
- `pnpm tracked:check` -- expected: all checks pass

**Agent browser checks:**
- Open the app on the dev server. The ranked list loads with no error screen.
- The 8 tablet rows show the never-attempted (not-yet-synced) state, and no tablet shows a price.
- A gear raw row (for example an amulet) still shows its price. Screenshot both.

## Implementation Notes

Deviations from the Code Map: the `tracked:check` condition-miss message lives in `packages/sync/src/curation/catalogue-miss-message.ts`, and its test in `curation/check.condition-filters.test.ts`, because `check.ts` and `check.test.ts` sit at the 300-line lint limit. `prd.md` also lost "item level 82" at `:88` and `:152` (glossary), per the Decision that the PRD names no item level for a Raw Base. `PRODUCT.md` was refreshed to match.

## Review Triage Log

| # | Source | Location | Finding | Verdict | Route | Evidence |
|---|--------|----------|---------|---------|-------|----------|
| 1 | blind, edge, gap-other | `search-body.ts` `filtersOf` | Self-named condition throws a plain `Error`; `serialisedSearch` rethrows, so the chunk fails instead of marking the entry | low | rejected | The frozen intent asks for a throw "like the summed-valueless guard". Reaching it needs a curator to add the pseudo uses-remaining stat as an affix of a crafted tablet, and the failure is loud and names the entry and id. A typed error plus a mapping is new surface. |
| 2 | blind, edge | `catalogue-check.ts` `missesOf` | `tracked:check` does not catch a self-named condition offline | low | rejected | Same unlikely precondition as #1; the fix is a new check, not a direct correction. |
| 3 | blind, edge | `catalogue-check.ts` `missesOf` | Self-named and missing condition id gives two identical records | low | rejected | Needs #1's precondition plus a catalogue miss; dedupe logic is added complexity. |
| 4 | edge | `catalogue-miss-message.ts` | In #3's case the entry's own miss is attributed to the condition table | low | rejected | Same precondition as #3; the fix adds an origin flag. |
| 5 | edge (claim) | `search-body.ts` | "Throws before any request" yet the run ends | low | rejected | Duplicate of #1. |
| 6 | edge (claim) | `catalogue-check.ts` | "One record" claim breaks in #3's case | low | rejected | Duplicate of #3. |
| 7 | blind | `catalogue-miss-message.ts` | `CONDITION_FILTERS_PATH` is a literal that drifts on rename | low | rejected | A rename is rare and the fix is an extra filesystem test. |
| 8 | blind | `condition-filters.ts` | Wire types moved into the table module | false | rejected | The spec task orders the move; the fix would edit this build's spec. |
| 9 | blind | `ARCHITECTURE-SPINE.md:227`, `:1890` | Spine still says ilvl-82 base after the PRD dropped it | low | defer | Real drift between owner docs; the Review brief bars a review fix from editing the spine. `deferred-work.md` holds a `[NOTE FOR ARCHITECT]`. |
| 10 | blind | `EXPERIENCE.md`, `format.ts` `sellAsIsLine` | Tablet rows read "item level 1+" with no condition cue | low | rejected | Pre-existing: tablets carried `itemLevelMin: 1` before this change. The intent forbids an identifier shown in `web`. |
| 11 | blind | chunk path | No end-to-end "no request issued" test | low | rejected | The catalogue miss uses the existing excluded-key path; the self-named case is #1. |
| 12 | blind | `sync-report.json` | The chunk report does not name the condition table | false | rejected | The intent bars any change to `UnresolvableRecordSchema`. |
| 13 | blind | `condition-filters.ts` | "10 is the game maximum" is unproven per tablet type | false | rejected | A frozen intent fact; the fix would edit the spec. |
| 14 | blind | `ARCHITECTURE-SPINE.md` AD-5 | Reflow left the ragged line "for nothing. `sync`" | low | patch | This diff's own edit; reflowing it is a direct correction that changes no wording. |
| 15 | blind | `prd.md` | No PRD rule left for a raw gear base's item level | false | rejected | The player's Decision: the PRD names no item level for a Raw Base. |
| 16 | gap | `catalogue-miss-message.ts` | Non-condition branch and per-id predicate untested | low | patch | Pre-verified gap; add a `map.tablet` case with a missing `baseTypeId` that asserts `(entry <key>)`. |

### Agent browser checks (after review)

Run 2026-10-24 23:36 local time, session `poe-1787c13dfcd2`, dev server on 5173. The run used `17078ff29fcb0d466af8c36f3a8d62cc5b3b02ad` with a dirty tree, which held every change of this spec plus both review patches. The run came after the last fix.

- The ranked list loads with no error screen. PASS.
- All 8 tablet rows show `—` with no price. The expanded Abyss Tablet row reads "pending · not checked yet". PASS. Screenshot: `C:/Users/ilyal/AppData/Local/Temp/claude/C--Users-ilyal-orca-workspaces-poe-crafting-base-price-checker-spec-remove-ilvl-from-recipe-searches-md/f1fbe045-1042-4445-9279-18eafe967d1a/scratchpad/after-review-tablets.png`
- Gold Amulet (rank 1) still shows 1.00, and the other gear raw rows still show prices. PASS. Screenshot: `C:/Users/ilyal/AppData/Local/Temp/claude/C--Users-ilyal-orca-workspaces-poe-crafting-base-price-checker-spec-remove-ilvl-from-recipe-searches-md/f1fbe045-1042-4445-9279-18eafe967d1a/scratchpad/after-review-gear.png`

`pnpm dev:stop` freed port 5173. After the review patches, `pnpm check` passed 8/8. An earlier run failed 3 tests in `test/hand-listed-coverage.test.ts`: the ESLint "lints every file" cases. They passed in isolation and on the rerun, which suggests a flake. `pnpm tracked:check` passes all checks.
