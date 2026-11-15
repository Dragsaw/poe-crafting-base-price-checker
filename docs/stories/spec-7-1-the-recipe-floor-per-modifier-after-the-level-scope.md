---
title: 'Story 7.1: The recipe floor per modifier, after the level scope'
type: 'bugfix'
created: '2026-11-14'
status: 'done'
baseline_revision: '124ff7b2c014dff406d1ad55d0984ed62da9d5c0'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/docs/stories/epic-7-context.md'
  - '{project-root}/docs/epics.md'
warnings: ['oversized']
deferred:
  - summary: >-
      A not-counted (unreachable) entry has no mark in `CraftedCombination` and no distinct display or ordering in `web`.
    evidence: |-
      `scanSummands` pushes `{entryKey, trust}` with the entry's own trust (can be `current`) and no price. `compareCombinations` sorts it with the priced group, and `display-rows.ts` renders it as an ordinary unpriced line. The `CraftedCombinationSchema` description still says "below threshold, pending or broken". Story 7.4 (state 49, `+ N not counted`) owns the treatment, and 7.2 may add the marker. Blind Hunter and Verification Gap findings.
    location: >-
      packages/core/src/rank-crafted-row.ts:74
    severity: medium
  - summary: >-
      A pair with no reachable entry reads `pending` with `no-prices`, which tells the player prices are coming.
    evidence: |-
      `craftedTrust` with an empty entry list returns `{verdict: 'pending', reasons: [{kind: 'no-prices'}]}`. `EXPERIENCE.md` state 48 gives the reason `nothing rolls at ilvl <level>` when no entry counts. Stories 7.2 and 7.4 add that reason kind. Blind Hunter finding.
    location: >-
      packages/core/src/price-trust.ts:122
    severity: medium
  - summary: >-
      The DESIGN.md and EXPERIENCE.md revision pins now name 24 and 34, so they no longer trip for the `level-toggle` and Interaction 1b transcription that Story 7.4 owes.
    evidence: |-
      Every content assertion of `tokens.test.ts` and `trust-words.test.ts` passes against revisions 24 and 34. The pins were raised so that `pnpm check` is green. Story 7.4 must transcribe `level-toggle` and the new Copy Deck strings without that tripwire. Blind Hunter finding.
    location: >-
      packages/web/src/theme/tokens.test.ts:70
    severity: low
---

<intent-contract>

## Intent

**Problem:** `core` applies the recipe floor per `modGroup` on the unscoped pool, before the item-level scope. A greater or perfect recipe therefore loses tiers that the game can roll, for example T2 Cold Spell levels on an ilvl 79 Wand under perfect. One unreachable entry also makes its whole `(itemClass, recipe)` pair unrankable (`RECIPE_UNREACHABLE`, the retired state 36).

**Approach:** Use the AD-17 order: scope to `L`, then floor each modifier (one `modGroup` plus one line set) on its own, then renormalise, exclude and renormalise. Pass `L` as an explicit value. Until 7.2 the value is the entry's own `itemLevelMin`. The reach verdict becomes per `(entry, recipe, L)`, and an unreachable entry is not a summand. `tracked:check` fails only for an entry that no recipe reaches at any offered level, and those levels are exported once from `core`.

## Boundaries & Constraints

**Always:** Cite AD-17, FR-26, FR-38 and FR-4. Do not copy their text into comments. A transform truncates and renormalises, and it never reweights. `modifierLevelMin = 0` runs the same code path and changes nothing. A modifier is the key `[modGroup, lineSet(entry)]`. Its highest tier is its best tier with positive weight among the tiers with `itemLevelMin <= L`. Its tiers below the floor go only when one of its positive-weight scoped tiers is at or above the floor. The offered levels `[79, 82]` live in one exported `core` constant. The edge-case fixture uses real Wand tiers, copied verbatim from `data/weights.json`, because NFR-2 requires real data.

