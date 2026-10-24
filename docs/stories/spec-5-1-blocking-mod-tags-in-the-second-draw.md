---
title: 'Story 5.1: Blocking mod tags in the second draw'
type: 'feature'
created: '2026-10-24'
status: 'done'
baseline_commit: 'fe9dd45779d826fd9ee34af8cdaa4a564bcb3eca'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-5-context.md'
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/WEIGHTS-FILE-SCHEMA.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On Wands and Staves an element damage prefix stops the other elements' spell-level and ailment suffixes from rolling, and the reverse. `core` reads weights contract `6.1.0`, which has no field for this, so the second draw counts blocked modifiers, and some tracked entries rank a combination the game cannot roll. The committed `data/weights.json` is already `7.0.0`, and the `6.1.0` reader refuses it, so every crafted Item Class on master is Unrankable now.

**Approach:** Implement `WEIGHTS-FILE-SCHEMA.md` `7.0.0` in `contracts`. Add the blocking-tag exclusion of AD-17 to the second draw. Add the *Co-rollable combination* cross-file check. Make a `P = 0` pair unreachable. Then delete the entries that the new check fails from `data/tracked.json`. Epic 5 Story 5.1 in `docs/epics.md` holds the acceptance criteria. This spec does not restate them.

## Boundaries & Constraints

**Always:**
- The owner documents decide: `WEIGHTS-FILE-SCHEMA.md` `7.0.0` (*7.0.0*, *The exclusivity rule*, *Field rules*, *Validation*), spine AD-11 and AD-17 (draw model, cross-file table row *Co-rollable combination*, reach rule), FR-1, FR-4 and FR-15. Where this spec and those documents differ, the documents win.
- One exclusion predicate in `core` decides "the second draw excludes this entry": a shared `modGroup`, or `blockedByTags` meets the first affix's `addsTags`. `orderedTerm` and the co-rollable check both call it.
- `core` reads `addsTags` and `blockedByTags` for that predicate only.
- A class where no tag crosses the slots gives exactly the probability it gave before. This is exact equality, not a tolerance.
- A co-rollable failure is a `CrossFileFailure`, so it reaches all three shells through `crossFileChecks` and needs no shell code.
- The co-rollable check reads the containment sets under the item-level scope (`scopedPools`). The recipe floor can still leave a pair with `P = 0`. The reach verdict catches that pair.
- The deletion list comes from a run of `pnpm tracked:check` before the edit. The edit follows the `tracked-json` skill, including floor re-derivation for the other entries of each affected class.
- **Decision (human, 2026-10-24).** The 7.0.0 file moves two stat families to new trade stat ids, so their tracked references fail empty containment. Re-key them in this story and do not delete them: the Rings "+# to all Attributes" suffix and the Body Armour Spirit references move to the stat ids that `data/weights.json` uses for the same text. Use the `tracked-json` skill, with bands aligned to the new tiers. Every affected entry reads `no-listings`, so no price history is lost. Remove the two 2026-10-18 `deferred-work.md` entries (the Spirit stat id, and the deletion of the Rings all-attributes entries) in the last commit of this branch. That commit names this decision: the Rings mod exists on rings under a different stat id.

