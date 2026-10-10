---
title: 'Post-4.3 deferred sweep: no italic, and state 43 crafted rows'
type: 'feature'
created: '2026-10-10'
status: 'done'
route: 'dispatch'
baseline_commit: 'fe6b4c03e6b453691e31ba4bd5cfabf5b3116085'
review_loop_iteration: 0
context:
  - '{project-root}/docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 4.3 is merged (PR #160), so two `deferred-work.md` entries gated on it are due. (1) DESIGN.md *Typography* sets no italic, but four inline `fontStyle: 'italic'` sites remain, and they render as a synthesized oblique. (2) With an empty or absent recipe set (EXPERIENCE.md state 43), `rank` sends every rankable crafted class to the Unrankable appendix as `recipe cannot reach this class` (retro item 29). State 43 says those classes list as unranked crafted rows (○, EV `—`, `no recipe published`) and the appendix shows its title alone (state 37).

**Approach:** Remove the italic and flip the one test that asserts it. Add a `no-recipe` Price trust reason to contracts. `rank` returns a recipeless group in place of the retro-29 fallback. Web appends that group as unnumbered crafted rows below the Raw Bases. Mark Story 4.3 `done` in `sprint-status.yaml` and remove both ledger entries.

## Boundaries & Constraints

**Always:** `core` decides and orders. `web` renders and orders nothing (AD-4, AD-17). The no-recipe rule is the first crafted rule, ahead of uncostable (EXPERIENCE.md *Price trust*). Each recipeless row carries `core`'s per-entry verdict for each non-pruned entry. Recipeless rows hold no numeral, and the Raw Base numerals are unchanged. Display words come from EXPERIENCE.md, never from contracts or core.