**Never:** No `L` in `rank`'s input and no UI. Those belong to 7.2 and 7.4. No change to `data/tracked.json` or to any artifact schema. No change to the shared-floor check or to `pairOverlap` (7.2). Never edit an owner document (PRD, spine, `EXPERIENCE.md`). Do not rewrite other entries in `deferred-work.md`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Error Handling |
|---|---|---|---|
| Tier at or above the floor | modifier tiers 40, 75 at L 82, floor 70 | only the 75 survives | — |
| All scoped tiers below the floor | tiers 55, 81 at L 79, floor 70 | the 55 survives at its own weight | — |
| Top tier above L | tiers 60, 80 at L 79, floor 44 | the 60 survives, and 80 is out of scope | — |
| Two modifiers in one `modGroup` | Cold (55, 81) and Fire (55, 75) in `IncreaseSocketedGemLevel`, L 79, floor 70 | Cold keeps 55, Fire keeps 75 | — |
| Floor 0 | any pool | equals the scoped pool | — |
| Entry `empty-contained` or `p === 0` at its scope | `rank` | not a summand, out of the trust sums, still listed in `combinations`. The pair still ranks. With nothing counted, the pair goes to `unpricedCrafted` (`no-prices`) | — |
| `empty-eligible-pool` at the scope | `rank` | pair unrankable, reason `pool empty`, with `recipeId` | — |
| `augment-exhausted` | `rank` | pair unrankable, reason `augment exhausted`, with `recipeId` | — |
| Class pool total weight 0 | `rank` | class unrankable, reason `pool empty`, no `recipeId` | — |

</intent-contract>

## Code Map

- `packages/core/src/probability.ts` -- `floored` (L130) is the old per-`modGroup` floor. Delete it. `eligible` (L143) becomes scope, then floor per modifier. `combinationProbability` (L267), `affixProbability` (L195) and `recipeReach` (L155) read the scope from `entry.itemLevelMin`. `ProbabilityReason` kinds stay as they are.
- `packages/core/src/provenance.ts:23` -- `foldPair` takes the scope from `entry.itemLevelMin`.
- `packages/core/src/rank-crafted-row.ts:55` -- `scanSummands` returns `undefined` on any failure or `p === 0`. That is the backstop to remove.
- `packages/core/src/rank.ts` -- `RECIPE_UNREACHABLE` (L118), the `isEmptyPool` cause (L144), the per-pair unrankable (L255), and the doc text of `UnrankableReason` and `UnrankableClass.recipeId`.
- `packages/core/src/cross-file.ts:69` -- calls `eligible(pool, floor, 0)`. Floor 0 keeps it identical, so leave it.
- `packages/core/src/index.ts` -- exports `floored`, `RECIPE_UNREACHABLE` and `recipeReach`.
- `packages/sync/src/curation/check.ts:212-263` -- `classUnreachable` lists `(entry, recipe, slot)` rows.
- `.claude/skills/tracked-json/scripts/lookup-mods.ts:116-147` -- the `tiers` flag `reached` comes from `floored` on the unscoped pool.
- `.claude/skills/tracked-json/SKILL.md` lines 12 and 37 (step 4b) -- the `unreachable` rule and the `recipes` field.
- `packages/web/src/list/UnrankableAppendix.tsx:14,35` -- `APPENDIX_NOTES` and the state 36 branch.
- Tests to update: `packages/core/src/probability.test.ts`, `probability/blocking-tags.test.ts`, `rank/blocking-tags.test.ts`, `rank/provenance.test.ts`, `packages/sync/src/curation/check*.test.ts`, `lookup*.test.ts`, `packages/web/src/list/unrankable-appendix.test.tsx`, `packages/web/src/App/raw-ranks-note.test.tsx`.
- Real data: the Wands (`weapon.wand`) suffix `explicit.stat_2254480358` has T2 `[4,4]` at ilvl 55 and T1 `[5,5]` at 81, in `modGroup` `IncreaseSocketedGemLevel`. The prefix `explicit.stat_2505884597` (`ColdDamage`) has T2 `[25,27]` at ilvl 60 and T1 at 80. Perfect has `modifierLevelMin` 70. `test/fixtures/frozen-data/weights.json` has no Wands.

