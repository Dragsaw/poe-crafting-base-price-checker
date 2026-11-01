---
title: 'Story 6.1: The purpose of each base, decided once in core'
type: 'feature'
created: '2026-11-01'
status: 'done'
baseline_commit: '3b39d79f0342764a477e58fab22e786bf52ced75'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-6-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Pick-up Filter (Epic 6) needs each base worth picking up to carry exactly one purpose: craft, sell raw or check the rolls. Nothing in `core` decides that today, and AD-31 forbids deciding it anywhere else.

**Approach:** Add one pure `core` function over the read-time `Ranking`, the Tracked List and the active Craft Recipe id. It returns the purpose entries that FR-36 names. Epic 6 Story 6.1 in `docs/epics.md` holds the acceptance criteria. This spec does not restate them.

## Boundaries & Constraints

**Always:**
- The owner documents decide: FR-35, FR-36 (`prd.md` §4.11), AD-31, and the spine Consistency Conventions *Ids* and *Entity keys*. Where this spec and those documents differ, the documents win.
- EV(C) is the `ev` of the crafted row in `ranking.ordering` whose `classKey` is the class and whose `recipeId` is the active recipe id. A class has no EV when no such row exists, when `ev` is `null` (uncostable, state 35), when its row is only in `unpricedCrafted` (FR-9), when it is Unrankable (FR-4), or when the recipe id is `undefined` (state 43).
- raw value(B) is the ranking's own FR-3 truncation: the observed price of a raw row in `ordering`, `0` for a raw row in `belowThreshold`, and no price for an entry in `noListings`, `notYetSynced` or `unresolvable`. A raw entry that is in no group has no price.
- The Raw Bases are the non-pruned raw entries of the Tracked List. Each is looked up in the ranking by `canonicalKey`. Its Item Class C is `classKeyOf(entry.categoryId, entry.className)` of that raw entry.
- The jewel kinds are the crafted rows in `ordering` with `isJewelCategory(categoryId)`, the active `recipeId` and `ev > 0`. The entry's floor is `row.itemLevelMin`, and its `baseTypeId` is `plainClassBaseTypeOf(row.className)`.
- `plainClassBaseTypeOf` in `contracts` is the one derivation of the jewel arm (`_` written as a space). `sync`'s `discriminatorOf` calls it, so `sync` keeps the same behaviour.
- Output order: canonical key by `compareCanonicalKeys` (the raw entry's key, or the jewel class's `classKeyOf`), then `normal` before `magic`.

