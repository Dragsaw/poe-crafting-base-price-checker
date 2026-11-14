---
title: 'Story 7.2: Per-entry floors and the Crafting Item Level in core'
type: 'feature'
created: '2026-11-14'
status: 'in-progress'
baseline_revision: 'f6f5fa1de035a5293dbacb5fc9d4ee75a1e6dd71'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/docs/stories/epic-7-context.md'
  - '{project-root}/docs/epics.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** `contracts` refuses a Tracked List whose crafted entries on one Item Class declare different floors. `pairOverlap` skips every pair with different floors. `rank` scopes each entry at its own floor, so the entries of one class are normalised against different pools, and no Crafting Item Level exists as an input. The pick-up filter raises craft and check-rolls drops to a shared class floor.

**Approach:** Delete the shared-floor load check, alone and first. Add a required Crafting Item Level `L` to `RankInput`. Every crafted entry of each `(itemClass, recipe)` pair is then scoped to `L`, and an entry with `itemLevelMin > L` is not a summand. `pairOverlap` checks a pair with different floors at the highest offered level. Pick-up qualifies each drop at its Raw Base's own floor. `web` passes the first-visit level 82.

## Boundaries & Constraints

**Always:** Cite AD-17, AD-5, AD-31, FR-36, FR-38 and FR-1. Do not copy their text into comments. `L` enters `rank` only as a passed-in value of type `CraftingItemLevel` (`typeof CRAFTING_ITEM_LEVELS[number]`), with no default. An entry with `itemLevelMin > L` is skipped before `combinationProbability` runs, so it can never fail the pair. It stays listed in `combinations` with its trust and no price. It is out of `trusted`, and it is not a summand. A Raw Base row does not read `L`. Edge alignment and every per-entry cross-file check stay at the entry's own floor. A same-floor `pairOverlap` pair stays at its floor. A pair with different floors is checked at `Math.max(...CRAFTING_ITEM_LEVELS)`, and its failure text names that level. `CraftedRankedRow.itemLevelMin` and `RecipelessClass.itemLevelMin` mean the lowest floor among the class's non-pruned crafted entries, which is the jewel-kind floor of FR-36. The `contracts` change is its own commit, and it is green alone.

**Never:** No UI and no level persistence (7.4). No `not counted` marker on a combination, and no `nothing rolls at ilvl` reason kind. Both stay on the ledger for 7.4, and the existing `no-prices` path meets "no priced Combination". No change to `data/` or to an artifact schema. Never edit an owner document (PRD, spine, `EXPERIENCE.md`, `DESIGN.md`). Do not rewrite other entries in `deferred-work.md`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Error Handling |
|---|---|---|---|
| Mixed floors load | crafted entries on one class at 75 and 82 | `TrackedFileSchema` parses, and `crossFileChecks` passes | — |
| Entry above `L` | floors 75 and 82, `L` 79 | only the 75 entry is a summand. The 82 entry is listed with no price and is out of the trust sums | — |
| Entry above `L` that would exhaust the augment | the 82 entry's slot is empty at 79 | the pair still ranks | — |
| Nothing counts | every floor above `L` | the row goes to `unpricedCrafted` (`pending`, `no-prices`) | — |
| One pool per pair | two counted entries with floors 75 and 79, `L` 82 | both probabilities use the pool scoped to 82 | — |
| Raw Base | a priced raw entry, `L` 79 and 82 | identical row at both levels | — |
| Mixed-floor hybrid pair that overlaps at 82 | hybrid entry at 75, single-line entry at 82, overlapping | `coOccur` failure names `82` | — |
| Pick-up | Raw Base floor 75, class with EV > 0 and crafted floors 75 and 82 | craft and check-rolls at 75 | — |
| Jewel kind | crafted floors 75 and 82 | jewel kind entry at 75 | — |

</intent-contract>

## Code Map

