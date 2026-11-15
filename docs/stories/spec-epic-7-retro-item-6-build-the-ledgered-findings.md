---
title: 'Build the six epic 7 findings that item 6 ledgered'
type: 'bugfix'
created: '2026-11-15'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '00853dbb82ba982eb1ce38dddc2617a4a35ed150'
context:
  - '{project-root}/docs/stories/epic-7-retro-2026-11-15.md'
  - '{project-root}/docs/reviews/review-epic-7-diff.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Retro action item 6 ledgered six epic 7 findings in `deferred-work.md` (`9c58758`). The human ruled that none stays deferred (2026-11-15): ADV-2 and ECH-3 (edge alignment runs only at the floor, which Story 7.5 made unsafe), VG-1 (the floor term of `widestLevel` is untested), ADV-3 (a T2 sibling above 79 goes unreported), ADV-5 (a false `NO_CRAFTED_CONTEXT` comment) and B1 (the filter-modal lead does not name the level).

**Approach:** Build all six on this branch. In the last commit, remove the six entries under `## Deferred from: epic 7 retro (2026-11-15)`.

**Decision (human, 2026-11-15), ADV-2 + ECH-3:** edge alignment runs at the entry's floor and at every offered Crafting Item Level above it. The overlap rule does not change. AD-11 says outright that "below" means lower in value, whatever the two tiers' levels. AD-17 drops edge alignment from the group whose pass a wider pool cannot undo. Spine revision 51, with a `.memlog.md` `[USER]` entry. It names rev 48's rejection of every-level checks, which Story 7.5's own minimum overturned.

**Decision (human, 2026-11-15), B1:** the lead reads `…at your threshold of <threshold> div with <recipe> orbs at ilvl <level>. Your NeverSink filter handles everything else.` The state-43 lead (no recipe) does not change.

