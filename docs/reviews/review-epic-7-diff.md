# Review: Epic 7 diff (`91b2d46..39be70a -- packages .claude tools package.json`)

Run from the Epic 7 retrospective (`docs/stories/epic-7-retro-2026-11-15.md`). Three lenses ran: adversarial, edge-case-hunter and verification-gap. `data/tracked.json`, `test/fixtures/wands-weights.json` and `docs/` are not part of the reviewed diff. The lenses gave extra weight to the story boundaries that no single dev session saw from both sides: 7.1 and 7.2, 7.5 and 7.3 with `cross-file/`, commit `a474893` against AD-17, and the 7.4 web consumers of the level.

A finding that more than one lens raised is marked *overlap*. Severity is the reviewer's own call (high, medium or low), and *scope today* counts the cases in the committed `data/`. A lens finding that a Review Triage Log of `spec-7-1` to `spec-7-5` already rejected or deferred, or that `deferred-work.md` already holds, is listed under *Dropped as already triaged*. Each such item is dropped unless the lens brought new evidence.

## Adversarial

**ADV-1 (medium): `tracked:check` passes an entry that `rank` never counts.** *Overlaps ECH (check gate) and VG (other).*
- **Location:** `packages/sync/src/curation/check.ts:218-221` (`isReached` in `classUnreachable`). Compare with `packages/core/src/rank-crafted-row.ts:70`, where `countedProbability` skips an entry above `L` before it computes reach.
- **Boundary:** 7.1 against 7.2. `isReached` counts an entry as reached if any recipe reaches it at any offered level, including a level below the entry's own `itemLevelMin`. Since 7.2, `rank` never counts an entry at `L < itemLevelMin`. Under the per-modifier floor of 7.1, eligibility does not grow with `L`: a low tier is the top tier of its modifier at 79, and it is dropped at 82 once a higher tier enters the scope.
- **Failure scenario (run):** Prefix tiers A@60 [10,20] and B@81 [21,30] are in one `modGroup`, the recipe floor is 70, and the entry has band [10,20] at floor 82. The floor is set above the entry's `needs` (60). `recipeReach` returns `{"reached":true}` at 79 and `{"reached":false,"slots":["prefix"]}` at 82. `rank` marks the entry not counted (`floor`) at 79 and `unreached` at 82, so it counts at no level under any recipe. `tracked:check` still exits 0 with `unreachable: []`. Both conditions are needed: a floor above the level where the entry is reached, and reach that disappears at the higher level.
- **Related triage:** 7.1 Edge 1 accepted a level mismatch between `tracked:check` and `rank` as an interim measure until 7.2. 7.2 Blind 3 rejected floors above 82. What is new here is a floor at or below 82 combined with the per-modifier floor of 7.1, which drops a tier as `L` rises. Since 7.2, the gate and `rank` disagree on such an entry, and no story re-checked the gate after 7.2 landed.
- **Guard:** `CRAFTING_ITEM_LEVELS.some((itemLevel) => entry.itemLevelMin <= itemLevel && recipeReach(...).reached)`. Add a `check.recipe-reach.test.ts` case with a floor of 82 for an entry reached only at 79. The fixture floor is 75 (`check.test-support.ts:10`), so `check.recipe-reach.test.ts:57` ("reaches at 79 only", `inputsOf(80, ...)` sets the tier, not the entry floor) passes whether or not the gate reads the floor.
- **Scope today:** 0. A scratch script over the committed data checked all 3,362 checkable crafted entries. Each one that `recipeReach` reaches at some level is also reached at some level `>=` its floor.
- **Verified:** Run. The reviewer ran `recipeReach` on the synthetic case and the live-data script against HEAD. The adversarial lens also ran `rank` on the case. The reviewer read `rank-crafted-row.ts:70` (`countedProbability` returns `floor` when `itemLevelMin > L`).