- `packages/contracts/src/envelopes/tracked-file-checks.ts:37,142` -- `checkSharedFloors` and its call. Delete both. Its tests are in `tracked-file-floor-and-kind-agreement.test.ts:20-60`.
- `packages/contracts/src/ranked-row.ts:82` -- the crafted row's `itemLevelMin` description says "the one floor". Reword it to the lowest-floor meaning.
- `packages/core/src/crafting-item-level.ts` -- `CRAFTING_ITEM_LEVELS`. Add the `CraftingItemLevel` type here and export it from `index.ts`. Update the JSDoc, because `rank` now reads it.
- `packages/core/src/rank.ts:33` -- `RankInput`. `rankCraftedClass` (L211) builds `first` and `itemLevelMin: first.itemLevelMin` (L231, recipeless), and passes options into `craftedRow`.
- `packages/core/src/rank-crafted-row.ts:60-108` -- `scanSummands` and `weakestProvenance` pass `entry.itemLevelMin` as the scope. `craftedRow` sets `itemLevelMin: first.itemLevelMin` (L125). `CraftedRowOptions` gains `itemLevel`.
- `packages/core/src/cross-file.ts:234-287` -- `scopeCache` (comment L234), `referenceFailures` (own floor, unchanged), `pairOverlap` (the floor-mismatch skip at L280). Comments at L64 and L67 say "class floor".
- `packages/core/src/pick-up/pick-up.ts` -- `ClassValue` (L29, the "share" doc), `rawBaseEntries` (`classFloor = Math.max(...)`), `jewelKindEntry`. Tests: `pick-up.test.ts:86-110`, `pick-up-floors.test.ts`.
- `packages/web/src/App.tsx:146` and `packages/web/src/App/pick-up-filter-support.tsx:137` -- the two production-side `rank` calls. `packages/web/src/test-support/dom.tsx:99` is a test caller.
- `packages/web/src/shared/product.ts:10` -- `DEFAULT_THRESHOLD` sits here. The first-visit level goes beside it.
- `rank` test callers: `core/src/rank/test-support.ts`, `rank/crafted-branch.test.ts`, `rank/purity-and-budget.test.ts`, and `web` `display-rows.test.ts`, `list-statement.test.ts`, `chase-and-rules.test.tsx`, `display-row-recipeless.test.ts`, `display-row-trust.test.ts`, `jewel-row.test.ts`.
- `packages/web/src/pick-up-filter/filter-text.test.ts:223-250` -- the synthetic golden text. `filter-text-floors.test.ts:10,50` uses the shared-floor wording.
- Committed data at the baseline: the crafted floors below 82 are on Emerald and Sapphire (75), and on Wands, Staves, Talismans and Belts (81). No Raw Base sits below its class's highest crafted floor. Baseline filter texts at L 82 for greater and perfect, threshold 0.25, are saved in `C:/Users/ilyal/AppData/Local/Temp/claude/26e3858fb0c54881/20295f5c-5f1f-4a2b-97f1-8b260b2c6aa7/scratchpad/before/`. The script is `filter-baseline.ts` beside them. Copy it into `packages/web/` to run it, and remove the copy afterwards.

## Tasks & Acceptance

**Execution:**
1. `packages/contracts/src/envelopes/tracked-file-checks.ts` -- delete `checkSharedFloors`. Replace its tests with one test that a mixed-floor class parses. Fix the `ranked-row.ts` description. Run `pnpm check` and commit this alone (`feat(contracts): ...`).
2. `packages/core/src/crafting-item-level.ts` -- export `type CraftingItemLevel`, and re-export it from `index.ts`.
3. `packages/core/src/rank.ts` -- add `readonly craftingItemLevel: CraftingItemLevel` to `RankInput`, with an FR-38/AD-17 JSDoc. Pass it into `craftedRow`. Recipeless and crafted rows take `itemLevelMin` as the lowest floor among the class's entries.
4. `packages/core/src/rank-crafted-row.ts` -- `scanSummands` skips entries above `L` as the Always rule says. Every other entry uses the scope `{ itemLevel: L, modifierLevelMin }`. `weakestProvenance` folds once at `L`.
5. `packages/core/src/cross-file.ts` -- `pairOverlap` checks a pair with different floors at the highest offered level and names it. Update the stale comments.
6. `packages/core/src/pick-up/pick-up.ts` -- craft and check-rolls entries use the Raw Base's own floor. The jewel kind uses `value.itemLevelMin`, which is now the lowest floor. Fix the `ClassValue` doc.
7. `packages/web/src/shared/product.ts` -- add `FIRST_VISIT_CRAFTING_ITEM_LEVEL: CraftingItemLevel = 82`, with an `EXPERIENCE.md` *What survives a reload* citation. Pass it at `App.tsx` and `pick-up-filter-support.tsx`.
8. Tests -- add `craftingItemLevel` at every caller. Cover each matrix row: the mixed-floor load in `contracts`, the `rank` rows in `core/src/rank/`, `pairOverlap` in `core/src/cross-file/`, and pick-up in `pick-up-floors.test.ts`. Add one test that edge alignment gives the same failures whatever `L` `rank` uses: the cross-file input has no `L`. Rewrite the shared-floor tests and names in `pick-up.test.ts` and `filter-text-floors.test.ts` for the own-floor rule.
9. Golden -- rerun the baseline script against the new code at `L` 82, and diff it against `before/`. Every changed block must belong to Emerald, Sapphire, Wands, Staves, Talismans or Belts. If `filter-text.test.ts`'s golden changes, update it in the same commit. Record each changed block and its cause in Implementation Notes.