**Decision (agent):** ADV-5 corrects the comment and keeps the throw (7.4 triage #11). ADV-3 keeps every sibling in the output and adds the reference to `noT2` when every sibling sits above `LOW_LEVEL`.

## Boundaries & Constraints

**Always:** `data/tracked.json` does not change: `pnpm tracked:regenerate` is a fixed point, and `pnpm tracked:check` exits 0. Each comment states a non-obvious why in three lines or fewer. Use Serena for code edits.

**Never:** change the own-interval derivation, `empty-containment-set`, `co-rollable-combination`, or the widest-level checks. Never edit `prd.md`: no player promise changes. PRD line 503's "tier below" stays true under the value reading.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| ADV-2 counterexample | T1@60 [30,40], T2@75 [40,50], T3@82 [35,48]; band [40,50], floor 75 | `edge-alignment` failure naming item level 82; `rank` reports the entry unrankable at 79 and at 82 | the sync gate aborts on it, as on any cross-file failure |
| Fails at floor too | band [0,9999], floor 75 | one failure at the floor | stops at the lowest failing level |
| Floor above 82 | valueless entry, floor 90, banded tier at 86 | `kind-agreement` "at item level 90"; hybrid pair → `co-occur` "at item level 90" | none |
| ADV-3 | T1@83 reference, only sibling T2@81 | sibling kept; reference listed in `noT2` | none |
| ADV-3 mixed | siblings T2@75 and T2@81 | both kept; not in `noT2` | none |

</frozen-after-approval>

## Code Map

- `packages/core/src/cross-file.ts:161-171,224-240` -- `FLOOR_CHECKS`, `WIDEST_CHECKS`, `referenceFailures`. Move `edgeAlignment` into its own loop over `[floor, ...CRAFTING_ITEM_LEVELS.filter((l) => l > floor)]`. Use `scopeOf(level)`, which is already cached per level. Report the first level that fails. Fix the `FLOOR_CHECKS` JSDoc.
- `packages/core/src/cross-file/edge-alignment.ts:10,25` -- the parameter becomes `level`. The detail reads `at item level N`.
- `packages/core/src/crafting-item-level.ts:7` -- the JSDoc says the widest verdict holds for the widest-level checks only.
- `cross-file.ts` is 325 lines against `max-lines` 300 (blank and comment lines skipped). If the loop breaks the limit, put it in `edge-alignment.ts`. Run `find_referencing_symbols` on `edgeAlignment` (exported from `@poe/core`) before changing its detail. `crossFileChecks` runs once per load in `web` (`App.tsx:89`), not on each `rank` pass.
- `packages/core/src/cross-file/per-entry-floors.test.ts` -- the ADV-2 case. Change the edge test at about line 47 to the new wording and the at-every-level claim. Add the VG-1 cases (`entry(...)` takes `{ itemLevelMin }`; there are hybrid fixtures at about line 22).
- `packages/sync/src/curation/check.test.ts:169` -- `at floor 75` becomes `at item level 75`.
- `.claude/skills/tracked-json/scripts/regenerate-entries.ts:103-111` (`variantsOf`), its `noT2` JSDoc (`:16`), `regenerate.test.ts:~222` -- ADV-3.
- `packages/web/src/list/display-rows.ts:128` -- ADV-5 comment.
- `packages/web/src/pick-up-filter/filter-copy.ts:42-46` (`filterLead`), `PickUpFilter.tsx:34-44,203`, `frame/header-controls.tsx:105-111` (passes `input.level`) -- B1. Tests: `filter-copy.test.ts`, `App/pick-up-filter*.test.tsx`.
- `ARCHITECTURE-SPINE.md` -- AD-11 (about line 693), AD-17 scope paragraph (about lines 1295-1300), the checks-table edge row (about line 1259) if it names the scope, the frontmatter `revision: 51` and `updated`. `.memlog.md` -- append the `[USER]` decision. The rev 48 rejection story goes there and in the commit, not in the spine body. Precedent: rev 50 (`c0de91d`). Other spine mentions (lines 305, 738, 1055, 1259, 1313) do not state the scope and stay. `docs/stories/epic-7-context.md:26,38,40` -- the cached AD-11 and AD-17 facts follow the spine, as rev 50 did.
- `EXPERIENCE.md:486` -- Copy Deck lead. `mockups/key-filter-modal.html` -- the six lead lines gain ` at ilvl 82`.
- `docs/stories/deferred-work.md` -- remove the six epic 7 retro entries (last commit).

## Tasks & Acceptance

**Execution:**
- [x] spine, `.memlog.md`, `EXPERIENCE.md`, mockup -- the two rulings.
- [x] `cross-file.ts`, `edge-alignment.ts`, `crafting-item-level.ts`, and tests -- ADV-2 and VG-1.
- [x] `regenerate-entries.ts`, `regenerate.test.ts` -- ADV-3.
- [x] `display-rows.ts` -- ADV-5.
- [x] `filter-copy.ts`, `PickUpFilter.tsx`, `header-controls.tsx`, and tests -- B1.
- [x] `deferred-work.md` -- remove the six entries.

**Acceptance Criteria:**
- Given each row of the I/O matrix, when its test runs, then it passes. Given `widestLevel` cut to `HIGHEST_CRAFTING_ITEM_LEVEL`, then the VG-1 cases fail. Given edge alignment run at the floor only, then the ADV-2 case fails.
- Given the committed data, when `pnpm tracked:regenerate` and `pnpm tracked:check` run, then `git status` shows no `data/` change and the check exits 0.
- Given `pnpm check --only test:data` run alone, then the NFR-6 samples stay under 100 ms. Record them, and a before/after scratch timing of `crossFileChecks` on the committed data, in Implementation Notes.
- Given the two mutations above, when each is run for real, then Implementation Notes records the failing test names.
- Given ilvl 79 and the perfect recipe, when the filter modal opens, then the lead ends `with perfect orbs at ilvl 79. Your NeverSink filter handles everything else.`

## Implementation Notes

All on the Windows dev machine, 2026-11-15, against `00853db` plus the uncommitted change.

- **`crossFileChecks` on the committed data** (scratch script, fresh parse of `tracked.json` and `weights.json` before each sample so the pool memos start empty; deleted after use). 0 failures before and after. Before: cold 199–201 ms, warm 159–193 ms. After: cold 244–261 ms, warm 203–239 ms. The extra ~40 ms is the scope at 79 and up to three edge-alignment passes for each entry with a floor below 82. It runs once per load (`App.tsx:89`) and in the `sync` gate, never on a `rank` pass.
- **NFR-6 samples**, `pnpm check --only test:data` alone with `BUDGET_MS` briefly 1 ms, then restored to 250 (ms): L79 warm 48, 43, 40, 41, 40; L79 memo-empty 60, 61, 62, 60, 62; L82 warm 54, 52, 54, 50, 52; L82 memo-empty 69, 71, 70, 70, 70. Every sample is under 100 ms.
- **Mutation: `widestLevel` returns `HIGHEST_CRAFTING_ITEM_LEVEL`.** 2 of 411 `core` tests fail: `per-entry-floors.test.ts` › "the checks that search the pool run at a floor above the highest offered level (AD-17)" › "fails a valueless reference at floor 90 whose statId has a banded tier at 86" and "fails a hybrid pair at floor 90 that co-occurs only on a tier at 86".
- **Mutation: edge alignment at the floor only** (`for (const level of [floor])`). 1 of 411 fails: `per-entry-floors.test.ts` › "fails a band that aligns at its floor and at 79 but not at 82, naming item level 82".
- **ADV-3 without the fix** (the `noT2` push removed). 1 of 20 fails: `regenerate.test.ts` › "keeps a T2 sibling above the low level, and names its reference, which counts at no low-level variant".
- **Data fixed point.** `pnpm tracked:regenerate` leaves `git status -- data/` empty, and `pnpm tracked:check` exits 0 with all five checks passed. The summary prints `noT2` 11 and `sibling` 1404 with both the old and the new `regenerate-entries.ts`.
- **Browser** (session `poe-79ae64f4395d`, `pnpm dev` on 5173, empty storage, the first-visit `perfect`): the lead at 82 reads `…0.25 div with perfect orbs at ilvl 82. Your NeverSink filter handles everything else.` After a switch to 79 it reads `…with perfect orbs at ilvl 79. Your NeverSink filter handles everything else.` `agent-browser errors` was empty. `pnpm dev:stop` freed the port.
- `epic-7-context.md`: the AD-11 own-interval bullet (line 36) and the cross-file scope bullets (39–41) follow the spine. Line 26 (FR-29, "priced with the tier below") stays: it holds under the value reading, as PRD line 503 does.
- `EXPERIENCE.md` goes to revision 35, following the precedent of earlier Copy Deck edits. `trust-words.test.ts` pins that revision, so its expectation moves to 35.
- `pnpm check`: 8 passed after the last edit.

**Review patches** (triage rows 1 to 7): the test for a T2 sibling at exactly 79 (the `>=` mutation fails it). The test for edge alignment at 79 (the `[floor, HIGHEST_CRAFTING_ITEM_LEVEL]` mutation fails it). The VG-1 hybrid test as an `it.each` with floors 90/90, 90/82 and 82/90 (the mutations that keep only the left floor or only the right floor each fail a row). The ADV-5 comment. The UX `.memlog.md` entry for EXPERIENCE.md rev 35. The full-string `toBe` at 79. The import order. Rows 8 and 9 are the two `[NOTE FOR UX]` ledger entries. `pnpm check` ran after the patches, and all 8 gates passed.

### Agent browser checks (after review)

Session `poe-79ae64f4395d`. Run at 22:38 (local, 2026-11-15) against `git rev-parse HEAD` `00853dbb82ba982eb1ce38dddc2617a4a35ed150`. The tree was dirty: the whole change, review patches included, was uncommitted. `pnpm dev` ran on :5173 with storage cleared, and `pnpm dev:stop` freed the port. Screenshots are in `C:\Users\ilyal\.claude\jobs\8c6c4f64\tmp\shots\`.
- **Lead at 82: PASS.** `Shows the bases worth picking up at your threshold of 0.25 div with perfect orbs at ilvl 82. Your NeverSink filter handles everything else.` Screenshot: `lead-82.png`.
- **Lead at 79: PASS.** After a switch to 79 and a reopen: `…with perfect orbs at ilvl 79. Your NeverSink filter handles everything else.` Screenshot: `lead-79.png`.
- **No errors: PASS.** `agent-browser errors` printed nothing.

## Verification

**Commands:**
- `pnpm check` -- expected: all 8 gates pass.

**Agent browser checks:**
- At ilvl 82, open the filter modal. The lead names `at ilvl 82`.
- Switch to 79 and reopen the modal. The lead names `at ilvl 79`.
- The page shows no errors (`agent-browser errors` is empty).

## Review Triage Log

| # | Layer | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|---|
| 1 | verification-gap | ADV-3 `noT2` predicate not pinned at `LOW_LEVEL` (a T2 at exactly 79) | low | patch | Pre-verified: `>` → `>=` at `regenerate-entries.ts:108` passes both ADV-3 cases. |
| 2 | blind | No test pins edge alignment at the middle offered level 79 | low | patch | Mutating the loop to `[floor, HIGHEST_CRAFTING_ITEM_LEVEL]` fails no test; the only new case fails at 82. |
| 3 | blind | VG-1 hybrid case uses one floor for both entries | low | patch | `pairOverlap` (`cross-file.ts:268`) takes both floors; a mutation passing one floor survives the both-at-90 case. |
| 4 | blind | ADV-5 comment says the default context is "only for a ranking with no crafted row" | low | patch | `display-row-trust.test.ts:96` renders counted crafted rows through the default context without a throw; only a not-counted combination throws. |
| 5 | blind | UX `.memlog.md` has no entry for EXPERIENCE.md revision 35 | low | patch | Revisions 33 and 34 are logged there (`.memlog.md:139,147`); the architecture memlog got its rev-51 entry in this diff. |
| 6 | blind | 79 assertion in `level-toggle.test.tsx` uses `endsWith(...)).toBe(true)` | low | patch | A failure prints only "expected false to be true". |
| 7 | blind, ocr | `../shared/product` import out of order in `pick-up-filter-download.test.tsx` | low | patch | It sits between two `../test-support/*` imports; the sibling test file orders it. |
| 8 | impeccable | EXPERIENCE.md "ilvl is the header's one abbreviation" conflicts with Copy Deck strings using `ilvl <level>` | low | defer | Pre-existing: states 48 and 49 (rev 34) already used `ilvl <level>`; UX owns the wording (Review brief rule 2). |
| 9 | impeccable, blind | Mockup lead names `at ilvl 82` but its header draws no level toggle | low | defer | Pre-existing since rev 34 added `{components.level-toggle}` with no mockup; UX owns mockups. |
| 10 | edge, blind | `edgeFailures` stops at the first failing level, so a second slot failing only higher is reported on the next run | low | reject | Rare curator path (0 failures in data); the gate still fails; a per-slot search adds branching. Spec: "Report the first level that fails". |
| 11 | edge | Loop assumes `CRAFTING_ITEM_LEVELS` ascending | false | reject | It is the literal `[79, 82] as const` (`crafting-item-level.ts:2`); no reorder is reachable. |
| 12 | edge | ADV-3 misses an entry whose other slot's floor is above 79 | low | reject | Pre-existing and outside ADV-3's T1-only-reference predicate; a report hint with no data case; fix needs combined-floor logic. |
| 13 | edge, ocr | Edge-alignment failures now follow the widest-level ones in the list | false | reject | No consumer reads the list by order; `check.test.ts` and every core test pass. |
| 14 | blind | "at item level" vs "at floor" wording mix; contracts fixture says "at floor 79" | false | reject | The spec sets the edge wording and forbids changing empty-containment and co-rollable; the fixture is an opaque detail string in a schema test. |
| 15 | blind | Spine gives no reason to run edge alignment at a floor below 79 | false | reject | The human decision in the frozen intent names the floor and every offered level above it. |
| 16 | blind | `regenerate` summary counts a reference in both `sibling` and `noT2`; SKILL.md silent | false | reject | The agent decision in the frozen intent keeps the sibling and adds `noT2`; SKILL.md does not describe `noT2`; the JSDoc does. |
| 17 | blind | `epic-7-context.md` copies spine text | false | reject | The context is a compiled digest, and the spec directs it to follow the spine as rev 50 did. |
| 18 | blind | `HIGHEST_CRAFTING_ITEM_LEVEL` JSDoc names edge alignment | false | reject | The clause is accurate and the spec asks the JSDoc to scope the claim to the widest-level checks. |
| 19 | blind | No budget guard on `crossFileChecks` | low | reject | Runs once per load and per gate run; +40 ms measured; no named harm. |
