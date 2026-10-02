---
title: 'Story 3.4: The crafted EV, Craft Cost and the Craft Recipe control'
type: 'feature'
created: '2026-10-02'
status: 'done'
baseline_commit: '47fb4d737602a71015a8398eab68cf891d8c62dc'
route: 'dispatch'
review_loop_iteration: 1
context:
  - '{project-root}/docs/stories/epic-3-context.md'
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/IMPLEMENTATION-NOTES.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `rank` sends every crafted entry to the unrankable group, so the page ranks only Raw Bases. No recipe exists, nothing costs a craft, and the masthead slot for the Craft Recipe is empty (epics Story 3.4, FR-1, FR-26).

**Approach:** `core` ranks every `(Item Class, recipe)` pair in one ordering. The EV is the AD-17 sum of `combinationProbability × price` over the priced, unpruned entries at or above the threshold, less a Craft Cost costed from `dataset.currencyRates` (AD-20). `web` adds the Craft Recipe control, its persisted choice and the Craft Cost line. It filters to the active recipe before the top-20 bound, and it renders crafted rows and states 25 and 35.

## Boundaries & Constraints

**Always:**
- The EV, threshold, ordering and tie-break come from AD-17: the threshold is tested against the gross price, the cost is subtracted once, and a class with no surviving summand ranks at `−craftCost` with `summands: []`. The order is EV descending, then kind (raw before crafted), then the serialised canonical key, then the recipe id. Summands are ordered by contribution descending, then canonical key.
- P comes only from `combinationProbability` (IN §9, §11). Do not re-derive it. Its `empty-eligible-pool` and `augment-exhausted` results make the pair unrankable, and never `P = 0`. Coverage reads no recipe.
- Craft Cost = Σ `quantity × rate` over the recipe's currencies. A rate that is missing, or that carries another league, makes the recipe **uncostable**, and never `0`. In state 35, every crafted pair is still ranked within the crafted branch. Its EV is unavailable, and its order is the gross-payout order.
- `web` computes no term. Bound = `TOP_ROWS` after the recipe filter, and per branch in state 35. The active recipe persists in browser storage beside the threshold. A click re-ranks synchronously, with no debounce, and open panels stay open.
- The control and the cost line follow EXPERIENCE `{components.craft-recipe}`, state 34/35 and DESIGN `craft-recipe`. They use the pipe divider and no Mantine form control.
- One test measures a threshold change: a full `rank` pass over the cross product, on fixture-scale data, completes under 100 ms. The measurement is recorded in Implementation Notes.

**Never:**
- No Craft Cost in `sync` and no persisted ranking (AD-4). No new artifact (AD-24). No reason string beyond FR-4's three and the provisional one the Decisions add. No chase cells (3.5), and no provenance marks or banner (3.6).
- No edit to an owner document (PRD, epics, spine, IN, UX).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior |
|----------|--------------|---------------------------|
| Happy path | crafted class, 2 priced entries above T | EV = Σ P·price − cost, two summands ordered by contribution |
| Gross, not net | price ≥ T > price − cost | the entry survives |
| Not priced / pruned | entry `no-listings`, or `pruned` | contributes nothing, and its P is not summed |
| Nothing clears | every price < T | ranked at `−cost`, `summands: []`, numerals print (state 25) |
| Floor empties pool | recipe floor above every eligible tier | that pair is unrankable, and the other recipe's pair ranks (state 36) |
| Missing / foreign rate | currency without a rate, or a rate from another league | recipe uncostable: the cost line reads *no figure yet*, crafted EV cells read *no figure yet*, a declarative names the recipe, there are no numerals, and each branch keeps its own order and its own top 20 |
| Tie | equal EV across kinds and recipes | raw first, then canonical key, then recipe id, asserted on `rank`'s ordering |
| Switch | click the inactive word | the list re-ranks in the same render pass, raw rows keep their relative order, and the choice survives a reload |
| Stored id unknown | stored recipe id not in `recipes.json` | fall back to the first recipe in file order |
| Bad recipe set | one recipe mixes grades, or two recipes derive one word | `RecipesFileSchema` refuses, and the page shows the existing refusal screen |

