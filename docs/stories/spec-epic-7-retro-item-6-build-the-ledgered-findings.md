---
title: 'Build the six epic 7 findings that item 6 ledgered'
type: 'bugfix'
created: '2026-11-15'
status: 'ready-for-dev'
route: 'dispatch'
review_loop_iteration: 0
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
- [ ] spine, `.memlog.md`, `EXPERIENCE.md`, mockup -- the two rulings.
- [ ] `cross-file.ts`, `edge-alignment.ts`, `crafting-item-level.ts`, and tests -- ADV-2 and VG-1.
- [ ] `regenerate-entries.ts`, `regenerate.test.ts` -- ADV-3.
- [ ] `display-rows.ts` -- ADV-5.
- [ ] `filter-copy.ts`, `PickUpFilter.tsx`, `header-controls.tsx`, and tests -- B1.
- [ ] `deferred-work.md` -- remove the six entries.

**Acceptance Criteria:**
- Given each row of the I/O matrix, when its test runs, then it passes. Given `widestLevel` cut to `HIGHEST_CRAFTING_ITEM_LEVEL`, then the VG-1 cases fail. Given edge alignment run at the floor only, then the ADV-2 case fails.
- Given the committed data, when `pnpm tracked:regenerate` and `pnpm tracked:check` run, then `git status` shows no `data/` change and the check exits 0.
- Given `pnpm check --only test:data` run alone, then the NFR-6 samples stay under 100 ms. Record them, and a before/after scratch timing of `crossFileChecks` on the committed data, in Implementation Notes.
- Given the two mutations above, when each is run for real, then Implementation Notes records the failing test names.
- Given ilvl 79 and the perfect recipe, when the filter modal opens, then the lead ends `with perfect orbs at ilvl 79. Your NeverSink filter handles everything else.`

## Verification

**Commands:**
- `pnpm check` -- expected: all 8 gates pass.

**Agent browser checks:**
- At ilvl 82, open the filter modal. The lead names `at ilvl 82`.
- Switch to 79 and reopen the modal. The lead names `at ilvl 79`.
- The page shows no errors (`agent-browser errors` is empty).