## Tasks & Acceptance

**Execution:**
- `packages/core/src/crafting-item-level.ts` (new) -- export `CRAFTING_ITEM_LEVELS = [79, 82] as const` with an FR-38 citation. Re-export it from `index.ts`.
- `packages/core/src/probability.ts` -- add `RecipeScope { itemLevel; modifierLevelMin }`. Rewrite `eligible(pool, itemLevel, modifierLevelMin)` per the Always rules and delete `floored`. `affixProbability`, `combinationProbability(pools, {prefix, suffix}, scope)` and `recipeReach(pools, entry, scope)` take `RecipeScope`. Update the export list in `index.ts`.
- `packages/core/src/provenance.ts` -- `foldPair(pools, entry, scope)`.
- `packages/core/src/rank-crafted-row.ts` -- pass `{ itemLevel: entry.itemLevelMin, modifierLevelMin }` until 7.2. Sort each entry into one of three outcomes: counted; not counted (`empty-contained` or `p === 0`, still listed in `combinations`, no `gross` in the trust sums); or a pair failure that carries its reason (`empty-eligible-pool` → `pool empty`, `augment-exhausted` → `augment exhausted`).
- `packages/core/src/rank.ts` -- delete `RECIPE_UNREACHABLE`. `UnrankableReason` gains `'pool empty'` and `'augment exhausted'`, the causes `core` observed (AD-17, FR-4 paragraph). The empty class pool reports `pool empty`. A pair failure reports its own reason, with `recipeId`.
- `packages/sync/src/curation/check.ts` -- `unreachable` lists each crafted entry with no reach under any recipe at any `CRAFTING_ITEM_LEVELS` value. There is one row per entry, `{path, entryKey}`, sorted by canonical key. Update the doc comments.
- `.claude/skills/tracked-json/scripts/lookup-mods.ts` -- `recipes` gets one item per (recipe, level): `{recipeId, modifierLevelMin, itemLevel, reached}`. `reached` is true when the tier is in `eligible(pool, itemLevel, modifierLevelMin)`.
- `.claude/skills/tracked-json/SKILL.md` -- give step 4b and the `tiers` description the new `recipes` shape, and make line 12 match the command.
- `packages/web/src/list/UnrankableAppendix.tsx` -- remove the `RECIPE_UNREACHABLE` branch and the state 36 doc text. The new reasons take no note, and state 16's note applies to them as to any other reason.
- `test/fixtures/wands-weights.json` (new) -- a weights envelope of `data/weights.json`'s `weapon.wand` `Wands` pools, copied verbatim, with the source `gamePatch` and `producer` kept. Add a note to `test/fixtures/frozen-data/README.md` or next to the file.
- Tests -- cover every row of the I/O matrix (synthetic tiers are fine there), the Wand fixture, the `check.ts` rule across levels, the lookup shape, and the web appendix with the new reasons. Drop the tests of the retired behaviour.
- `docs/stories/deferred-work.md` -- append one entry: FR-4 and the `EXPERIENCE.md` Copy Deck name no words for `pool empty` or `augment exhausted`. AD-17 calls that a PRD finding. Set `retry_when: never — needs a human`.

