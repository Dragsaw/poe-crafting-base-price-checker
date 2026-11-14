---
title: 'Story 7.2: Per-entry floors and the Crafting Item Level in core'
type: 'feature'
created: '2026-11-14'
status: 'done'
baseline_revision: 'f6f5fa1de035a5293dbacb5fc9d4ee75a1e6dd71'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/docs/stories/epic-7-context.md'
  - '{project-root}/docs/epics.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Every cross-file check but the mixed-floor `coOccur` pair runs at the entry's own floor, while `rank` now scopes each counted entry to the Crafting Item Level, so tiers between a floor and `L` are never checked.
    evidence: |-
      `referenceFailures` and the same-floor branch of `pairOverlap` in `packages/core/src/cross-file.ts` scope at `entry.itemLevelMin`, as AD-17 states. `scanSummands` scopes at `L`. Two same-floor hybrid entries at 75 that co-occur only on a tier at 80 would pass the gate and double-count at 82. A run of `crossFileChecks` on the committed data with every crafted floor raised to 79, and to 82, gave 0 failures, so no current entry is affected. Story 7.3 adds lower-floor T2 entries. AD-17 owns the scope rule; a note for the architect is on the ledger.
    location: >-
      packages/core/src/cross-file.ts:pairOverlap
    severity: medium
  - summary: >-
      The old-versus-new crafted EVs at level 82 for the six classes with floors below 82 were not measured.
    evidence: |-
      A comparison script was refused at the permission prompt in this run. The filter text for the committed data is byte-identical at 82, so no purpose changed, but the EV figures of Emerald, Sapphire, Wands, Staves, Talismans and Belts can still move under the one-pool-per-pair scope.
    location: >-
      packages/core/src/rank-crafted-row.ts:scanSummands
    severity: low
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