**Never:**
- Do not parse `sourceModifierId`. Do not hard-code tag names or families in `core`.
- Do not use `P = 0` as a ranking input for a blocked combination.
- Do not prune the failed entries. Do not copy a fixed list or count of them.
- Do not edit `data/weights.json`, `dataset.json`, `sync-report.json` or `sync-progress.json`.
- Do not edit an owner document (PRD, `EXPERIENCE.md`, spine, `WEIGHTS-FILE-SCHEMA.md`).
- Make no production `web` change.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| `6.x` file | `schemaVersion: "6.1.0"` | Refused as `unknown-major` | Hard error |
| Tag hard error | missing `addsTags`, element `fire`, or a duplicate tag | File refused | Hard error |
| Wand cold first | First affix `increased Cold Damage` | Suffix second draw omits 4 other-element level families, Flammability, Shock; keeps Freeze Buildup, Cold level | N/A |
| Reverse order | First affix `+Level of all Fire Spell Skills` | Prefix second draw omits the non-fire damage prefixes | N/A |
| No crossing tag | Focus and jewel pools with `addsTags` set, no `blockedByTags` met | `P` equals `P` of the same pools with both arrays empty | N/A |
| Never co-rollable | Prefix and suffix containment sets fully blocked in both orders | `co-rollable-combination` failure, never `P = 0` | Cross-file failure |
| One order open | Only one draw order blocked | Check passes and `P > 0` | N/A |
| `P = 0` under a recipe | Floor leaves only blocked pairs | `recipeReach` unreachable on both slots; ranking unrankable (`RECIPE_UNREACHABLE`) | `tracked:check` exits 1 |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/weights-file.ts` -- `WEIGHTS_SCHEMA_VERSION` `'6.1.0'` (l.14); `ModifierWeightSchema` (l.34) is a `looseObject`, so the two fields must be declared to be required.
- `packages/contracts/src/sync-run-report.ts:131-141` -- `CrossFileCheckSchema` enum; `SYNC_REPORT_SCHEMA_VERSION` `'1.2.0'` (l.51), whose comment shows that an enum member gets a minor bump.
- `packages/core/src/probability.ts` -- `exclusionSums` (l.214) caches by `modGroup` only; `orderedTerm` (l.233); `recipeReach` (l.155) treats every `ok` result as reached.
- `packages/core/src/cross-file.ts` -- `checkClass` (l.311) is the place for an entry-level, two-slot check (`REF_CHECKS` is per slot); `scopeCache`/`scopedPools` give the scope; re-exports at l.32-34; "six checks" comments at l.36 and l.334.
- `packages/core/src/cross-file/{empty-containment,edge-alignment}.ts`, `reference-text.ts` -- the module and detail-text pattern to copy (`formatReference`, `tierIds`).
- `packages/core/src/rank-crafted-row.ts:62` -- `scanSummands` returns `undefined` on a non-ok probability. This is the backstop.
- `packages/core/src/index.ts:34-61` -- the public exports.
- Shells, no change expected: `packages/web/src/App.tsx:87`, `packages/web/src/frame/panel-columns.ts:39` (prints `check` word for word), `packages/sync/src/chunk/cross-file-gate.ts` (record from failure), `packages/sync/src/curation/check.ts` (`crossFileOutcome`, `unreachableOf`).
- Comments that count six checks: `packages/core/src/index.ts:34`, `sync-run-report.ts:131`, `packages/sync/src/chunk/cross-file-gate.ts:1`.
- Weights builders that need the two fields: `core/src/probability/test-support.ts:17` `tier` (wrapped by `cross-file/test-support.ts:20`), `core/src/coverage.test.ts:7`, `core/src/provenance.test.ts:6`, `core/src/rank/test-support.ts:34,58,166`, `core/src/probability/hybrid-reference.test.ts:185`, `contracts/src/weights-file.test.ts:13`, `sync/src/catalogue/weights-ids.test.ts`, `sync/src/chunk/run-chunk/cross-file-gate.test.ts:43,56`, `sync/src/chunk/run-chunk/unresolvable-ids/weights-file.test.ts:23,48`, `sync/src/curation/check.test.ts:25,53`, `sync/src/pricing/price-entry.summed.test.ts:151`, `web/src/App/raw-ranks-note.test.tsx:27`, `web/src/App/unrankable-appendix.test.tsx:31`, `web/src/recipe/craft-recipe/test-support.tsx:44,57`, `web/src/load/load-artifacts.test.ts:36`, `web/src/test-support/artifact-server.ts:45`, `.claude/skills/tracked-json/scripts/lookup.test-support.ts:6,39,104`.
- `test/fixtures/frozen-data/weights.json` -- `6.1.0`. Read by `contracts/src/weights-file.test.ts:60`, `core/src/cross-file/scope-and-marks.test.ts:137`, `core/src/probability/combination.test.ts:96`, `core/src/rank/crafted-branch.test.ts:286`. `README.md` beside it describes it.
- `packages/sync/src/curation/check.data.test.ts` -- `pnpm test:data` over the live `data/`.
- `.claude/skills/tracked-json/SKILL.md` *Changing or removing an entry* -- the prune rule that this story's deletion overrides once.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/weights-file.ts` -- `7.0.0`; required `addsTags` and `blockedByTags` (`^no_[a-z0-9_]+$`, no duplicates within an array, with a message for each hard error) -- schema *7.0.0*, *Validation*.
- [x] `packages/contracts/src/sync-run-report.ts` -- add `co-rollable-combination` to `CrossFileCheckSchema`; bump the report to `1.3.0` with a comment on what it adds; reword the count comment.
- [x] `packages/core/src/probability.ts` -- export the exclusion predicate and a second-draw function (the other slot's eligible set minus what the first affix excludes); key the `exclusionSums` cache by everything the predicate reads from the first affix; `recipeReach` returns `{ reached: false, slots: ['prefix', 'suffix'] }` for an `ok` result with `p === 0` -- AD-17 draw model and reach rule.
- [x] `packages/core/src/cross-file/co-rollable.ts` -- new: the *Co-rollable combination* check over both slots' containment sets under the scope. It returns `undefined` when either set is empty (empty containment owns that case). The detail names both references, the floor and one blocked example pair with its reason.
- [x] `packages/core/src/cross-file.ts` and `packages/core/src/index.ts` -- run the check in `checkClass` for pool-checkable classes; re-export it; remove the check counts from the comments.
- [x] `packages/core/src/rank-crafted-row.ts` -- treat `p === 0` like a non-ok probability (the backstop).
- [x] `packages/sync/src/chunk/cross-file-gate.ts` -- drop the check count from the header comment.
- [x] Test builders and literals in the Code Map -- default both arrays to `[]`, allow overrides in the `core` builders, and move each `6.x` literal to `7.0.0`. A test that asserts the `6.x` refusal keeps a `6.x` literal.
- [x] `test/fixtures/frozen-data/weights.json` and its `README.md` -- set `schemaVersion` to `7.0.0` and add empty `addsTags` and `blockedByTags` to every entry; the README states this one change to the snapshot.
- [x] Tests -- schema: each tag hard error, and the `6.1.0` refusal; `core`: every matrix row, with a Wand fixture built from the research doc's family table (both draw orders) and a Focus and a jewel fixture for exact equality; cross-file: a `co-rollable-combination` failure, and a pass when one order is open; `sync`: the gate records a co-rollable failure in the report and aborts; `check.test.ts`: the failure exits non-zero, and a `P = 0` pair is listed under `unreachable`; `web`: `unrankable-appendix.test.tsx` shows the class Unrankable with the cross-file reason and the co-rollable diagnosis.
- [x] `data/tracked.json` -- run `pnpm tracked:check` and record its co-rollable failures in Implementation Notes. Delete those entries (the `tracked-json` skill loop, without the prune step). Re-derive the floor of each affected class. Re-run until exit 0.
- [x] `docs/stories/deferred-work.md` -- append a `[NOTE FOR PM]` and a `[NOTE FOR UX]`: FR-4 and `EXPERIENCE.md` states 15a and 27 still say "five" cross-file checks (Review brief rule 2).

**Acceptance Criteria:**
- Given Story 5.1 in `docs/epics.md`, when the story is done, then each of its criteria holds and a test or a recorded command run shows it.
- Given the data commit, when its message is read, then it names the deletion as an exception to the FR-15 prune tombstone and lists the source command.
- Given the live `data/`, when `pnpm test:data` runs, then it passes with no cross-file failure and `unreachable` empty.

## Design Notes

The matrix row "One order open" exists because the predicate is not symmetric. Tag blocking in one direction does not imply blocking in the other. Real game data is symmetric for the five `no_*` tags, but the contract does not promise it. A pair is co-rollable when at least one order admits it. That matches `combinationProbability`, which sums both orders.

The frozen fixture moves to `7.0.0` by a mechanical change (empty tag arrays). Empty arrays mean exactly the `6.1.0` semantics, so every frozen-data assertion keeps its value. A regenerated fixture would also need a new frozen `tracked.json`.

## Verification

**Commands:**
- `pnpm check` -- expected: green.
- `pnpm test:data` -- expected: green.
- `pnpm tracked:check` -- expected: exit 0, with `cross-file` and `recipe-reach` `passed`.

**Agent browser checks:** The implementing agent runs these steps itself, with the agent-browser skill and a named session (`agent-browser session id --scope worktree --prefix poe`, then `--session <id>` on every call). Start `pnpm dev` in the background and run `pnpm dev:stop` at the end. Write each result, with its screenshot path, in Implementation Notes. A failed check is a defect to fix.
- **Crafted classes rank again:** Load the page under each recipe in the header control. Expected: Wand, Staff and Focus rows are in the ranked list, and neither the appendix nor the sync report panel shows a cross-file failure.
- **No blocked pair in a Wand row:** Expand the top Wand row and the top Staff row. Expected: no listed combination pairs one element's damage prefix with another element's spell-level, Flammability or Shock suffix.
- **Health line:** Read the trust strip. Expected: no new problem count, and the weights file is not reported as refused.

## Implementation Notes

**`pnpm tracked:check` before the data edit** (live `data/`, `7.0.0` weights): exit 1. `cross-file` failed with 24 `co-rollable-combination` and 33 `empty-containment-set` issues; `recipe-reach` listed 162 unreachable pairs, every one on an entry with a cross-file issue. The 24 co-rollable failures, deleted from `data/tracked.json` (paths are pre-edit indices; keys from the command output):

  - `entries.580` `["crafted","weapon.wand","Wands",81,["explicit.stat_2231156303",90,119],["explicit.stat_1600707273",4,5]]`
  - `entries.577` `["crafted","weapon.wand","Wands",81,["explicit.stat_2231156303",90,119],["explicit.stat_2254480358",4,5]]`
  - `entries.576` `["crafted","weapon.wand","Wands",81,["explicit.stat_2231156303",90,119],["explicit.stat_4226189338",4,5]]`
  - `entries.578` `["crafted","weapon.wand","Wands",81,["explicit.stat_2231156303",90,119],["explicit.stat_591105508",4,5]]`
  - `entries.589` `["crafted","weapon.wand","Wands",81,["explicit.stat_2768835289",90,119],["explicit.stat_1545858329",4,5]]`
  - `entries.587` `["crafted","weapon.wand","Wands",81,["explicit.stat_2768835289",90,119],["explicit.stat_2254480358",4,5]]`
  - `entries.586` `["crafted","weapon.wand","Wands",81,["explicit.stat_2768835289",90,119],["explicit.stat_4226189338",4,5]]`
  - `entries.588` `["crafted","weapon.wand","Wands",81,["explicit.stat_2768835289",90,119],["explicit.stat_591105508",4,5]]`
  - `entries.697` `["crafted","weapon.staff","Staves",81,["explicit.stat_3291658075",209,238],["explicit.stat_1545858329",7,7]]`
  - `entries.698` `["crafted","weapon.staff","Staves",81,["explicit.stat_3291658075",209,238],["explicit.stat_1600707273",7,7]]`
  - `entries.694` `["crafted","weapon.staff","Staves",81,["explicit.stat_3291658075",209,238],["explicit.stat_4226189338",7,7]]`
  - `entries.696` `["crafted","weapon.staff","Staves",81,["explicit.stat_3291658075",209,238],["explicit.stat_591105508",7,7]]`
  - `entries.559` `["crafted","weapon.wand","Wands",81,["explicit.stat_3291658075",90,119],["explicit.stat_1545858329",4,5]]`
  - `entries.560` `["crafted","weapon.wand","Wands",81,["explicit.stat_3291658075",90,119],["explicit.stat_1600707273",4,5]]`
  - `entries.556` `["crafted","weapon.wand","Wands",81,["explicit.stat_3291658075",90,119],["explicit.stat_4226189338",4,5]]`
  - `entries.558` `["crafted","weapon.wand","Wands",81,["explicit.stat_3291658075",90,119],["explicit.stat_591105508",4,5]]`
  - `entries.569` `["crafted","weapon.wand","Wands",81,["explicit.stat_3962278098",90,119],["explicit.stat_1545858329",4,5]]`
  - `entries.570` `["crafted","weapon.wand","Wands",81,["explicit.stat_3962278098",90,119],["explicit.stat_1600707273",4,5]]`
  - `entries.567` `["crafted","weapon.wand","Wands",81,["explicit.stat_3962278098",90,119],["explicit.stat_2254480358",4,5]]`
  - `entries.566` `["crafted","weapon.wand","Wands",81,["explicit.stat_3962278098",90,119],["explicit.stat_4226189338",4,5]]`
  - `entries.549` `["crafted","weapon.wand","Wands",81,["explicit.stat_736967255",90,119],["explicit.stat_1545858329",4,5]]`
  - `entries.550` `["crafted","weapon.wand","Wands",81,["explicit.stat_736967255",90,119],["explicit.stat_1600707273",4,5]]`
  - `entries.547` `["crafted","weapon.wand","Wands",81,["explicit.stat_736967255",90,119],["explicit.stat_2254480358",4,5]]`
  - `entries.548` `["crafted","weapon.wand","Wands",81,["explicit.stat_736967255",90,119],["explicit.stat_591105508",4,5]]`

**Floor re-derivation.** Wands (80 entries left) and Staves (56 left) keep the same set of distinct references as before the deletion (checked by script against `HEAD`), so the class floor, the highest `needs` over that set, stays `81` on both. No floor changed.

**`pnpm tracked:check` after the deletion:** exit 1. No `co-rollable-combination` issue remained. 33 `empty-containment-set` issues and their 66 unreachable pairs remained, on two families the `7.0.0` file moves to new trade stat ids (the human decision in *Always*).

**Re-keyed entries (the decision in *Always*).** 33 references changed `statId` only. Band, `acceptedTier` and floor are unchanged. `pnpm tracked:lookup tiers` shows the new stat's T1 edges equal to the old band. The stat sits in one `modGroup` and one slot on each class, so there is no same-`statId` collision. Each new T1 is reached under `greater` and `perfect`.
- Rings suffix, 7 entries: `explicit.stat_2897413282` → `explicit.stat_1379411836` ("# to all Attributes"), band `[11, 13]` T1 (`AllAttributes`, ilvl 33). Reference `needs` 33. Class floor stays 82, set by suffix `explicit.stat_4220027924` `[36, 45]`.
- Body Armour prefix, 26 entries: `explicit.stat_2704225257` → `explicit.stat_3981240776` ("# to Spirit"), band `[57, 61]` T1 (`BaseSpirit`, ilvl 78). Reference `needs` 78. Classes and entry counts: `Body_Armours_dex` 3, `_dex_int` 4, `_int` 3, `_str` 3, `_str_dex` 4, `_str_dex_int` 5, `_str_int` 4. Each class floor stays 82, set by suffix `explicit.stat_3372524247` `[41, 45]`.
- Floors: derived with `needs` from `packages/core/src/probability.ts` over every crafted entry of each of the 8 classes; the derived floor equals the declared 82 on all of them.
- `deferred-work.md`: the two 2026-10-18 entries (Spirit stat id; deleting the Rings all-attributes entries) are removed. The Rings mod exists on rings, under a different stat id.

**Command results after the re-key:**
- `pnpm tracked:check`: exit 0. All five checks passed, including `cross-file` and `recipe-reach`. 0 issues, 0 unvalidated, 0 unreachable.
- `pnpm test:data`: exit 0 (3 files, 7 tests).
- `pnpm check`: exit 0. All 8 steps passed: dup, depcruise, knip, typecheck, lint, build, test:data, test.

**Agent browser checks after the re-key** (session `poe-79ae64f4395d`; screenshots in the session scratchpad `C:\Users\ilyal\AppData\Local\Temp\claude\E--Program-Files-Jetbrains-Projects-poe-crafting-base-price-checker\3661b789-2e9b-4b03-8e9a-0b2f109f5723\scratchpad\`):
- Crafted classes rank again: PASS. Under `greater` and `perfect`, Wands, Staves and Foci are ranked, and so are Rings and all seven Body Armour classes (41 rows in all). The appendix reads `Unrankable — 0 Item Classes`, and the sync report panel lists 0 problem lines. Screenshots `final-greater-full.png`, `final-perfect-full.png`, `final-report.png`.
- No blocked pair in a Wand row: PASS. All 80 Wands and 56 Staves combinations were expanded under both recipes. A script found no element damage prefix paired with another element's spell-level, Flammability or Shock suffix. Screenshots `final-greater-expanded.png`, `final-perfect-expanded.png`.
- Health line: PASS. The trust strip shows `Synced 5d ago` with no problem count, and nothing reports the weights file as refused.

**PM and UX notes overtaken.** The task to append a `[NOTE FOR PM]` and a `[NOTE FOR UX]` was done, and then overtaken. A separate subagent of the player's session edited PRD FR-4 and `EXPERIENCE.md` (15a, 27 and the appendix copy row) to cite AD-17 in place of the count, and removed both notes. Commit `38746be` holds that edit. This story's code did not touch those owner documents.

**Shared working tree.** Another session builds `spec-track-all-elemental-resistances.md` in this checkout and edits `data/tracked.json`. On the player's instruction, `13cefdb` and `38746be` commit everything except `data/tracked.json`. The review diff took this story's `data/tracked.json` change from `HEAD` plus the 24 deletions and the 33 re-keys (1,728 entries), and excluded the other session's 302 additions. The data commit must stage only this story's hunks.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence / route |
|---|---|---|---|---|
| 1 | blind, edge, verif | `exclusionSums` cache key `join('\0')` is not injective, and it depends on order | low | No poe2db `modGroup` contains `\0`, and an unsorted tag list only misses the cache, so results stay correct. The fix is a direct correction (a structured key). Patch |
| 2 | blind, verif | `load-artifacts.test.ts:35` title still says major 6 | low | The title reads "major 6" while the test asserts `7.0.0`. Patch |
| 3 | blind | No test exercises the non-string tag message | low | `tagListSchema`'s non-string message has no case. One table row fixes it. Patch |
| 4 | blind, edge, verif | `deferred-work.md` drops the "Track all three elemental resistances" and jewel Craft Cost entries | medium | Real, but not caused by this story. The resistance removal is the other session's uncommitted edit. The jewel removal came from another session and was committed in `38746be` on the player's "commit everything" instruction. Out of this story; reported to the player |
| 5 | blind | The Spirit and Rings ledger removals land before the data commit | low | `38746be` is not the last commit of the branch. The fix means rewriting history before push. Reject; the data commit follows on the same branch |
| 6 | blind, edge, verif | The PM/UX task is ticked, but `deferred-work.md` has no notes, and owner docs were edited | false | The notes were added, then overtaken by the player's separate subagent (see Implementation Notes). This story's diff makes no owner-document edit. The fix would edit this spec. Reject |
| 7 | blind | *Never* "no fixed list" contradicts the listed keys in Implementation Notes | false | The rule covers the source of the deletion list. The notes record that command's output, as the task asks. Reject |
| 8 | blind | The data AC cannot be checked: `tracked.json` is not committed | low | True for now, because of the shared tree. The data commit with the FR-15 message is still owed before acceptance. Not a code defect |
| 9 | blind | Spec `in-review` vs sprint-status `in-progress` | false | The workflow moves the story key to `review` at step 05, after review. Reject |
| 10 | blind | No shell-level test uses a `6.1.0` file | low | The major check lives in `contracts` (`parseEnvelope`) and is tested there with `6.1.0`. The shells reuse it. Reject |
| 11 | blind | The Focus/jewel equality fixtures set no `blockedByTags` | low | In the live `7.0.0` file, Foci and every jewel class carry `addsTags` and 0 `blockedByTags`, so the fixtures model the real case of the matrix row. The Wand tests catch a swapped predicate. Reject |
| 12 | blind | The reach verdict for a blocked pair gives no reason | false | The spec defines `{ reached: false, slots: ['prefix','suffix'] }`. The pair's reason is the co-rollable failure, under the scope. Reject |
| 13 | blind | `coRollable` name and barrel export | false | It matches its siblings `emptyContainment` and `edgeAlignment`, which return the detail or `undefined` and are exported from the barrel. Reject |
| 14 | blind | Records under the old keys stay in `dataset.json` | false | `publish-dataset.ts` rebuilds one dataset entry per tracked entry, so the next sync drops old keys. All 57 affected keys read `no-listings`. Reject |
| 15 | blind | `epic-5-context.md` goes stale | low | A compiled cache, and 5.1 is the epic's only story. Reject |
| 16 | blind | Browser screenshots sit in a session scratchpad | false | The established record practice (spec 4.1) names scratchpad paths. Reject |
| 17 | blind | `cross-file-gate.test.ts` string `.replace` can silently no-op | low | A no-op fails the test, because it asserts the co-rollable record. Only the failure message would mislead. Reject |
| 18 | edge, verif | `augment-exhausted` reports `modGroup` when tags caused it | low | Diagnosis only. Its one consumer, `recipeReach`, reads `firstDrawSlot`. Reject |
| 19 | edge | Co-rollable passes while one order exhausts the other slot | false | AD-17 rules on that case: an exhausted augment makes the pair unrankable, and `recipeReach` reports it. The co-rollable predicate is pairwise by the spine's row. Reject |
| 20 | edge | Reach slots differ between the exhausted and filler cases | low | The slot attribution of `augment-exhausted` predates this story. Reject |
| 21 | edge | The Intent omits the 33 re-keys | false | The frozen *Always* holds the human decision that covers them. Reject |

## Implementation Notes (after review)

**Review patches** (triage rows 1 to 3): `exclusionSums` keys its cache by `JSON.stringify([first.modGroup, first.addsTags])`. The `load-artifacts.test.ts` title says major 7. `weights-file.test.ts` has a non-string tag case per field. `pnpm check` ran after the patches with all 8 steps passing, `test:data` included.

### Agent browser checks (after review)

Session `poe-79ae64f4395d`. Run from 14:28:11 to 14:29:35 (local, 2026-10-24) against `git rev-parse HEAD` `38746be99c1f6a19396b35ca213131ec1e051e60`. The tree was dirty: the three review patches were uncommitted, and `data/tracked.json` held this story's edit plus the other session's 302 resistance siblings. `pnpm dev` ran on :5173 and `pnpm dev:stop` freed the port. Screenshots are in `C:\Users\ilyal\AppData\Local\Temp\claude\E--Program-Files-Jetbrains-Projects-poe-crafting-base-price-checker\3661b789-2e9b-4b03-8e9a-0b2f109f5723\scratchpad\`.
- **Crafted classes rank again: PASS.** Under `perfect` and `greater`, Staves, Wands, Foci, Rings and all seven Body Armour classes are ranked rows. The list has 41 rows, and the appendix reads `Unrankable — 0 Item Classes`. Screenshots: `after-review-perfect-full.png`, `after-review-greater-full.png`.
- **No blocked pair in a Wand row: PASS.** The Staves and Wands rows were expanded in full, 56 and 80 combinations, under both recipes. A script over the page text matched each element damage prefix (`% Fire|Cold|Lightning|Chaos`, `Spell Phys Dmg`) against the element spell-level, Flammability, Shock and Freeze suffixes, and found 0 blocked pairs under each recipe. Screenshots: `after-review-greater-expanded.png`, `after-review-perfect-expanded.png`.
- **Health line: PASS.** The sync button reads `Synced 5d ago` with no count. The report panel's Problems column is empty, and *Built from* shows the `7.0.0` weights file (producer `poe-mod-weights-producer`, gamePatch `0.5.5.4.2`), pool coverage 100% of 39 tracked Item Classes. Screenshot: `after-review-report.png`.
