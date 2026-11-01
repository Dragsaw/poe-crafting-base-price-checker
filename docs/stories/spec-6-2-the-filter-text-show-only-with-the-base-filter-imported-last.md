---
title: 'Story 6.2: The filter text, Show-only, with the Base Filter imported last'
type: 'feature'
created: '2026-11-01'
status: 'done'
baseline_commit: '00d84514c7178f13d5479844c27efc91e745f269'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-6-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 6.1 decides each base's purpose in `core`, but nothing writes those purposes as a file the game loads. AD-31 gives `web` that job.

**Approach:** Add one pure `web` function that turns the `PickUpEntry[]` of `pickUpPurposes` and a Base Filter file name into filter text. Epic 6 Story 6.2 in `docs/epics.md` holds the acceptance criteria. This spec does not restate them.

## Boundaries & Constraints

**Always:**
- The owner documents decide: FR-35, FR-37 (`prd.md` §4.11), AD-31. Where this spec and those documents differ, the documents win.
- One `Show` block per entry, in input order. 6.1 already sorts the list, so the serialiser does not re-sort.
- A block's conditions are exactly these, in this order: `BaseType == "<baseTypeId>"`, `Rarity Normal` or `Rarity Magic`, `ItemLevel >= <itemLevelMin>`, and `UnidentifiedItemTier >= <unidentifiedTierMin>` only when the entry has one. Then the purpose's treatment lines.
- Tab indentation, LF line endings, one blank line after each block. The text ends with `Import "<fileName>"` and one `\n`.
- The file name is written verbatim. 6.3 adds `.filter` and enforces state 45, so the serialiser does not.
- Each treatment borrows the colours that NeverSink's PoE2 filter gives the same kind of item (FR-37). The serialiser's module and its tests are the only place that holds the values.
- Decision (human, 2026-11-01): craft takes NeverSink's `[[0700]] Economy Crafting Bases` second-tier colours. Sell raw takes the `[[0200]] Exotic Bases` colours for a common exotic base at item level 82 or more. Check the rolls takes the `[[0800]] High Unidentified Mod Tier` magic text colour. Each purpose has a different colour.
- Decision (human, 2026-11-01): each treatment is `SetFontSize 40`, its colour lines and a size-2 `Diamond` minimap icon, with no `PlayAlertSound` and no `PlayEffect`. The icon colour is Yellow for craft and Blue for sell raw, as NeverSink gives them, and Cyan for check the rolls, so that it matches the teal text and differs from sell raw.

**Never:**
- No `Continue`, `Hide`, `Class` condition or comment line. No condition that AD-31 does not name, such as `Corrupted` or `Mirrored`.
- No treatment graded by EV, and no line that names a Combination, a modifier or a price.
- No UI, no download, no storage and no `core` change. Story 6.3 adds them.
- Do not edit an owner document (PRD, spine, `EXPERIENCE.md`, `DESIGN.md`, `epics.md`), and do not write a treatment value into any document.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Empty | `[]`, `"Base.filter"` | `Import "Base.filter"\n` only | N/A |
| White craft | normal, floor 82, craft | `BaseType ==`, `Rarity Normal`, `ItemLevel >= 82`, craft treatment, then `Import` | N/A |
| Magic check | magic, floor 82, tier 4 | adds `UnidentifiedItemTier >= 4`, check-rolls treatment | N/A |
| Jewel kind | magic, no tier | no `UnidentifiedItemTier` line | N/A |
| Prefix names | entries for `Ruby` and `Ruby Ring` | each block names one base with `==` and quotes | N/A |
| Twice | same input | byte-identical text | N/A |

</frozen-after-approval>

## Code Map