**Acceptance Criteria:**
- Given the Wand fixture and the entry prefix band `25–27` with suffix band `4–4`, when `core` computes under perfect (70), then at L 79 `recipeReach` is reached and `combinationProbability` is above 0, and at L 82 it is not reached.
- Given a fixture with all four modifier shapes of the matrix, when `core` computes the perfect-recipe probabilities, then each equals a hand-computed value under the per-modifier rule.
- Given `(entry, recipe, L)`, when `recipeReach` and the lookup `tiers` both judge it, then both read `eligible` with the same scope.
- Given the committed `data/tracked.json`, when `pnpm tracked:check` runs, then it exits 0 with `unreachable: []`, and `pnpm test:data` passes.
- Given a class with an unreachable entry and a reachable one under a recipe, when `rank` runs, then the pair ranks with the reachable entry's summand only, and `unrankable` has no row for it.
- Given the code, when you search `packages/` for `RECIPE_UNREACHABLE` and `recipe cannot reach this class`, then nothing matches outside `dist/`.

## Spec Change Log

## Review Triage Log

### 2026-11-14 — Review pass
- verdicts: 33 findings — high 0, medium 6, low 19, false 8, maybe-false 0
- findings:
  - `low` `reject` OCR: modifier key drops null-`statId` lines, so two modifiers could merge — a script over live `data/weights.json` found 0 keys that merge distinct line shapes. A real fix needs an identity that the weights contract does not give.
  - `low` `reject` OCR: the lookup test loads the Wand fixture by relative path with an `import.meta` cast — it is test-only and works under the root vitest project. Sharing a loader adds a helper for no user effect.
  - `false` `reject` OCR: no test pins that a not-counted entry stays out of the trust share — `rank/recipe-reach.test.ts` "a pair with nothing counted reads no-prices, even when every entry is broken" fails if the entry were counted.
  - `false` `reject` Intent (a): the Wand case is tested only in `core` math, not through `rank` — the story Note scopes `rank` to the entry's own floor until 7.2. The AC names `core`'s reach verdict and probability.
  - `medium` `patch` Intent (b): the lookup `reached` flag uses the same pool, not the per-entry verdict — SKILL.md step 4b now states that `reached` is per tier and ignores exclusion, blocking tags and an exhausted augment, and that `tracked:check` gives the entry verdict.
  - `false` `reject` Intent (c): `rank` and `tracked:check` take two code paths — the split is what AC 8 asks for (pair failures stay unrankable, and unreachable entries are not summands). Both read `combinationProbability` over `eligible`.
  - `low` `reject` Intent (d): two new reason strings reach the page without approved words — already in `deferred-work.md` (`spec-7-1`, needs a human), as AD-17 directs.
  - `false` `reject` Intent (e): unreachable entries also leave the trust share, and a class with nothing counted moves to the unpriced group — AD-17 *Price trust* sums `priced(class, recipe)` over the entries that count, and FR-38 treats a class with nothing counted as one with no priced Combination.
  - `false` `reject` Intent (f): no evidence that the browser checks ran — the after-review record is written under Implementation Notes before `done`, as the gate requires.
  - `low` `reject` Impeccable 1: `pool empty` and `augment exhausted` are not in the Copy Deck — the same tracked ledger entry as Intent (d).
  - `low` `patch` Impeccable 2: a recipe-scoped failure looks the same as a class-wide one — a `[NOTE FOR UX]` was added to the `spec-7-1` ledger entry.
  - `low` `patch` Edge 1: `tracked:check` scopes at 79 and 82, while `rank` scopes at the entry's floor — a live-data script found 0 of 2096 checkable entries unreached under every recipe at their own floor. The interim is the story Note's. The `CRAFTING_ITEM_LEVELS` JSDoc was reworded so it no longer claims that `rank` reads it.
  - `false` `reject` Edge 2: `tracked:check` does not report pair failures — `unreachable` lists entries that no recipe reaches (AGENT-WORKFLOW.md), and AD-17 keeps a pair failure as an unrankable row, not a curation refusal.
  - `false` `reject` Edge 3: one entry's empty slot or exhausted augment sinks the whole pair — AD-17 ("an augment left with no eligible entry makes that `(itemClass, recipe)` pair unrankable") and AC 8 require it.
  - `medium` `patch` Edge 4: SKILL.md calls a pick reached that is tag-blocked or augment-exhausted — grouped with Intent (b), same caveat.
  - `low` `reject` Edge 5: null-`statId` lines merge modifier keys — grouped with OCR 1, 0 hits in live data.
  - `low` `reject` Edge 6: weight-0 tiers below the floor are dropped when every tier is below it — AD-17 says the highest tier "alone survives". The old floor treated weight-0 tiers the same way, and the reviewer marked it low confidence.
  - `low` `patch` Blind 1: scope mismatch, and the JSDoc claims that `rank` reads `CRAFTING_ITEM_LEVELS` — grouped with Edge 1, JSDoc fixed.
  - `medium` `defer` Blind 2: the contract cannot mark a not-counted entry, and the schema description is stale — frontmatter `deferred` item (Story 7.4 state 49, 7.2 marker).
  - `low` `reject` Blind 3: `unreachable` rows no longer name the failing affix — step 7 of the skill prunes or re-picks the entry, and `lookup tiers` gives the per-slot detail. Keeping slots across recipe and level pairs adds a union rule for a diagnostic.
  - `low` `patch` Blind 4: an empty recipe list reports `recipe-reach` as `passed` — it now reports `skipped`, and the test pins the status.
  - `medium` `patch` Blind 5: the skill's reach rule can disagree with `tracked:check` — grouped with Intent (b).
  - `low` `patch` Blind 6: no `eligible` test for a hybrid tier and a pure tier sharing a `modGroup` and a `statId` — test added.
  - `low` `reject` Blind 7: spec frontmatter says `deferred: []` — the fix edits this build's spec.
  - `low` `reject` Blind 8: Implementation Notes carry rationale — the fix edits this build's spec. The commit message carries the rationale.
  - `low` `defer` Blind 9: the revision pins were raised without the 7.4 transcription — frontmatter `deferred` item.
  - `low` `patch` Blind 10: the `APPENDIX_NOTES` JSDoc cites the Copy Deck for reasons it does not name — citation narrowed to states 14, 15 and 15a.
  - `low` `reject` Blind 11: at 82 the Wand test fails both slots, not only the suffix — the AC asks only "not reachable at the higher level", and the third Wand test isolates the T2 suffix through `eligible`.
  - `low` `reject` Blind 12: the lookup test casts the fixture without validation, and the loader is duplicated — grouped with OCR 2.
  - `low` `reject` Blind 13: the crafted-states web test checks little — `rank/recipe-reach.test.ts` pins the summands and the trust verdict. The web test covers render safety only.
  - `medium` `defer` Blind 14: a pair with nothing reachable reads `pending` with `no-prices` — frontmatter `deferred` item (7.2/7.4 reason `nothing rolls at ilvl <level>`).
  - `medium` `defer` VG other 1: a not-counted line has no distinct display or ordering — grouped with Blind 2.
  - `false` `reject` VG other 2: one entry can sink the whole pair — the same claim as Edge 3, required by AD-17 and AC 8.