### 2026-11-14 — Review pass
- verdicts: 33 findings — high 0, medium 7, low 15, false 11, maybe-false 0
- findings:
  - `low` `patch` Ledger 1: the old-versus-new EV figures of the six low-floor classes were not measured — a comparison script was refused at the permission prompt twice. The measurement goes to `deferred-work.md` (spec-7-2) and the frontmatter `deferred` list. The AC gate (filter text byte-identical at 82) was met.
  - `low` `patch` Ledger 2: browser check 3 did not reach a download — the after-review browser checks re-run the list. Check 3 asks for the generated text in the modal, not a saved file.
  - `low` `reject` Intent 1: no shell-level test feeds a mixed-floor list — `tracked:check` and the sync gate call `TrackedFileSchema` and `crossFileChecks`, and both are tested with mixed floors.
  - `false` `reject` Intent 2: the Story 6.4 empty-range drop is removed — under the own-floor rule a Raw Base's range always starts at or below its `itemLevelMax`, because `itemLevelMax` is one below the next higher floor. The bounding is still tested.
  - `low` `patch` Intent 3: no pick-up test at `L` 79 — grouped with Blind 7. A test was added.
  - `low` `reject` Intent 4: the committed-data golden is an out-of-band script, and the synthetic golden moved for a pick-up cause — the AC limits changes for committed data, which were byte-identical. The synthetic block change is recorded in Implementation Notes with its FR-36 cause.
  - `low` `reject` Intent 5: no test pins that `App.tsx` ranks at 82 — the argument is required by type, and the constant cites `EXPERIENCE.md`. Story 7.4 replaces the constant with the toggle state and tests it there.
  - `false` `reject` Intent 6: the row's `itemLevelMin` changes meaning — the spec's Always rule and Design Notes ask for that.
  - `medium` `defer` Edge 1: a same-floor hybrid pair below `L` is checked only at its floor — the code follows AD-17, which keeps every check but the mixed-floor `coOccur` at the entry's own floor. Real data has 0 extra failures when every crafted floor is raised to 79 or 82 (a script run). Recorded as a note for the architect in `deferred-work.md`.
  - `medium` `defer` Edge 2: edge alignment and the per-entry checks run at the floor while the summand runs at `L` — the same AD-17 scope rule and the same 0-failure measurement. Grouped with Edge 1.
  - `low` `reject` Edge 3: a mixed-floor pair with a floor above 82 can fail spuriously — the committed data has 0 crafted floors above 82, and a guard adds a branch.
  - `low` `reject` Edge 4: a same-floor pair above 82 — grouped with Edge 3.
  - `false` `reject` Edge 5: a pair that overlaps only at 82 makes the class unrankable at 79 — AD-17 fixes the mixed-floor pair at the highest offered level so that one verdict holds at every level.
  - `low` `reject` Edge 6: `craftingItemLevel` outside the offered set at run time — the type admits only 79 and 82, and the only caller passes a constant. Story 7.4 reads stored values and owns their validation.
  - `low` `reject` Edge 7: the `lastAttemptedAt` fallback reads entries above `L` — AD-10 names the class's entries, and the fallback shows only when no summand exists. A filter adds a rule that no owner document states.
  - `false` `reject` Edge 8: `lowestFloorOf` returns `Infinity` on an empty list — both callers return before the call when `keyed` is empty (`first === undefined`).
  - `medium` `patch` VG 1: no test tells `lowestFloorOf` apart from `first.itemLevelMin` — tests with floors 9 and 75 were added for the crafted and recipeless rows.
  - `medium` `patch` VG 2: provenance scoped to `L` has no test — a 79-versus-82 provenance test was added.
  - `false` `reject` VG other: the `lowestFloorOf` doc is narrower than the code — it says "non-pruned crafted entries", which is what `keyed` holds, whatever `L` is.
  - `medium` `defer` Blind 1: same-floor pairs are checked less strictly than mixed ones — grouped with Edge 1.
  - `medium` `defer` Blind 2: edge alignment blind spot between the floor and `L` — grouped with Edge 1.
  - `low` `reject` Blind 3: nothing reports a crafted floor above 82 — the committed data has 0. The SKILL floor rule derives every floor from `needs`, and Story 7.3 regenerates the list from it.
  - `low` `patch` Blind 4: the `HIGHEST_CRAFTING_ITEM_LEVEL` JSDoc overstates the claim for a recipe floor — narrowed to the scope with no recipe floor. The inline repeat in `pairOverlap` was replaced by a citation.
  - `low` `reject` Blind 5: the NFR-3 test does not permute inputs — `rank/purity-and-budget.test.ts` permutes `tracked` and `dataset` already. `lowestFloorOf` is a numeric minimum, so it does not depend on order.
  - `medium` `patch` Blind 6: provenance has no test of the new behaviour — grouped with VG 2.
  - `low` `patch` Blind 7: pick-up at 79, a jewel kind with nothing counted, and recipeless floors are untested — tests added (grouped with Intent 3 and VG 1).
  - `false` `reject` Blind 8: a Raw Base at 75 gets a craft entry from an 82 EV — FR-36: a drop qualifies at its Raw Base's own floor, and the level changes only the EV behind the purpose.
  - `false` `reject` Blind 9: hand-edited test formatting — `pnpm check` lint passes on every file.
  - `false` `reject` Blind 10: import order — `pnpm check` lint passes, and the import-order rule is part of it.
  - `false` `reject` Blind 11: web hard-codes 82 — the first-visit level is an `EXPERIENCE.md` fact, not "the highest offered level". Tying it to `HIGHEST_CRAFTING_ITEM_LEVEL` would couple two independent rules.
  - `false` `reject` Blind 12: planning documents still describe a shared floor — `epics.md` Story 7.2 states that it supersedes those criteria, and the 6.x specs stay unedited as records. A reviewer does not edit an owner document (AGENT-WORKFLOW.md *Review brief*).
  - `low` `patch` Blind 13: the mixed-floor overlap test filters to `co-occur` — it now asserts the full failure set.
  - `false` `reject` Blind 14: `lowestFloorOf` has no guard — the same as Edge 8.

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

### Agent browser checks (after review)

Session `poe-79ae64f4395d`, run 2026-11-14 19:44–19:50 WEST against HEAD `bfd01e6cf12e09b3d6c9c88806fb62a8c814a596`. The tree was dirty only in `docs/` (this spec and `deferred-work.md`). `pnpm dev` ran on port 5173 and was stopped with `pnpm dev:stop` (port free).

1. **Perfect list:** pass. Crafted rows rendered with EV figures (Emerald 0.22, Body Armours (Str/Dex/Int) 0.10, Sapphire 0.05, Staves 0.02 and more), with no page error. The appendix read `Appendix: Unrankable — 0 Item Classes`. Screenshot: `C:/Users/ilyal/AppData/Local/Temp/claude/26e3858fb0c54881/20295f5c-5f1f-4a2b-97f1-8b260b2c6aa7/scratchpad/7-2-after-1-perfect.png`.
2. **Emerald row:** pass. The expansion listed eight combinations with trade links, `+ 230 more combinations` and `+ 14 pruned`, and the EV is 0.22. No page error. Screenshot: `C:/Users/ilyal/AppData/Local/Temp/claude/26e3858fb0c54881/20295f5c-5f1f-4a2b-97f1-8b260b2c6aa7/scratchpad/7-2-after-2-emerald.png`.
3. **Filter download:** pass. The modal opened with no error. agent-browser cancels a blob download, so the page's `URL.createObjectURL` was wrapped to read the blob before the anchor click. The generated text has 57 `Show` blocks and starts with Emerald and Sapphire magic at `ItemLevel >= 75`. It ends with `Import "base.filter"`. No page error. Screenshot: `C:/Users/ilyal/AppData/Local/Temp/claude/26e3858fb0c54881/20295f5c-5f1f-4a2b-97f1-8b260b2c6aa7/scratchpad/7-2-after-3-filter.png`.