**Acceptance Criteria:**
- Given the committed `data/`, when `pnpm tracked:check` and `pnpm test:data` run, then both pass.
- Given the code, when you search `packages/` for `share one floor` and `checkSharedFloors`, then nothing matches outside `dist/`.
- Given `rank` called twice with equal inputs, including `craftingItemLevel`, then the two results are deep-equal.
- Given the web page, when it ranks and builds the filter, then both calls pass `FIRST_VISIT_CRAFTING_ITEM_LEVEL`, which is 82.

## Spec Change Log

## Review Triage Log

## Design Notes

**Why the row keeps `itemLevelMin`.** No `web` view renders a class row's item level, because `RankedRow.tsx` shows the sell-as-is floor for raw rows only. FR-36's jewel kind needs the lowest crafted floor, and the row is where pick-up already reads the class. So the field keeps its name and shape, and it gets the one meaning that a reader still needs. Removing it would ripple through every web fixture for no player effect.

**Why skip before probability.** A not-counted entry must contribute nothing. If it reached `combinationProbability` at `L` below its floor, its empty slot could report `augment-exhausted` and sink a pair whose counted entries rank fine.

## Verification

**Commands:**
- `pnpm check` -- expected: passes, after the `contracts` commit and again at the end.
- `pnpm tracked:check` -- expected: exit 0.
- The baseline filter diff (task 9) -- expected: changed blocks only in the six listed classes.

**Agent browser checks:** The implementing agent runs these itself. Use a named session (`agent-browser session id --scope worktree --prefix poe`, then `--session <id>` on each call), run `pnpm dev` in the background, and run `pnpm dev:stop` at the end.
1. **Perfect list:** open the app with perfect active. Expected: crafted rows render with EV figures, and there is no page error. Take a screenshot.
2. **Emerald row:** open the Emerald row under perfect. Expected: the expansion lists its combinations and the EV is a figure or `< 0.01`. Take a screenshot.
3. **Filter download:** open the filter modal and generate the filter. Expected: the modal shows no error and the text names drops. Take a screenshot.

## Implementation Notes

- Commits: `b5c74e9` (`contracts`, alone and green) and `4d75923` (`core` and `web`). `pnpm check` passed after each. `pnpm tracked:check` exits 0.
- `HIGHEST_CRAFTING_ITEM_LEVEL` (`Math.max(...CRAFTING_ITEM_LEVELS)`) sits in `crafting-item-level.ts`. `pairOverlap` names it as `at item level 82`. A same-floor pair keeps `at floor N`.
- `scanSummands` gets a constant `{ ok: true, p: 0 }` for an entry above `L`, so `combinationProbability` never runs for it. Provenance folds once at `L`.
- Golden (task 9): at `L` 82, the greater and perfect filter texts for the committed `data/` are byte-identical to `before/`. No block changed. The six classes with crafted floors below 82 each have one floor, and no purpose flipped under the new scope. The old-versus-new EV figures were not measured.
- The synthetic golden in `filter-text.test.ts` changes one block: Solar Amulet (Raw Base floor 75, class floor 82), `Rarity Magic`, `ItemLevel >= 82` becomes `>= 75`. Cause: check-rolls now qualifies at the Raw Base's own floor (FR-36).
- Agent browser checks: perfect list, Emerald expansion (230 more combinations, EV `0.22`) and the filter modal all render with no page error. The download did not run under agent-browser (it was canceled). The filter text was checked through the golden diff above instead.
