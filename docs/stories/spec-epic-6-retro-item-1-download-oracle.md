---
title: 'Give the pick-up filter download tests a content oracle'
type: 'chore'
created: '2026-11-02'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The App-level download tests compare the downloaded file with text built by the same `rank`, `pickUpPurposes` and `filterText` calls that the page makes, so a wrong purpose at the App boundary passes (epic 6 retro action item 1; review VG-1, ADV-8). No download runs under state 35 or 43, no App-level world has a base at two floors, and the core `NO_EV_CAUSES` fixtures for Unrankable and no-priced-Combination are hand-built rankings that differ only in fields `pickUpPurposes` ignores (ADV-7).

**Approach:** Assert the purpose of named blocks against a hand-derived FR-36 oracle at the App boundary: once for the standard world, once each under states 35 and 43 (no craft and no check-rolls block), and once for a two-floor world (`ItemLevel <=` present). In core, add Unrankable and no-priced-Combination cases built through `rank`. Tests only. No production code changes.

</frozen-after-approval>

## Implementation Notes

- **Oracle form (my choice).** A test helper in `packages/web/src/App/pick-up-filter-support.tsx` parses the downloaded text into `{ baseType, rarity, itemLevel lines, tier, purpose }` records. The purpose comes from matching each block's treatment lines to `TREATMENTS`. The expected records are literals derived by hand from FR-36 for the world in the test, never from `rank`/`pickUpPurposes`. `TREATMENTS` is the serialiser's data, which `filter-text.test.ts` owns. The evaluator under test is `pickUpPurposes`, so reusing the treatment table does not make the oracle circular.
- **Web tests** (`pick-up-filter-download.test.tsx`; a sibling `pick-up-filter-download-oracle.test.tsx` if `max-lines` is hit):
  - The first download test also asserts the full block list of `pickUpWorld()` under greater at 0.25. Recurve Bow Normal is craft, Recurve Bow Magic is check-rolls at tier >= 4, and Wide Belt and Gold Amulet are sell raw.
  - State 35 (`rates: RATES.slice(0, 2)`, perfect) and state 43 (`recipes: []`): download and assert that every block is sell raw.
  - Two-floor world: Recurve Bow at two `itemLevelMin` values with different prices. Assert the lower-floor blocks carry `ItemLevel <= (upper floor − 1)`. Purposes follow `pick-up-floors.test.ts`.
  - `expectedFilterText` stays for the threshold and recipe change tests, which check that the next download follows the new ranking.
- **Core** (`packages/core/src/pick-up/pick-up.test.ts`): add rank-built cases through `rankCrafted`. Unrankable uses a partial Bows pool (`weightsWith(['weapon.bow', 'Bows', 'partial'])`). No-priced-Combination uses a Bows `chase` with no dataset price. Each case has a priced Bows Raw Base and asserts sell raw only.
- **Agent browser checks: exempt.** The change edits only test files and test helpers, so the page cannot change (`_bmad/custom/prompts/agent-browser-checks.md` rule 1).
- **Done gate:** `pnpm check` exits 0.

### As built

- `blocksOf` sorts its records with a code-unit compare (`byCodeUnit`). Entry order is NFR-3's concern and the core and serialiser tests own it, so the App oracle compares purposes only. The hand-derived lists matched the downloads on the first run, and only the order differed.
- `downloadedText` flushes after reading the Blob. Without the flush, the deferred `revokeObjectURL` of a new test fired inside the next test's `captureDownloads` patch and failed its "nothing revoked yet" assertion.
- Mutation check: `pickUpPurposes` was made to return sell raw in place of craft. Three App download tests then failed: the new two-floor test, the strengthened first test, and the recipe-change test. Before this change, only the recipe-change test would have failed, and only by accident, because its greater and perfect texts became equal. The mutation was reverted.
- `blocksOf` returns one `<base type>: <conditions> → <purpose>` string per block, not the record the plan named. It throws when a block has no `BaseType` line, or when not exactly one treatment ends the block.
- Core: each rank-built cause runs three raw states: priced (sell raw), below the threshold (no entry) and unpriced (no entry). The unpriced state fails if the cause leaks any EV > 0, because FR-36 makes such a base craft. Each case asserts that the cause's bucket holds only Bows rows. `unpricedCrafted` holds one row per recipe.
- Second mutation: sell raw was replaced with craft in the no-EV branch. Five of six App download tests failed, and the mutation was reverted.
- `pnpm check` exits 0 after the review fixes.
- Files: `packages/core/src/pick-up/pick-up.test.ts`, `packages/web/src/App/pick-up-filter-download.test.tsx`, `packages/web/src/App/pick-up-filter-support.tsx`.

## Review Triage Log

- BH ADV-7 partial (hand-built fixtures still drive the raw value 0 and unpriced cases): medium, patched. All three raw states now run through the rank-built causes.
- BH weak bucket precondition: low, patched. The test asserts that the bucket holds only Bows rows.
- BH and OCR-4, the parser accepts a block with no `BaseType` line: low, patched. It throws now.
- OCR-3, a treatment could match by suffix ambiguously: low and latent, patched. It throws unless exactly one treatment matches.
- BH unclear comments (threshold, Wide Belt as Amulets) and the stale file header: low, patched.
- BH spec text does not match the parser form, and the done gate is not recorded: low, patched in As built.
- BH mutation check in one direction only: low, patched. A second mutation (no-EV sell raw → craft) failed 5 of 6 tests.
- BH action item not closed: low, patched. `sprint-status.yaml` item 1 is `done`.
- BH CRLF in `pick-up-filter-support.tsx`: false. Git normalises the file to LF on commit, and the diff is not whole-file (`git diff --stat`).
- BH and OCR-2, import order of `downloadedText`: false. The lint gate passes.
- OCR-1, JSDoc over 3 lines: false. The block has 3 lines of why.
- BH repeated download steps in the first test: rejected. That test asserts the revoke timing and that no fetch happens, and `downloadedText` hides both.
- OCR-5, the capture patch outlives a throw: false. `captureDownloads` restores it in `onTestFinished`, as the reviewer noted.