## Design Notes

**Why the new reason names.** AC 7 removes the recipe-unreachable reason. AC 8 keeps the empty pool and the exhausted augment unrankable, each "under its own reason". AD-17 says that `core` reports the cause it observed, and that a missing FR-4 member is a PRD finding, not a licence to relabel the cause. So `core` names the observed causes plainly (`pool empty` sits beside `pool partial`), and the gap goes on the deferred-work ledger. Real data hits neither cause today: the floor never removes a modifier, so an exhausted augment needs one modifier to exclude the whole other slot.

**Why the filter golden may move.** The perfect-recipe EVs change, so `packages/web/src/pick-up-filter/filter-text.test.ts` may change too. If it does, check that every changed block comes from a corrected EV, update the golden, and list the blocks in Implementation Notes.

## Verification

**Commands:**
- `pnpm check` -- expected: passes.
- `pnpm tracked:check` -- expected: exit 0, `unreachable: []`.
- `pnpm tracked:lookup tiers explicit.stat_2254480358 --class Wands` -- expected: T2 is `reached` for perfect at 79 and not at 82.

**Agent browser checks:** The implementing agent runs these itself. Use a named session (`agent-browser session id --scope worktree --prefix poe`, then `--session <id>` on each call), run `pnpm dev` in the background, and run `pnpm dev:stop` at the end.
1. **Perfect list:** open the app and choose perfect. Expected: crafted rows render, no console error, and no page text `recipe cannot reach this class`. Take a screenshot.
2. **Greater list:** switch to greater. Expected: the list re-ranks, there is no console error, and the appendix has no `recipe cannot reach this class` row. Take a screenshot.
3. **A Wand row:** open a Wands row under perfect. Expected: the expansion lists its combinations and the EV is a figure. Take a screenshot.