**Never:**
- Do not re-rank, re-cost or re-price. Do not compare a price with the threshold a second time.
- No entry carries a Combination, a modifier, a price, an EV or a trust verdict.
- No filter text, no treatment and no `web` production change. Story 6.2 writes the text and story 6.3 adds the UI.
- Do not edit an owner document (PRD, spine, `EXPERIENCE.md`, `DESIGN.md`, `epics.md`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Craft | EV(C)=2, B priced 1 (≥ threshold) | white craft at max(B floor, class floor); magic check-rolls, tier ≥ 4, same floor | N/A |
| Equal | EV(C)=2, B priced 2 | white sell-raw at B floor; magic check-rolls | N/A |
| Raw wins | EV(C)=2, B priced 3 | white sell-raw at B floor; magic check-rolls | N/A |
| Below threshold | EV(C)=2, B in `belowThreshold` | white craft (raw value 0) | N/A |
| Unpriced B | EV(C)=2, B in `noListings` | white craft; magic check-rolls; no sell-raw | N/A |
| No EV: Unrankable | class in `unrankable`; B priced 3 | white sell-raw only | N/A |
| No EV: unpriced | class row only in `unpricedCrafted`; B priced 3 | white sell-raw only | N/A |
| No EV: uncostable | class row with `ev: null`; B priced 3 | white sell-raw only | N/A |
| No EV: no recipe | `recipeId` undefined; B priced 3 | white sell-raw only | N/A |
| No EV, raw value 0 | any no-EV cause; B in `belowThreshold` | no entry | N/A |
| No EV, unpriced B | any no-EV cause; B in `notYetSynced` | no entry | N/A |
| EV ≤ 0 | EV(C)=0 or below; B priced 3 | white sell-raw only; no craft, no check-rolls | N/A |
| EV ≤ 0, raw value 0 | EV(C) ≤ 0; B in `belowThreshold` or `noListings` | no entry | N/A |
| B in no group | raw entry in `tracked` that no ranking group lists; EV(C)=2 | treated as unpriced: white craft; magic check-rolls | N/A |
| Jewel kind | jewel class EV > 0 | one magic check-rolls entry, its derived `baseTypeId`, class floor, no tier, no white entry | N/A |
| Jewel, no EV | jewel class EV ≤ 0 or none | no entry | N/A |
| Pruned | pruned raw entry | no entry | N/A |
| Empty | no bases qualify | `[]` | N/A |

</frozen-after-approval>

## Code Map

- `packages/core/src/rank.ts:83-106` -- `Ranking`: `ordering` (raw rows ≥ threshold, crafted rows over every recipe, `ev` may be ≤ 0 or `null`), `unpricedCrafted`, `belowThreshold`, `noListings`, `notYetSynced`, `unresolvable`. `rankCraftedClass` (l.219) shows which crafted row lands where.
- `packages/core/src/rank-raw-groups.ts` -- how a raw entry lands in a group. Read-only reference.
- `packages/contracts/src/ranked-row.ts` -- `RawRankedRow.ev` is the observed price. `CraftedRankedRow.itemLevelMin` is the class's shared floor, and `classKey` is the class.
- `packages/core/src/crafted-classes.ts` -- reuse `classKeyOf`.
- `packages/core/src/craft-cost.ts:36` -- reuse `isJewelCategory`.
- `packages/contracts/src/canonical-key.ts:85` -- reuse `canonicalKey` and `compareCanonicalKeys`.
- `packages/contracts/src/class-name.ts` -- the `className` grammar module. Add the plain-class base type (`className` with `_` written as a space, `WEIGHTS-FILE-SCHEMA.md` `5.1.0` row 3).
- `packages/sync/src/pricing/search-body.ts:79-93` -- `discriminatorOf` arm 2 inlines `className.replaceAll('_', ' ')`. Replace it with the `contracts` function. Behaviour stays the same.
- `packages/core/src/rank/test-support.ts` -- `ranked`, `raw`, `crafted`, `published`, `priced`, `weightsWith`, `permute` for the integration and determinism tests.
- `packages/web/src/list/active-ranking.ts` -- `forRecipe` narrows by `recipeId` in the same way. Do not change it.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/class-name.ts` -- export `plainClassBaseTypeOf(className)`, update the module's header comment to cover both arms, and add a unit test in the contracts suite -- one derivation for `sync` and `core` (*Ids*)
- [x] `packages/contracts/src/index.ts` -- export `plainClassBaseTypeOf` next to `defenceLettersOf` (l.33) -- the barrel is the only import path
- [x] `packages/sync/src/pricing/search-body.ts` -- call it in `discriminatorOf` and keep the defence-letter check and the catalogue check that raises `UnknownClassBaseTypeError` -- no second copy, same behaviour
- [x] `packages/core/src/pick-up.ts` -- `pickUpPurposes(input: PickUpInput): readonly PickUpEntry[]`, with `PickUpInput = { ranking, tracked, recipeId: string | undefined }`, `PickUpEntry = { baseTypeId, rarity: 'normal' | 'magic', itemLevelMin, unidentifiedTierMin?: 4, purpose: PickUpPurpose }`, `PickUpPurpose = 'craft' | 'sell-raw' | 'check-rolls'` -- the one FR-36 evaluator (AD-31)
- [x] `packages/core/src/index.ts` -- export the function and its three types -- this is the package entry, so knip accepts them, and `web` imports them in 6.3
- [x] `packages/core/src/pick-up.test.ts` -- every I/O matrix row with literal `Ranking` inputs. Tests through `rank()`: one test runs the same tracked entries and dataset under two thresholds and shows B moving from sell-raw to craft (AC 1, the threshold through `rank`); one test shows a jewel class whose derived base type is not in the catalogue, so the class is `unresolvable` and has no entry. Also a determinism test with permuted tracked input, and a test that no entry has a key outside the five fields -- AC coverage

**Acceptance Criteria:**
- Given the Story 6.1 ACs in `docs/epics.md`, when the tests run, then each AC has at least one test that names it.
- Given the change, when `pnpm check` runs, then it passes, and no test makes a network call.

## Implementation Notes

**Paths moved by the directory caps.** `test/directory-structure.test.ts` caps the TypeScript files of each directory, and a cap only goes down. `packages/core/src` was at 25 and `packages/contracts/src` at 44. So the function and its tests are in `packages/core/src/pick-up/pick-up.ts` and `pick-up.test.ts`, and the `plainClassBaseTypeOf` cases are in the "the className grammar" block of `packages/contracts/src/weights-file.test.ts`.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Route | Evidence |
|---|-------|---------|---------|-------|----------|
| 1 | verification-gap + blind | AC 9 order test builds its expectation with the same `compareCanonicalKeys`, and no fixture key orders differently under locale comparison | low | patch | Pre-verified: swapping in `localeCompare` passes every test. Add a key pair that differs by case and pin a literal order. |
| 2 | blind | "a recipe id that names no row" passes `undefined`, which repeats the state-43 case | low | patch | `pick-up.test.ts` AC 5 block: the test name and its input disagree. Pass a defined id with no row. |
| 3 | blind | No test covers a `pinned` Raw Base | low | patch | `TrackedEntrySchema` status enum includes `pinned`; the helpers build only `active` and `pruned`. One case pins the non-pruned rule. |
| 4 | blind | `whitePurpose` JSDoc narrates the FR-36 predicate and omits the EV ≤ 0 branch | low | patch | The comment is incomplete against the code, and AGENTS.md says to cite the owner (FR-36), not restate it. |
| 5 | blind | Barrel identity assertion repeats in each `it.each` row | low | patch | `weights-file.test.ts`: one assertion is enough; direct correction. |
| 6 | edge-case + blind | Two raw entries with one `baseTypeId` and different floors give one drop two purposes | medium | defer | `checkUniqueKeys` keys on the canonical key, which includes `itemLevelMin`. FR-36 assumes one Raw Base per drop and gives no rule for the overlap. `data/tracked.json` has no such pair today (90 raw entries). The PM and architect own the rule. |
| 7 | edge-case + blind | A raw entry in the `jewel` category gets white and tier entries beside the jewel kind | low | reject | `data/tracked.json` has no raw jewel. Jewels never drop white (FR-36), and the fix adds a guard. |
| 8 | edge-case | A jewel `className` with an arm-1 suffix derives a base type that `sync` never searched | low | reject | No jewel class has a `_str`/`_dex`/`_int` suffix, and the fix adds a branch. |
| 9 | edge-case | Two crafted rows share a class and recipe id, so the last one wins | false | reject | `envelopes.ts:75` rejects a repeated recipe id, and `rank` emits one row per class per recipe. |
| 10 | edge-case | File paths differ from the spec's Tasks | false | reject | The fix would edit this spec. Implementation Notes already record the move. |
| 11 | edge-case | The jewel `unresolvable` test seeds the state by hand | false | reject | `core` cannot see the catalogue. `sync` marks the entry `unresolvable` (Design Notes), which is what the test seeds, and the asserted outcome (no entry) holds. |
| 12 | blind | No test for EV(C) between 0 and the threshold | false | reject | `PickUpInput` has no threshold, and `rank` keeps every crafted row in `ordering` regardless of it, so the function cannot apply it to EV. |
| 13 | blind | The determinism test permutes only `tracked` | false | reject | The output is sorted by a total order over distinct keys (unique canonical keys, one row per class and recipe), so ranking group order cannot change it. |
| 14 | blind | The `core/src/index.ts` comment repeats the function's JSDoc | false | reject | The barrel gives each export group a one-line comment (for example the clock spans). No rule or caller diverges. |
| 15 | blind | `PickUpEntry.baseTypeId` is `string`, not `BaseTypeId` | false | reject | `BaseTypeId` is `z.infer` of a `z.string()`, so it is the same type. Nothing diverges. |
| 16 | blind | `classFloor` is computed when no class value exists | false | reject | On that path it equals the raw floor, and only craft and check-rolls read it, which both need a class value. |

## Design Notes

**Inputs.** The AC lists the threshold as an input. The `Ranking` already carries it: `rank` sorted each raw row into `ordering` or `belowThreshold` by that threshold. A second threshold argument could disagree with the ranking. Then the filter would make a second judgement, which FR-35 forbids. So the function reads raw value(B) from the group, and the caller passes the threshold through `rank`.

**One white entry for each Raw Base.** FR-36 gives a white drop one purpose. A craft entry's floor is `max(raw floor, class floor)`. A white drop below the class floor but at or above the raw floor gets no entry when the purpose is craft. This is the literal rule. In `data/tracked.json` every raw floor is at or above its class floor.

**A jewel kind with EV > 0 has a catalogue-validated base type.** When `sync` finds no catalogue type for a derived name, it marks each entry of the class `unresolvable` before any request (`price-entry.ts:187-197`). Their trust is then broken, so the class has no EV and gets no entry. `core` cannot see the catalogue, so it uses `isJewelCategory`, which matches "today: jewel" in `WEIGHTS-FILE-SCHEMA.md` `5.1.0`.

**Raw classes with no crafted entry** (shields, bucklers, maces, tablets) have no EV, so the No EV row applies.

## Verification

**Commands:**
- `pnpm check` -- expected: exit 0

**Agent browser checks:** exempt. No `web` module imports the new function in this story, and the `sync` refactor gives the same output, so the page cannot change. Story 6.3 is the first story that renders it.