**Never:** Delete `TrustMark.tsx` or `TrustStrip.tsx` (separate ledger entries, Story 4.6). Compute an EV, a probability or a provenance for a recipeless class. Change the behaviour with a non-empty recipe set, including recipe-scoped `recipe cannot reach this class`. Edit DESIGN.md, EXPERIENCE.md, the PRD or the spine. Add a replacement cue for the removed italic: colour and role already carry each one (DESIGN.md `{typography.note}`, `missingFigure`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Empty set | `recipes: []`, one rankable crafted class | `recipeless` holds one class: verdict `pending`, reasons `[{kind:'no-recipe'}]`, one per-entry verdict per non-pruned entry in canonical key order. `ordering` and `unrankable` hold no row for it | N/A |
| Absent set | `recipes` undefined | Same as empty set | N/A |
| Class claim wins | Empty set, class absent from weights / partial / disagrees | Class stays in `unrankable` with its FR-4 reason, not in `recipeless` | N/A |
| Recipes exist | Non-empty set | `recipeless` is `[]`; everything else is unchanged | N/A |
| Page, state 43 | Recipeless group present | Raw rows numbered as before. Below all raw rows, one crafted row per class in `core` order: no numeral, ○, EV `—`, tooltip reason `no recipe published`. Its expansion lists the entries with their verdicts. Appendix title only, `0 Item Classes` | N/A |
| Page, state 23 | No price in league, empty set | Recipeless rows join the one canonical sequence like any other row | N/A |

</frozen-after-approval>

## Code Map

- `packages/web/src/list/AskingPriceLine.tsx:15`, `UnrankableAppendix.tsx:114`, `frame/TrustStrip.tsx:40-42` (and its comment), `list/TrustMark.tsx:20,27` -- the four italic sites. TrustStrip and TrustMark `'never'` do not render in production, but they lose their italic anyway. `UnitGlyph.tsx:19` `fontStyle: 'normal'` stays.
- `packages/web/src/frame/trust-strip.test.tsx:89,95` -- asserts `'italic'`; flip it to `''`.
- `packages/contracts/src/ranked-row/price-trust.ts:9-29` -- `PriceTrustReasonSchema`; add `{kind:'no-recipe'}`.
- `packages/core/src/price-trust.ts:99` `craftedTrust` -- crafted rules. The no-recipe verdict is a fixed value; it needs no new rule input.
- `packages/core/src/rank.ts` -- `Ranking` (71-90) gains `recipeless`. `rankCraftedClass` (192-226): the `costed.length === 0` branch (204-212) builds the recipeless class in place of `RECIPE_UNREACHABLE`. Per-entry verdicts use `entryTrust` (price-trust.ts:52). The JSDoc at 44 changes.
- `packages/core/src/index.ts` -- export the new type.
- `packages/core/src/rank/crafted-branch.test.ts:170-180`, `rank/unrankable-classes.test.ts` (51-61, 67, 74, 124-131), `rank/test-support.ts:129-130` `NO_RECIPE`, `rank.test.ts:127-134` -- these expect the retro-29 appendix entry; move them to `recipeless`.
- `packages/web/src/list/row/trust-words.ts` -- `FIXED_ROW_REASONS` gains `'no-recipe': 'no recipe published'` (the exhaustive type forces it).
- `packages/web/src/list/display-rows.ts` -- `ClassDisplayRow.provenance` becomes optional (readers compare only `=== 'uniform-prior'`). `toDisplayRows` appends recipeless rows after the trailing raw rows: numeral `undefined`, tier 3, ev `MISSING`, chase `[]`, combinations from `craftedDetail`-style lines (price from `storedPrice` when priced, `isBelowThreshold: false`), and pruned as today. `toListBranches` passes them through unchanged (state 35 cannot co-occur).
- `packages/web/src/list/active-ranking.ts` `forRecipe` -- passes `recipeless` through via the spread; no change expected.
- `packages/web/src/App/unrankable-appendix.test.tsx:167-168`, the retro-29 case in `App.test.tsx` -- update to state 43 / state 37.
- Header (`frame/header-controls.tsx`) already hides the recipe label, toggle and Craft Cost with no recipe, and `ExpectedValueTooltip` already has the `no-recipe` sentence. Do not change them.

## Tasks & Acceptance

**Execution:**
- [x] The four italic sites -- remove `fontStyle: 'italic'` (an `<em>` becomes a `<span>`). Flip `trust-strip.test.tsx`.
- [x] `packages/contracts/src/ranked-row/price-trust.ts` -- add the `no-recipe` kind. Add a parse case to the contracts test.
- [x] `packages/core/src/rank.ts` (+ `index.ts`) -- add `RecipelessClass { classKey, categoryId, className, itemLevelMin, trust, combinations: {entryKey, trust}[] }` and `Ranking.recipeless`, sorted by class key. Replace the retro-29 branch. Update the four core test files and add the matrix cases.
- [x] `packages/web/src/list/row/trust-words.ts`, `display-rows.ts` -- add the reason words and recipeless rows. Add display-rows tests: state 43 order, no numeral, Raw numerals intact, state 23.
- [x] Web App tests -- state 43 renders the rows and the title-only appendix.
- [x] `docs/stories/sprint-status.yaml` -- `4-3-...: done`. `docs/stories/deferred-work.md` -- remove the italic entry and the recipeless-group entry, in the last commit.

**Acceptance Criteria:**
- Given `packages/web/src`, when grepped for `italic`, then no production style sets it.
- Given the dev server with `recipes.json` holding `{"recipes": []}`, when the page loads, then it matches the state 43 row of the matrix (checked with agent-browser, not committed).
- Given `pnpm check`, when run, then it passes.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | verification-gap, blind | `isHonestEmpty` / `isOnlyUnresolvable` recipeless terms have no deciding test | low | Pre-verified: every fixture has another unpriced group or a price, so dropping either term fails nothing | patch |
| 2 | verification-gap | Upright not pinned at `AskingPriceLine` and the appendix note | low | No style assertion on `[data-asking-price-line]` or `[data-cell="note"]`; two one-line assertions fix it | patch |
| 3 | blind | `trust-strip.test.tsx` passes if an `<em>` returns (UA italic) | low | The test reads inline `style.fontStyle` only; a tag-name assertion pins it | patch (grouped with 2) |
| 4 | blind | `listStatement` comment omits the recipeless group | low | The comment lists "no crafted row and neither other unpriced group"; the predicate now also needs `recipeless` empty | patch |
| 5 | blind | `craftedTrust` JSDoc claims the ordered rules but the first rule lives in `NO_RECIPE_TRUST` | low | `price-trust.ts` JSDoc reads "the ordered rules of *Price trust*"; the no-recipe rule is applied in `rank.ts` | patch |
| 6 | blind | "holds no weights-file reason" test lost its positive check | low | It asserts only `unrankable` is `[]`, which passes if the class vanishes | patch |
| 7 | blind | `PriceTrust` import out of order in `rank.ts` | low | Sits between `CraftedTrackedEntry` and `CraftRecipe` | patch |
| 8 | edge, blind | Recipeless-only pricing suppresses state 23 | false | State 23's copy says no tracked unit has an in-league price; a priced crafted entry makes that false, so `pricedInLeague` true is correct (EXPERIENCE.md states 23, 43) | reject |
| 9 | edge | Split path duplicates recipeless rows | false | `recipeless` fills only when `costed` is empty, i.e. no recipe; `split` needs a recipe | reject |
| 10 | edge | All-broken recipeless lines keep "yet" | false | A recipeless row's verdict is `pending` (no-recipe), and "yet" drops only when every listed row is broken (state 23) | reject |
| 11 | edge, blind | TrustMark `'never'` now matches `'stale'` | low | The spec forbids a replacement cue; `'never'` does not render in production and the file's deletion is a ledger entry (Story 4.6). Unlikely to be met; the fix adds a removal outside scope | reject |
| 12 | blind | `RECIPE_UNREACHABLE` now always has a `recipeId`; type should enforce it | false | `rank.ts:140` still emits it with no `recipeId` for an empty pool | reject |
| 13 | blind | Shared mutable `NO_RECIPE_TRUST` object | low | No consumer mutates a `PriceTrust`; the fix adds freezing machinery | reject |
| 14 | blind | State 43 App test omits the EV tooltip sentence and hidden header | false | Covered by `ranked-list.test.tsx:45`, `expected-value-tooltip.test.tsx:44` and `craft-recipe.test.tsx` state 43 (slot empty, no cost unit); that code is unchanged | reject |
| 15 | blind | Long new comment line in `toDisplayRows` | low | Cosmetic; lint passes | reject |
| 16 | blind | Removed ledger entries' GitHub issues not closed | false | Not a defect in the diff; closing is the PR body's job at publish time | reject |
| 17 | blind | Code Map cites a nonexistent `App.test.tsx` | low | Fix edits this build's spec | reject |

## Design Notes

The recipeless class is not a `CraftedRankedRow`, because it has no `recipeId`, EV, provenance or summands. Forcing it into `ordering` would make every `ordering` consumer guard against it. A separate `Ranking` field keeps `ordering`'s contract, and web places the group (AD-4: the place is a view treatment that EXPERIENCE.md owns, and core's order inside the group is the class key).

## Verification

**Commands:**
- `pnpm check` -- expected: passes.
- `pnpm --filter @poe/core test`, `pnpm --filter @poe/web test` -- expected: pass.

**Manual checks:**
- With agent-browser on a named session, temporarily empty `data/recipes.json`, view the page, then restore the file (`git diff data/` is empty at the end).