**ADV-2 (low, note for the architect): edge alignment can pass at the floor and fail at 82, so the AD-17 rev 48 invariant is false.** *Overlaps the ECH claim check (low confidence there).* This reopens 7.2 Edge 2 / Blind 2: "edge alignment runs at the floor while the summand runs at `L`". That item was deferred to the architect, and `a474893` (rev 48) closed it on the premise that "a wider pool cannot undo a pass". The new evidence is a run counterexample to that premise.
- **Location:** `packages/core/src/cross-file.ts:162` (`FLOOR_CHECKS` holds `edgeAlignment`), `packages/core/src/cross-file/edge-alignment.ts:21`, `packages/core/src/crafting-item-level.ts:7`, and the spine sentence "a wider pool cannot undo a pass of theirs" (`ARCHITECTURE-SPINE.md`, AD-17, about line 1297).
- **Boundary:** `a474893` (rev 48) against 7.5. Rev 48 keeps edge alignment at the entry's own floor because it assumes that a pass cannot be undone as the pool widens. Story 7.5 then made containment read the own interval, and it lets the lower edge equal either the lowest derived minimum or the lowest own minimum. A higher-level tier whose derived interval begins below the band, and whose own interval lies inside it, becomes contained at 82. That tier lowers `min` below `valueMin`, while `ownMin` stays above `valueMin`.
- **Failure scenario (run):** T1@60 [30,40], T2@75 [40,50] and T3@82 [35,48] share one line set, and the band is [40,50]. `edgeAlignment` passes at 75 and at 79. At 82 it reports "its edges are not the extremes [35, 50] (own minimum 41) of the tiers it contains (T2, T3)". The gate checks only at floor 75, so the entry passes. `rank` at `L` 82 then counts T3 in `P`, and the edge-alignment failure that would have named T3 never runs. T3's rolls 35-39 fall outside the [40,50] search. That loss is the kind AD-11 accepts as a residual for any own-interval band, so the EV effect is not new. The defect is the false invariant, together with a tier at 82 that the gate never sees. For that reason the severity is low.
- **Guard:** This is the architect's call, so the reviewer does not edit the spine. One option is to run `edgeAlignment` at every offered level at or above the floor, or at the widest level. Another is to restrict the own-minimum acceptance so that a pass at the floor holds at every level. Either way, align the AD-17 sentence and the `HIGHEST_CRAFTING_ITEM_LEVEL` JSDoc.
- **Scope today:** 0. The adversarial lens found 0 pass-to-fail flips over 6,724 entry slots. The reviewer found 0 overlaps that come from a higher-level tier over 8,990 banded lines. The shape needs a higher-level tier whose values sit lower (see ECH-3).
- **Verified:** The reviewer ran `edgeAlignment` over `scopedPools` at 75, 79 and 82 in a scratch script against HEAD.

**ADV-3 (low): a regenerated T2 sibling that sits above 79 is accepted silently.**
- **Location:** `.claude/skills/tracked-json/scripts/regenerate-entries.ts:103-111`.
- **Trigger:** A T1-only reference whose T1 is above 79 gets the family's T2 as a sibling. Nothing checks that the T2 is at or below `LOW_LEVEL`. A T2 above 79 is counted as `sibling`, and the reference stays out of `noT2`. The reference therefore gets no variant that counts at 79, and the report does not say so.
- **Guard:** Filter the siblings with `tier.itemLevelMin <= LOW_LEVEL`. When none qualifies, push `where` to `noT2`, or to a new list.
- **Scope today:** 0. A reviewer script counted 0 positive-weight T2 tiers above 79 that share a line set with a T1 above 79 in `data/weights.json`. This is new against the 7.3 log: Edge 2 and Blind 3 covered the family of the sibling and a missing T2, not the floor of the sibling.
- **Verified:** Read, plus the reviewer's count. An in-memory `regenerateEntries` run over the committed files is byte-identical to `data/tracked.json` (a fixed point; the reviewer's script).

**ADV-4 (low): `eligible` is rebuilt for every entry, close to the NFR-6 bound.**
- **Location:** `packages/core/src/probability.ts:358` (`setsOf` in `combinationProbability`), called once for each entry from `packages/core/src/rank-crafted-row.ts:73`. `eligible` is at `probability.ts:217`.
- **Trigger:** Since 7.2 the eligible set depends only on `(pool, L, modifierLevelMin)`, so every entry of a `(class, recipe)` pair shares it. `eligible` still re-filters both slot pools and rebuilds the per-modifier `top` map for each entry and recipe.
- **Consequence:** The adversarial lens measured `rank` in warm node on the committed data: 89-99 ms at 82 and 58-61 ms at 79, against NFR-6's 100 ms. The 7.3 log (Blind 11b) already knows about the thin margin. What is new here is the structural lever: memoise `eligible` per pool identity, `L` and floor, or compute the scoped sets once in `rankCraftedClass`.
- **Verified:** The reviewer read the per-entry call path. The timing was measured by the lens, not by the reviewer, and there is no pre-epic baseline, so this is not claimed as a regression.