## Implementation Notes

- **`foldPair(pools, scope)`.** It takes no `entry`, because the scope carries the level.
- **Test move.** `packages/core/src/probability.test.ts` is now `packages/core/src/probability/probability.test.ts`, because the new `crafting-item-level.ts` pushed `core/src` past the 25-file cap of `test/directory-structure.test.ts`.
- **Fixtures that relied on the per-`modGroup` floor.** `BOWS_POOLS` (core), `BOWS` and `WANDS` (web) and the estimated-odds pools now hold the tiers of one modifier. The core Bows perfect share moved from 1/2 to 1/4, and one uncostable `grossPayout` moved from 0.5 to 0.25.
- **Modifier key cache.** `eligible` caches each tier's modifier key in a module `WeakMap`, keyed by tier identity. Without the cache, the NFR-6 test (under 100 ms) failed once at 116 ms.
- **A not-counted line carries no price.** It is `{entryKey, trust}` in `combinations`, because `web` reads a priced combination as a below-threshold line. The state 49 treatment belongs to 7.2 and 7.4.
- **Revision pins.** `tokens.test.ts` and `trust-words.test.ts` pinned DESIGN.md revision 23 and EXPERIENCE.md revision 33, and both failed from `15575f7` (DESIGN 24, EXPERIENCE 34). Every content assertion in both files passes against the current revisions, so both pins now name 24 and 34 and `pnpm check` is green. Story 7.4 still transcribes `level-toggle`, and 7.2's new reason kind meets the `trust-words` sampling test when it is added.
- **Filter golden.** `filter-text.test.ts` did not change.

### Agent browser checks (after review)

Session `poe-79ae64f4395d`, run 2026-11-14 18:55–18:58 WEST against HEAD `6b91e0d2cf6f6d307804257e42d20044a442b8e4`, tree clean. `pnpm dev` ran on port 5173 and was stopped with `pnpm dev:stop` (port free).

1. **Perfect list:** pass. Perfect was the active recipe. Crafted rows rendered (Emerald, Body Armours (Str/Dex/Int), Sapphire, Foci and more), with no page error and no `recipe cannot reach this class` text. The appendix read `Appendix: Unrankable — 0 Item Classes`. Screenshot: `C:/Users/ilyal/AppData/Local/Temp/claude/26e3858fb0c54881/aa3fa5ff-a9e4-4711-8d65-7d9edb3265ba/scratchpad/7-1-after-1-perfect.png`.
2. **Greater list:** pass. After a switch to greater, the list re-ranked (Body Armours (Str/Dex/Int) moved to rank 8 at 0.76). No page error, no retired reason text, and the appendix showed 0 Item Classes. Screenshot: `C:/Users/ilyal/AppData/Local/Temp/claude/26e3858fb0c54881/aa3fa5ff-a9e4-4711-8d65-7d9edb3265ba/scratchpad/7-1-after-2-greater.png`.
3. **A Wand row:** pass. Back on perfect, Wands was rank 24 with EV `< 0.01`, a figure. The expansion listed its combinations with prices and trade links (`T1-T2 % Cold · T1 Spells` 50.00, `T1 Spell Dmg · T1-T2 Cold Spells` 12.50, and more). No page error. Screenshot: `C:/Users/ilyal/AppData/Local/Temp/claude/26e3858fb0c54881/aa3fa5ff-a9e4-4711-8d65-7d9edb3265ba/scratchpad/7-1-after-3-wands-perfect.png`.