**Decisions (2026-10-02, player):**
- Grade word: grades are the currency-id prefixes `greater-` and `perfect-` only. A recipe whose currencies carry neither reads `regular`. A pure `recipeWord` lives in `contracts`. A `RecipesFileSchema` refine refuses mixed grades in one recipe and a duplicate word across recipes (AD-3 refusal). Append a `[NOTE FOR ARCHITECT]` so that IN takes ownership of the predicate and the ledger entry for the grade ruling closes.
- State 36: the player re-floored `jewel/Emerald` to 82 (`pnpm tracked:check` passes), so no live pair empties its pool. The defensive case stays: `empty-eligible-pool` and `augment-exhausted` make the pair unrankable, and the appendix prints the provisional reason `recipe cannot reach this class`. Append a `[NOTE FOR PM]` so that FR-4 can adopt or reword it.
- Rates: add dummy rates for the four orbs to `data/currencies.json` (league `Forbidden Rites`). Append a deferred entry that says the player must replace them with real values. `dataset.json` is not hand-edited, so the dev page stays in state 35 until the next sync.
- Scope: keep the spec whole (about 2,300 tokens), as the player chose.

</frozen-after-approval>

## Code Map

- `packages/core/src/rank.ts` -- `RankInput` (:51-77, add `recipes`), `Ranking` (:109-126), `UnrankableReason` (:85-88), crafted entries `continue` at :214-224 (replace this with the crafted branch), raw branch :225-268 (do not change), `KIND_ORDER` (:129, add `crafted:1`), `compareRankedRows` (:138, add the recipe id as the last term), `compareOrdering` (:146), threshold guard :192.
- `packages/core/src/probability.ts` -- `combinationProbability(pools, entry, modifierLevelMin)` (:231) returns `{ok,p}` or the reasons `class-absent`, `empty-eligible-pool`, `augment-exhausted`. The header (:33) says 3.4 maps them. Do not change the formulas.
- `packages/contracts/src/ranked-row.ts` -- `RankedRowSchema` has only the `raw` arm, with `craftCost: z.literal(0)`. Add a `crafted` arm: `recipeId`, `craftCost` (number or uncostable), `summands[]`.
- `packages/contracts/src/craft-recipe.ts` (:13), `currency-rate.ts` (rate = Divine per unit, with its own `league`), `envelopes.ts` `RecipesFileSchema` (:129-148), `DatasetFileSchema.currencyRates` (:186), `canonical-key.ts` (the price join key).
- `packages/web/src/App.tsx` -- `ReadyBody` (:137-170) runs `rank` in `useMemo`. Threshold state is at :72-76. `set.recipes` is already loaded (`load/artifacts.ts`, tolerable).
- `packages/web/src/threshold/threshold-storage.ts` -- copy its read and write pattern for a `poe-cbpc.craftRecipe` key.
- `packages/web/src/frame/Masthead.tsx` -- the empty `data-recipe-slot` (:53, width `spacing.recipePanelWidth`). `MASTHEAD_DEK` (:13) is out of date (deferred dek item).
- `packages/web/src/list/display-rows.ts` `toDisplayRows` (:70), which is raw-only. `RankedList.tsx` (:58 `slice(0, TOP_ROWS)`). `list-statement.ts` (state 25 / honest-empty). `format.ts` `rawPanelSubLine` (:198) gains the recipe. Its tests at `expansion.test.tsx:100` and `format.test.ts:164-175` forbid "Craft Recipe" today, so update them.
- State 23 (honest empty) with crafted rows -- EXPERIENCE state 23: when nothing is priced in the active league, every tracked unit (every Item Class of the active recipe and every Raw Base) is listed in canonical order. No rank numerals print, and every EV cell reads *no figure yet*. Today `isHonestEmpty` (`list-statement.ts`) needs `ordering.length === 0`, which a ranked crafted pair always breaks. `core` must state the fact, because `web` cannot tell an unpriced crafted entry from one priced below the threshold.
- `packages/web/src/frame/AbsenceLines.tsx:10` -- the recipes-absent line stays.
- Test helpers: `rank.test.ts` (`weightsWith`, `crafted`, `priced`, `permute`), `probability.test.ts` (`tier`, `pools`), `web/src/test-support/{list-fixtures,artifact-server,dom}.ts(x)`.
- Data: `data/recipes.json` is empty. `data/currencies.json` and `dataset.json` hold rates only for divine, exalted and chaos. The currency ids `greater-orb-of-transmutation`, `perfect-orb-of-transmutation`, `greater-orb-of-augmentation` and `perfect-orb-of-augmentation` are in `catalogue/static.json`. IN §9 states the floors: greater 44, perfect 70. The player has re-floored `jewel/Emerald` to 82, so tests that pin Emerald at floor 1 must follow.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/ranked-row.ts` (+ test) -- add the crafted arm.
- [x] `packages/contracts/src/craft-recipe.ts`, `envelopes.ts` (+ tests) -- `recipeWord` and the recipe-set refine (Decision).
- [x] `packages/core/src/craft-cost.ts` (+ test, `index.ts`) -- `craftCost(recipe, rates, league)` returns `{ok, divine}` or `uncostable{currencyId}`.
- [x] `packages/core/src/rank.ts` (+ test) -- the crafted branch over the cross product: the summands, the reason mapping and the ordering terms. Add `uncostableRecipes` to `Ranking`. Cover every matrix row, and add the perf measurement test.
- [x] `packages/web/src/recipe/` (control, storage) (+ tests) -- the control, the cost line and persistence.
- [x] `packages/web/src/App.tsx`, `list/display-rows.ts`, `list/RankedList.tsx`, `list/list-statement.ts`, `list/format.ts`, `frame/Masthead.tsx` (+ tests) -- recipe state, the filter-then-bound order, crafted row rendering (Item Class name, class glyph, EV), the state-35 per-branch render and declarative, and the context line.
- [x] `data/recipes.json`, `data/currencies.json` -- the two v1 recipes (ids `greater`, `perfect`, one of each orb, floors 44 and 70), and the dummy rates. `data/tracked.json` holds the player's Emerald re-floor and is committed as-is. Report the edits as AGENT-WORKFLOW requires.
- [x] `packages/core/src/rank.ts`, `packages/web/src/list/{list-statement,display-rows,active-ranking}.ts` (+ tests) -- state 23 with crafted rows. `Ranking` gains `pricedInLeague: boolean`: true when any non-pruned tracked entry, raw or crafted, carries a `priced` observation in the active league. `isHonestEmpty` holds when `pricedInLeague` is false and the list has a row to show (an unpriced Raw Base, or a crafted row of the active recipe). While it holds: the crafted rows of the active recipe join the one canonical-order sequence by class key, with no numerals and *no figure yet* in every EV cell. It takes precedence over state 35 (no branch split) and over state 25. Test a league reset with a rankable crafted class under a costable and an uncostable recipe, in `rank.test.ts`, `list-statement.test.ts` and `recipe/craft-recipe.test.tsx`.
- [x] `docs/stories/deferred-work.md` -- append the notes this story raises. Remove the entries it discharges.

**Acceptance Criteria:**
- Given two recipes over one Tracked List, when `core` ranks both, then the two orderings differ by more than a constant offset.
- Given the workspace, when searched, then no EV, P or Craft Cost arithmetic exists in `web`.

## Verification

**Commands:**
- `pnpm check` -- expected: types, lint and dependency rules all pass.
- `pnpm test` -- expected: all tests pass, with no network call. The perf test passes under 100 ms.

**Manual checks:**
- agent-browser (named session) on `pnpm dev`: the control prints the two words. Click to switch: the list re-ranks, the choice survives a reload, the cost line shows, and an uncostable recipe shows the state-35 render.

## Implementation Notes

- Perf (NFR-6): a full `rank` pass over the committed cross product (`data/tracked.json`, `weights.json`, `dataset.json`, the two recipes; 3 rankable classes × 2 recipes plus raw) measured 1.8–3.7 ms per pass over ten threshold changes (median about 2 ms) on the dev machine, 2026-10-02. No memoisation was needed. `rank.test.ts` asserts the fastest of five runs is under 100 ms.
- `Ranking.ordering` holds every pair of every recipe. The comparable rows (raw, costable crafted) come first by EV; the rows of an uncostable recipe (`ev: null`) follow, by gross payout. `web` filters to the active recipe (`forRecipe`) and splits branches only in state 35. The crafted row's tie-break key is the class key `["crafted", categoryId, className]`.
- P is computed for every non-pruned entry of a pair, priced or not, so an `empty-eligible-pool` / `augment-exhausted` verdict does not move with the threshold.
- Finding: the committed `jewel/Emerald` pool has every tier at `itemLevelMin` 1, so both floors empty it and state 36 is live (appendix: `Emerald — recipe cannot reach this class`). Ledgered as a `[NOTE FOR PM]`.
- The masthead dek still says crafted Item Classes are not ranked yet. Its owner is EXPERIENCE.md, which this story may not edit, so the existing epic 2 retro item 19 entry stays open.

## Spec Change Log

- 2026-10-02, review iteration 1. Trigger: V1/B1/E1/B13. State 23 could not be reached once a crafted class was tracked, so a league reset printed nothing-clears or the state-35 declarative, with numerals. Amended: Code Map (state 23 entry) and one new task (`pricedInLeague`, the honest-empty predicate and render with crafted rows). Known-bad state avoided: a page that claims a ranking after a reset. The player chose to fix forward on the existing diff, without a revert. KEEP: everything else in the iteration-1 diff. That covers the contracts crafted arm, `recipeWord` and the refine, `craftCost`, the crafted branch and ordering in `rank`, `forRecipe`, `toListBranches`, the state 25/35/36 renders, the control, the storage and every existing test.

## Review Triage Log

Iteration 1 (2026-10-02). Layers: blind-hunter (B), edge-case-hunter (E), verification-gap (V), deferred-ledger-audit (L: zero findings).

| # | Finding | Verdict | Evidence | Route |
|---|---------|---------|----------|-------|
| V1 / B1 / E1 / B13 | State 23 (honest empty) cannot be reached once a rankable crafted class is tracked: crafted pairs always enter `ordering`, so `isHonestEmpty` fails. A league reset prints nothing-clears (costable) or the state-35 declarative (uncostable), with numerals and `-0.03` EVs. The raw branch in state 35 also hard-codes `honestEmpty: false` | high | `list-statement.ts` `isHonestEmpty` needs `ordering.length === 0`. `rank.ts` `craftedRow` returns a row for every reachable pair, priced or not. EXPERIENCE state 23 lists every Item Class and Raw Base in canonical order, with no numerals and *no figure yet*. No test covers a reset with crafted rows. The fix needs `core` to say whether anything is priced in the active league, which is new `Ranking` surface the spec does not settle | bad_spec |
| B2 | The frozen State-36 Decision says the Emerald re-floor to 82 leaves no live pair with an empty pool. It does not: every Emerald tier has `itemLevelMin` 1, and the recipe floor reads the tier, so Emerald is Unrankable under both recipes | medium | Committed-data appendix test (`App.test.tsx`) expects `Emerald — recipe cannot reach this class`. The code follows the frozen "defensive case stays". The false premise is inside the frozen block, so only the player can say whether this outcome is acceptable | intent_gap |
| B3 | Dummy orb rates reach `dataset.json` on the next sync and print made-up Craft Costs with no flag | medium | The frozen Rates Decision chose this, and the ledger entry for the player exists. Nothing reads `source` | defer |
| B4 | The masthead dek still says crafted classes are not ranked | low | `MASTHEAD_DEK`. EXPERIENCE owns the copy (review brief rule 2). The epic 2 retro item 19 entry is open | defer |
| B5 / E6 | `epic-3-context.md` still lists the state 25/35 `listStatement` work and the grade ruling as owed | low | Both are discharged by this story. A direct deletion in a non-owner cache file | patch |
| B6 | `sprint-status.yaml` says in-progress while the spec says in-review | false | Step 5 syncs sprint status, so the two agree by design mid-review | reject |
| B7 / E3 | One unreachable entry makes the whole `(class, recipe)` pair Unrankable | false | The frozen Always rule says `empty-eligible-pool` and `augment-exhausted` "make the pair unrankable". The code conforms | reject |
| B8 | The crafted row's `itemLevelMin` comes from the first entry, unchecked | false | `TrackedFileSchema` refuses two floors on one class (`envelopes.ts:40-91`) | reject |
| B9 | AC 2 has no automated check, and `recipeCostLine` calls `craftCost` a second time | false | The AC is "when searched". `web` calls `core`'s function with the same rates and league as `rank`, and does no arithmetic of its own | reject |
| B10 | Keyboard focus is lost on a switch, and there is no `aria-pressed` | false | Accessibility Floor (review brief rule 1): mouse only. Keyboard paths and ARIA are ruled out | reject |
| B11 | The manual browser check is not recorded in Implementation Notes | low | The only fix edits this spec | reject |
| B12 | `RankedList` keeps a legacy `rows` prop beside `branches` | low | `test-support/dom.tsx:70` uses `rows`. No user-facing harm, and no caller will diverge | reject |
| B14 / E2 | Duplicate same-league rates make the Craft Cost depend on array order | low | `DatasetFileSchema.currencyRates` has no uniqueness refine. `sync` writes one rate per currency from `currencies.json`, so a duplicate is unlikely, and the fix adds a refine | reject |
| E4 | `recipeOptions` throws during render when a recipe has no word | false | `RecipesFileSchema` refuses that set before render. A loud failure on an unreachable state is correct | reject |
| E5 | Positional branch keys carry the grown flag from the single list to the raw branch on entering state 35 | low | Intended and commented. No named harm | reject |