- `packages/core/src/pick-up/pick-up.ts` -- `PickUpEntry` (`baseTypeId`, `rarity`, `itemLevelMin`, `unidentifiedTierMin?: 4`, `purpose`) and `PickUpPurpose`. Import them from `@poe/core`. Do not change them.
- `packages/core/src/pick-up/pick-up.test.ts:27-80` -- the `EMPTY` `Ranking` literal and the `classRow` and `rawBase` builders show how to build a `Ranking` literal for the golden test.
- `packages/web/src/test-support/list-fixtures.ts` -- `rawEntry` builds a raw Tracked Entry. Reuse it.
- `test/directory-structure.test.ts` -- caps TypeScript files per directory at 25 and bans directory names that say nothing. `packages/web/src/list` is at 25, so the new module needs its own directory.
- `~/Documents/My Games/Path of Exile 2/very strict.filter` (the player's NeverSink 0.10.4a export, not in the repo) -- sections `[[0700]] Economy Crafting Bases`, `[[0800]] High Unidentified Mod Tier` and `[[0200]] Exotic Bases` hold the colours to borrow. `inherit-test.filter` beside it is the in-game test of `Import`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/web/src/pick-up-filter/filter-text.ts` -- export `filterText(entries: readonly PickUpEntry[], baseFilterName: string): string` and a `TREATMENTS` record keyed by `PickUpPurpose` -- the one serialiser (AD-31)
- [x] `packages/web/src/pick-up-filter/filter-text.test.ts` -- each matrix row; each AC of Story 6.2 named in a test; a check that no output line starts with anything outside `Show`, `Import`, the four condition keywords and the treatment keywords; the golden test, which runs `pickUpPurposes` on a literal `Ranking` and Tracked List that hold craft, sell raw, check the rolls, a jewel kind and a pruned raw base, and pins the full text with an inline string -- AC coverage

**Acceptance Criteria:**
- Given the Story 6.2 ACs in `docs/epics.md`, when the tests run, then each AC has at least one test that names it.
- Given the change, when `pnpm check` runs, then it passes, and no test makes a network call.

## Implementation Notes

## Spec Change Log

## Review Triage Log

Iteration 0. Layers: Blind Hunter (BH), Edge Case Hunter (ECH), Verification Gap (VG, no gaps), Deferred Ledger Audit (no findings), Impeccable Design Review (IDR, no findings), OCR Delegate (OCR).

| # | Finding (layer) | Verdict | Evidence | Route |
|---|---|---|---|---|
| 1 | `baseTypeId` written into `"…"` unescaped; a `"` or newline breaks or injects lines (OCR, ECH, BH) | low | `BaseTypeIdSchema` is `string().min(1)`, but each id is the trade API `type` string that `tracked:check` matches against the catalogue; no tracked id holds a quote, and no game base name does. Unlikely, and the fix adds a guard | rejected |
| 2 | `baseFilterName` unescaped, may be empty or hold `"`/CR/LF (OCR, ECH, BH) | false | The frozen intent writes the name verbatim and gives the checks to 6.3: state 44 disables download on an empty name, state 45 rejects `"`, `/`, `\`; a single-line text input strips CR/LF. No path reaches `filterText` with such a name | rejected |
| 3 | `filterText` JSDoc does not say it trusts the caller for the name (BH) | low | A 6.3 caller reading only the signature cannot tell the guard is theirs; one JSDoc clause fixes it | patch |
| 4 | Two entries with one `baseTypeId` and different floors: the first block shadows the second (ECH, BH) | medium | Real: without `Continue` the first match wins. Root cause is the FR-36 gap already in the ledger from spec-6-1; the frozen intent forbids re-sorting and the epic context forbids inventing a rule | defer |
| 5 | No test pins today's output for case 4 (BH) | low | Real test gap of this diff; one test, no new surface | patch |
| 6 | `isExpressible` passes `''`, `0x40`, `1e2`, `40.5` (ECH, BH) | low | `Number('') === 0` and no integer check, confirmed at `filter-text.test.ts:57-65`; direct correction | patch |
| 7 | `TREATMENTS` comment lacks NeverSink version and rule ids (BH) | low | AD-31 makes this module the owner of the values; without the source rules they cannot be re-checked; comment edit | patch |
| 8 | Golden fixture puts a pruned base into `ordering` as an active row (BH) | low | `RankedRowSchema` refuses a pruned row (`ranked-row.test.ts:49`), so the fixture is unreachable; absence of Lapis only implied | patch |
| 9 | AC 1 test does not assert exactly one `Import` (BH) | false | The golden test pins the full text byte for byte, so a second `Import` fails it | rejected |
| 10 | "Twice" test proves little (BH) | false | `golden()` rebuilds its input on each call, and the order test (`Ruby Ring` before `Gold Amulet`) fails on any re-sort | rejected |
| 11 | Ranking builders copied from core; `'Forbidden Rites'` hard-coded (BH) | maybe-false / low | That 6.3 needs the builders is not shown; if true only low, so the move is rejected. `TEST_LEAGUE` exists with the same value: direct correction | patch (league only) |
| 12 | The design-review prompt names `.claude/skills/impeccable/scripts/`, which does not exist (IDR) | medium | `ls .claude/skills` has no `impeccable`; the reviewer fell back to the plugin cache copy. Fix edits an agent prompt file | defer |

## Design Notes

**Why input order.** The game stops at the first block that matches. Two blocks never match one item, because they differ in `BaseType` or rarity. The one exception is a deferred item: two raw entries with one `baseTypeId` and different floors. 6.2 does not invent a rule for it, and the input order keeps the output deterministic.

**Why a trailing newline.** The repo's encoding convention ends every file with `\n`. The `Import` line is still the last line of the text.

## Verification

**Commands:**
- `pnpm check` -- expected: exit 0

**Agent browser checks:** exempt. No production `web` module imports `filterText` in this story, so the page cannot change. Story 6.3 is the first story that renders it.