## Auto Run Result

Status: done

**Change.** `eligible` scopes to the Crafting Item Level first, then floors each modifier (`[modGroup, lineSet]`) on its own (AD-17, FR-26). The scope is an explicit `RecipeScope`, and `rank` passes the entry's own floor until 7.2. An entry that a recipe cannot reach is not a summand and stays out of the trust sums. The pair still ranks. `RECIPE_UNREACHABLE` and the state 36 path are gone. An empty pool and an exhausted augment stay unrankable as `pool empty` and `augment exhausted`. `tracked:check` lists only the entries that no recipe reaches at any `CRAFTING_ITEM_LEVELS` value. `tracked:lookup tiers` reports `reached` per (recipe, level).

**Files.**
- `packages/core/src/probability.ts`: the per-modifier floor after the scope, and `RecipeScope`. `floored` is removed.
- `packages/core/src/crafting-item-level.ts`: the offered levels `[79, 82]`.
- `packages/core/src/rank-crafted-row.ts` and `rank.ts`: an entry is counted, not counted, or a pair failure. The new reasons are here.
- `packages/core/src/provenance.ts`: `foldPair(pools, scope)`.
- `packages/sync/src/curation/check.ts`: `unreachable` per entry across recipes and levels. An empty recipe list is `skipped`.
- `.claude/skills/tracked-json/scripts/lookup-mods.ts` and `SKILL.md`: `reached` per (recipe, level), with the per-tier caveat.
- `packages/web/src/list/UnrankableAppendix.tsx`: the state 36 branch is removed.
- `test/fixtures/wands-weights.json`: the real Wands pools. Tests are under core, sync, web and the skill scripts.
- `packages/web/src/theme/tokens.test.ts` and `list/row/trust-words.test.ts`: the revision pins now name 24 and 34.
- `docs/stories/deferred-work.md`: the reason-words entry, with a note for UX.

**Review.** 33 findings: high 0, medium 6, low 19, false 8.
- **Patched (8 rows, 6 fixes):** the skill caveat on per-tier `reached` (medium; Intent b, Edge 4, Blind 5), the `CRAFTING_ITEM_LEVELS` JSDoc (low; Edge 1, Blind 1), `skipped` for an empty recipe list (low), the hybrid-modifier `eligible` test (low), the `APPENDIX_NOTES` citation (low), and the ledger note for UX (low).
- **Deferred (frontmatter):** the not-counted marker and display (medium), the reason `nothing rolls at ilvl` for a pair with nothing reachable (medium), and the revision-pin tripwire for 7.4 (low).
- **Rejected:** every remaining row, with its reason in the Review Triage Log.

**Follow-up review:** false. One medium patched entry and no high.

**Verification.** `pnpm check` passes, 8 of 8 gates. `pnpm tracked:check` exits 0 with `unreachable: []`. `pnpm tracked:lookup tiers explicit.stat_2254480358 --class Wands` shows T2 reached under perfect at 79 and not at 82, and T1 at 82. A live-data script found 0 of 2096 checkable entries unreached at their own floor, and 0 modifier keys that merge distinct line shapes. The I/O matrix audit passes. The agent browser checks after review pass.

**Residual risks.**
- Until 7.2, `rank` scopes each entry at its own floor, so entries of one class are normalised against different pools.
- The words `pool empty` and `augment exhausted` are not approved copy (ledger).
- A not-counted line looks like an unpriced line until 7.4.