## Auto Run Result

Status: done

**Change.** The crafted entries of one Item Class may now declare different floors. `contracts` no longer refuses them (`b5c74e9`, alone and green). `rank` takes a required `craftingItemLevel` (`CraftingItemLevel`, 79 or 82). Every counted crafted entry of each `(itemClass, recipe)` pair is scoped to that level. An entry above it is listed with no price, is not a summand and is out of the trust sums, and it never reaches the probability, so it cannot fail the pair. Provenance folds once at the level. A Raw Base ignores the level. `pairOverlap` checks a mixed-floor pair at the highest offered level and names it. Pick-up qualifies every drop at its Raw Base's own floor, and a jewel kind at the lowest crafted floor (the row's `itemLevelMin`, now that minimum). `web` passes `FIRST_VISIT_CRAFTING_ITEM_LEVEL` (82).

**Files.**
- `packages/contracts/src/envelopes/tracked-file-checks.ts`: the shared-floor check is removed. `ranked-row.ts`: the `itemLevelMin` description.
- `packages/core/src/crafting-item-level.ts`: `CraftingItemLevel` and `HIGHEST_CRAFTING_ITEM_LEVEL`.
- `packages/core/src/rank.ts` and `rank-crafted-row.ts`: the level input, the skip above `L`, provenance at `L` and `lowestFloorOf`.
- `packages/core/src/cross-file.ts`: `pairOverlap` for mixed floors.
- `packages/core/src/pick-up/pick-up.ts`: the own-floor rule.
- `packages/web/src/shared/product.ts`, `App.tsx` and `App/pick-up-filter-support.tsx`: the first-visit level.
- Tests: `rank/crafting-item-level.test.ts`, `cross-file/per-entry-floors.test.ts`, `pick-up-floors.test.ts`, `rank/recipeless.test.ts`, and the `rank` callers in `core` and `web`. The synthetic filter golden moves one block (Solar Amulet magic, 82 → 75, FR-36 own floor).
- `docs/stories/deferred-work.md`: two spec-7-2 entries.

**Review.** 33 findings: high 0, medium 7, low 15, false 11.
- **Patched (9 rows, 5 fixes, commit `bfd01e6`):** the lowest-floor tests with floors 9 and 75 (medium), provenance at 79 versus 82 (medium), pick-up and jewel kind at 79 (low), the narrowed `HIGHEST_CRAFTING_ITEM_LEVEL` JSDoc (low), and the full failure set in the mixed-floor overlap test (low). Ledger 2 was closed by the after-review download check.
- **Deferred (frontmatter and ledger):** the cross-file scope below `L` (medium, a note for the architect; 0 failures on the committed data), and the unmeasured EV changes for the six low-floor classes (low).
- **Rejected:** every remaining row, with its reason in the Review Triage Log.

**Follow-up review:** false. The two patched medium entries add tests only, and they pass. No unverified risk remains from the patches.

**Verification.**
- `pnpm check` passes, 8 of 8, after the patches.
- `pnpm tracked:check` exits 0 with `unreachable: []`.
- The filter text for the committed data at 82 is byte-identical to the baseline for greater and perfect. At 79 the text is shorter, because the classes whose entries all sit at 82 lose their craft blocks.
- `crossFileChecks` on the committed data with every crafted floor raised to 79 or 82 gives 0 failures.
- The I/O matrix audit passes.
- The agent browser checks after review pass.

**Residual risks.**
- AD-17 checks an entry at its own floor while `rank` sums it at `L`. No current entry is affected, but Story 7.3's lower-floor entries are (ledger).
- EV deltas for Emerald, Sapphire, Wands, Staves, Talismans and Belts were not measured (ledger).
- The not-counted marker and the `nothing rolls at ilvl` reason remain for 7.4 (spec-7-1 ledger entries).