**ADV-5 (low): the comment on `NO_CRAFTED_CONTEXT` is false, and that path throws.**
- **Location:** `packages/web/src/list/display-rows.ts:128-129` (the comment says "no line is built and the level is never printed") and `:160-165` (the `throw` in `craftedDetail`).
- **Trigger:** `craftedDetail` checks `recipeWord === undefined` and throws before `notCountedLine` would find no tracked entry in the empty map. `toDisplayRows(ranking, dataset)` with the default context reaches that check for any ranking that has a not-counted combination.
- **Scope:** All production callers pass `crafted` (`display-rows.ts:305`, `:316-317`). Only `test-support/dom.tsx:99` uses the default, and it ranks with no weights, so it has no crafted rows. The 7.4 log (#11) rejected the general throw. The new evidence is that the comment states the opposite of what the code does.
- **Guard:** Look up the tracked entry before the `recipeWord` check, or correct the comment.
- **Verified:** Read.

## Edge-Case Hunter

**ECH-1 (low): `nextOnGrid` keeps the shared value when a midpoint maximum is not an exact double.**
- **Location:** `packages/core/src/probability/value-grid.ts:20-21`.
- **Trigger:** The maximum of a two-`#` interval is `(a + b) / 2`. The division is exact, as AD-11 says, but the sum may not be. For example, `(0.7 + 0.1) / 2` is `0.39999999999999997`. `Math.round(highest * 20)` is 8, and `8 / 20 = 0.4 > highest`, so the function returns 0.4 rather than 0.45. The own minimum then equals the overlapping tier's maximum, so the value 0.4 falls in both own intervals.
- **Guard:** Snap `highest` to the grid before the comparison, for example `Number(highest.toFixed(digits + 2))`.
- **Scope today:** 0. The reviewer found 0 two-range maximum midpoints that print as an inexact decimal, over 8,990 banded lines of `data/weights.json`. The 7.5 log (#10) covered `-Infinity` and exponent notation, not float addition.
- **Verified:** Run. The reviewer called `nextOnGrid((0.7 + 0.1) / 2, 1, 2)` and got `0.4`.

**ECH-2 (low, note for the architect): a weight-0 tier can narrow an own interval.**
- **Location:** `packages/core/src/probability.ts:95-104` (the `deriveOwnInterval` loop has no `weight` or `untrackable` filter).
- **Trigger:** A tier with weight 0 in the same line set whose interval spans this tier's minimum pushes the own minimum up, although that tier cannot roll. The regenerated bands then drop valid low rolls.
- **Note:** AD-11 says "another tier of the same line set in the class's slot pool" and does not exclude weight 0. The code follows its owner document, so a change is an AD-11 decision.
- **Scope today:** 0 own intervals in `data/weights.json` that a weight-0 tier changes (reviewer script).
- **Verified:** Read, plus the live-data script.

**ECH-3 (low, note for the architect): in a family whose values fall as the level rises, the overlap goes by value, not to the lower-level tier.**
- **Location:** `packages/core/src/probability.ts:95-110`.
- **Trigger:** `deriveOwnInterval` cuts any tier whose derived minimum begins inside another tier's interval, whatever their levels are. In a family whose values fall as the level rises, the higher-level tier gives up the overlap. "Gives the overlap to the tier below" (AD-11) then means below in value, not in level. This is the shape that makes ADV-2 possible.
- **Scope today:** 0 overlaps that come from a higher-level tier, over 8,990 banded lines (reviewer script). The lens notes 309 negative ranges in the data, none of them cut.
- **Verified:** Read, plus the live-data script.

Leads that the lens checked and found handled, or that are already triaged, are listed under *Dropped* below.

## Verification gap

**VG-1 (low): no test runs the floor term of `widestLevel`.**
- **Location:** `packages/core/src/cross-file.ts:244` (`widestLevel(...floors)`), used by the `WIDEST_CHECKS` loop at `:228` and by `pairOverlap` at `:253`.
- **Gap:** Every test entry has a floor of 75 or 82. The `entry()` helper defaults to 82 (`packages/core/src/cross-file/test-support.ts:68`). The tiers above 82 in `cross-file.test.ts:73` and `:105` are tier fixtures under an entry at 82. If `widestLevel` were cut down to `HIGHEST_CRAFTING_ITEM_LEVEL`, an entry whose floor is above 82 would be checked at 82. Kind-agreement, line-set and co-occur failures from tiers between 83 and the floor would then go unreported, and every test would still pass.
- **Guard:** In `per-entry-floors.test.ts`, add a case with `entry({ prefix: valueless() }, { itemLevelMin: 90 })` over a banded tier at 86, and expect `kind-agreement` "at item level 90". Add the same for a hybrid pair.
- **Scope today:** 0 crafted floors above 82 (the highest is 82).
- **Verified:** Read. The reviewer opened the tests and the helper default, and grepped for entry floors above 82.

VG (other) on `check.ts:218-221` is ADV-1.

## `a474893` against AD-17

The code matches AD-17 rev 48 as written:
- Empty containment, edge alignment and co-rollable run at the entry's own `itemLevelMin`.
- Kind agreement and line-set completeness run at `max(82, floor)`.
- `coOccur` for every hybrid pair runs at `max(82, both floors)`.
- The `sync` gate takes no `L`.

The two failure tests in `per-entry-floors.test.ts:74` and `:91` pin the move to 82. The gaps are the untested floor term (VG-1) and the invariant that rev 48 rests on for edge alignment, which Story 7.5 later made false (ADV-2).

## 7.4: does the level reach every consumer?

Yes. One `level` state in `App.tsx` feeds the following:
- `useRanking`: the memo depends on `level`, and `rank` receives `craftingItemLevel`.
- The pick-up filter: it gets the same level-scoped `ranking` through `readyControls`. `level-toggle.test.tsx:257` asserts a concrete block change (Recurve Bow is craft at 82 and sell-raw at 79) and byte equality of the download at 79.
- The expansion "not counted" lines: `toListBranches` gets `itemLevel: level` and `recipeWord`.

Persistence holds when storage throws. `readStoredLevel` and `writeStoredLevel` call `globalThis.localStorage` inside the `try`, so a throwing getter is also caught. `level-toggle.test.tsx:145` makes `getItem` and `setItem` throw, then checks the first-visit values and that the toggle still re-ranks. Not tested: a `localStorage` getter that throws. It is handled by reading the code.

## Dropped as already triaged (no new evidence)

- **ECH:** pinned entries in the tombstone set, including the matching claim finding (7.3 Edge 6).
- **ECH:** a T2 sibling from another `modGroup` (7.3 Edge 2).
- **ECH:** an active entry that matches a pruned tombstone at another floor (7.3 Blind 2 / Edge 7).
- **ECH:** the `ownInterval` memo keyed by line only (7.5 #5).
- **ECH and ADV:** `rank` does not check `craftingItemLevel` at run time (7.2 Edge 6).
- **ECH:** the `craftedDetail` throw for a floor-kind line (7.4 #11). The comment nuance is kept as ADV-5.
- **ADV:** `nothing rolls at ilvl L` for a class whose entries are all `unreached` (7.4 #8: the Copy Deck defines not counted as floor or unreached).
- **ADV:** `RevealedLines` stays open after a switch to 0 and back (7.4 #17: Interaction 3a resets only on panel close).
- **ADV:** `CheckUnreachable` lost the recipe and slot (7.1 Blind 3).
- **ADV:** `SegmentedGroup` loses keyboard focus on activation. Rejected under the Accessibility Floor, because keyboard paths are out of scope (AGENT-WORKFLOW.md *Review brief* rule 1).
- **VG:** a pinned not-counted line is untested (7.4 #18).

## Skipped

- The impeccable design lens.
- `data/tracked.json`, `test/fixtures/wands-weights.json` and `docs/`, which are excluded from the diff.
- Browser checks.
- The full `pnpm check`. Only `crafting-item-level.test.ts`, `per-entry-floors.test.ts`, `own-interval.test.ts` and `packages/web/src/level` ran: 62 of 62 pass.
- `pnpm tracked:regenerate`, which rewrites the data. The reviewer ran it in memory instead.
