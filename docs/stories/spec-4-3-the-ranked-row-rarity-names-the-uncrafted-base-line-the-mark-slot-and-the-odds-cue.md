---
title: 'Story 4.3: The ranked row — rarity names, the uncrafted-base line, the mark slot and the odds cue'
type: 'feature'
created: '2026-10-10'
status: 'done'
baseline_commit: '4baba998998cebd104e423c6005f6859d2b9421e'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-4-context.md'
  - '{project-root}/docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/EXPERIENCE.md'
  - '{project-root}/docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The ranked row still has the paper layout: six columns, text glyphs, a `prior only` provenance column, a blank age cell, no rarity colour and no tooltips. It does not render the `trust` that Story 4.2 put on every row. `unitLabel()` prints `Helmets_str` as `Helmets str`.

**Approach:** Rebuild the row, the column header and the cold-load skeleton on the four-column grid of `DESIGN.md` (`ranked-row`, `column-header`). Render the name in its rarity colour, give the Raw Base row its sell-as-is line, show `core`'s verdict as a drawn mark with `{components.mark-tooltip}`, show ≈ before the EV of a uniform-prior row, and put the EV tooltip on the `EV (Divine)` header label. All display strings come from the `EXPERIENCE.md` Copy Deck.

## Boundaries & Constraints

**Always:**
- Labels follow `EXPERIENCE.md` *Item Class labels*. Names use `nameCrafted` / `nameRaw` (roman, no italic). The Raw Base chase slot holds the Copy Deck sell-as-is line in `chaseRaw`.
- The mark slot is always reserved, so every figure ends at the same x. `current` renders no element. `rough`, `pending` and `broken` render ◐, ○ and ✕ as inline SVG in a 1em box with `currentColor`, and the tooltip shows `<word> · <reason>`. Each reason kind maps to the Copy Deck words of *Price trust*. A Raw Base row uses its tooltip column, so `no-listings` prints with no days. The reasons join in the order `core` gives.
- ≈ is drawn before the figure only when a crafted row has `provenance === 'uniform-prior'`. It has no tooltip of its own.
- The EV tooltip follows the Copy Deck (normal, uncostable and no-recipe variants), with the live threshold and Craft Cost.
- A null EV prints `—` beside the mark (states 18, 40, 41). A negative EV prints at 2dp in `figureNegative` with U+2212 (state 21), with empty chase cells. Ranks 1–5 get emphasis by weight and colour only. The open row shows the inset accent bar and moves no column.
- `web` reads `trust` and `provenance` from `core` and derives no verdict, cut-off or share.
- There are only three tooltip kinds (`EXPERIENCE.md` *Tooltips*). The name has no tooltip.

**Never:**
- Changes to `core`, `contracts` or `sync`.
- The expansion's lines and their trust (Story 4.4), the header controls (Story 4.5), list statements, the state-35 branch boundary, the recipeless group and the deletion of `UniformPriorBanner`, `KeyBlock`, `TrustStrip` and `TrustMark` (Story 4.6).
- Copying a token value or a Copy Deck string into a test as its own literal, when the test can import the constant.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Healthy crafted, measured | `trust` current, `measured` | magic name, figure, empty mark slot, no ≈ (states 1, 11) | N/A |
| Estimated odds | crafted, `uniform-prior` | ≈ before the figure (state 12) | N/A |
| Raw Base | raw row | grey name, sell-as-is line, never ≈ (state 12a) | N/A |
| Rough share | crafted, `unreliable-share` 74 | ◐; tooltip `rough · 74% of this EV …` (state 17) | N/A |
| Old and thin raw | reasons old 4, thin 1 | ◐; both reasons, age first | N/A |
| Pending crafted | `no-prices`, EV null | ○, `—` (state 18) | N/A |
| All broken | `all-broken`, EV null | ✕, `—` (state 41) | N/A |
| Unpriced raw trail | `UnrankedEntry` pending/broken | ○ or ✕ with the entry reason, `—` (states 18, 40) | N/A |
| No qualifying combination | crafted, EV < 0 | empty chase cells, dimmed `−0.03` (state 21) | N/A |
| Defence suffix | `Body_Armours_str_dex_int`, `Helmets_str`, `Bows` | `Body Armours (Str/Dex/Int)`, `Helmets (Str)`, `Bows` | N/A |

</frozen-after-approval>

## Code Map

- `packages/web/src/list/RankedRow.tsx` -- `RankCell` L82, `UnitCell` L99, `ExpectedValueCell` L131, provenance and age cells L56–61, `ChaseCell` L156. Rebuild to the four cells. Drop `UnitGlyph`, `TrustMark` and `PRIOR_ONLY` from the row. Height 28 → `spacing.row-height`.
- `packages/web/src/list/display-rows.ts` -- `DisplayRow` L35, `ClassDisplayRow` L56, `rankedRows` L196, `unpricedRow` L238. Add `trust` (and keep `provenance`). Replace the `notYetSynced` EV phrase with a missing-figure kind. `tierOf` L104 stays.
- `packages/web/src/list/format.ts` -- `unitLabel` L21 (fix), `rawNote` L26 (replace with the Copy Deck sell-as-is line), `MONEY_PHRASES` L12. Test: `format.test.ts` L45.
- `packages/web/src/theme/tokens.ts` -- `rankedRowColumns` L144 (six fixed columns) and `layout.contentWidth`/`rowHeight` L56–59 become the `spacing` grid (`col-rank`, `col-name`, `col-ev`, chase 1fr, `col-gap`, `mark-slot`, `row-height`). Remove the `glyphs` entries that no remaining reader uses. Test: `tokens.test.ts`.
- `packages/web/src/list/ColumnHeader.tsx` and `packages/web/src/frame/RowSlots.tsx` -- share `cellStyle`. Use the four Copy Deck labels. `EV (Divine)` gets the EV tooltip and a right padding equal to the mark slot.
- `packages/web/src/theme/theme.ts` L89 `components` -- the Mantine `Tooltip` defaults for the mark-tooltip shell (`surface-raised`, `line-strong`, `rounded.tooltip`).
- `packages/web/src/list/KeyBlock.tsx` -- delete only the key lines that describe a row cell this story removes (◊ prior only, the unit glyphs). Story 4.6 deletes the rest.
- New files go in a subfolder: `packages/web/src/list` is at its `OVER_CAP` of 31 (`test/directory-structure.test.ts`). Add `packages/web/src/marks/` (SVG ◐ ○ ✕ ≈, which Story 4.4 reuses) and `packages/web/src/list/row/` (mark slot, EV cell, tooltips).
- Tests: `list/ranked-list.test.tsx`, `list/ranked-list/{key-and-glyphs,unpriced-trail,top-20-bound}.test.tsx`, `recipe/craft-recipe/{chase-cells,provenance-banner,crafted-states}.test.tsx`, `App/page-chrome.test.tsx` and `list/display-rows.test.ts` assert the old cells. Update them. Helpers: `test-support/dom.tsx` (`mountList`, `cellIn`, `rgb`) and `test-support/list-fixtures.ts`.
- `docs/stories/epic-4-context.md` -- remove the `unitLabel()` must-discharge line in the same commit (AGENT-WORKFLOW *Must-discharge*).

## Tasks & Acceptance

**Execution:**
- [x] `packages/web/src/list/format.ts`, `format.test.ts` -- fix `unitLabel` for the defence suffix, add the shipped-defect case, and replace `rawNote` -- FR-3.
- [x] `packages/web/src/theme/tokens.ts`, `tokens.test.ts`, `theme.ts` -- the four-column grid, 38px rows, the Tooltip defaults -- DESIGN.md `ranked-row`.
- [x] `packages/web/src/marks/*` (new) -- the SVG marks and ≈ in a 1em `currentColor` box -- NFR-10 silhouettes.
- [x] `packages/web/src/list/row/*` (new), `RankedRow.tsx`, `display-rows.ts` -- the rarity name, the sell-as-is line, the mark slot with its tooltip and reason words, ≈, `—`, the dimmed negative, rank emphasis, the open bar -- states 1, 11, 12, 12a, 17, 18, 21, 40, 41.
- [x] `packages/web/src/list/ColumnHeader.tsx`, `frame/RowSlots.tsx` -- the four labels, the EV tooltip with its three variants -- FR-10.
- [x] `packages/web/src/list/KeyBlock.tsx` and the row tests listed in the Code Map -- remove the stale key lines and re-pin the assertions -- no test pins a retired cell.
- [x] Tests for every I/O matrix row, every reason kind's words and the EV tooltip variants.

**Acceptance Criteria:**
- Given any rendered page, when every colour is ignored, then craft versus sell, each trust state and estimated odds each still read from a word or silhouette (NFR-10).
- Given rows with and without marks or ≈, when their EV figures are measured, then every figure ends at the same x.
- Given the page, when it is searched for tooltips, then only mark, EV-label and cut-chase tooltips exist, and none holds a control.
- Given `pnpm check`, when it runs, then it is green.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | verification-gap | No test runs `expectedValueCost` or reads the EV tooltip the App renders | medium | Pre-verified: `mountList` hard-codes `no-recipe`; no App-level hover test | patch |
| 2 | design | Name ellipsis draws in the inherited colour and weight | low | Ellipsis on `data-cell="name"` div, colour and weight on the inner span; CSS draws `…` with the block's style | patch |
| 3 | design | EV label keeps the hover look when no tooltip exists (skeleton) | low | `ExpectedValueLabel` styles the span in both branches of `note === undefined` | patch |
| 4 | blind | Test title names the retired *no figure yet* phrase | low | `display-rows.test.ts` title vs body asserting `missing` | patch |
| 5 | ledger | TrustMark deletion owed by Story 4.6 is unrecorded; its `prior` kind is now unused (also blind, edge) | low | epic-4-context Story 4.6 list omits TrustMark; no production reader of kind `prior` | defer |
| 6 | design | Cut chase cell has no full-text tooltip | medium | Pre-existing; not in the old row or this story's tasks; no epic story owns it | defer |
| 7 | design | Chase column has no two-cell form below budget B | low | Pre-existing; no epic story owns it | defer |
| 8 | design | Last row keeps its bottom rule | low | Pre-existing in the old row; fix needs an `isLast` signal | defer |
| 9 | blind, edge | Mark and EV tooltips unreachable by keyboard or touch; marks hidden from screen readers | false | EXPERIENCE.md *Accessibility Floor*: no keyboard path, no screen-reader behaviour (AGENT-WORKFLOW Review brief rule 1) | reject |
| 10 | blind | `—` on a pending or broken crafted row with a numeric EV deviates from spec | false | EXPERIENCE.md *Missing figures* puts `—` in the EV cell of every pending or broken row, crafted included; the matrix row expects ○ and `—` | reject |
| 11 | blind, edge | Removing the 1012px ledger entry is premature: ExpansionPanel still uses `layout.contentWidth` | false | The ranked-row grid the entry named is gone; the panel's fixed width stays tracked by the Story 4.1 *layout group* entry | reject |
| 12 | blind, verification-gap | Honest-empty rows force `—` and could show it with no mark | low | Needs a `current` crafted row in state 23, which core's no-prices rule makes unlikely; would need a guard branch | reject |
| 13 | blind | Empty `reasons` with a non-current verdict prints a trailing joiner | false | `PriceTrustSchema` refines: reasons are empty exactly when current | reject |
| 14 | blind | `trust.verdict === 'current'` check in `MarkSlot` is redundant | false | It narrows `trust.verdict` to `MarkedVerdict` for `VerdictMark` and `MARK_COLORS` | reject |
| 15 | blind | `sellAsIsLine` unused in production; row reuses `TRUST_JOINER` | low | Tests compare the row against `sellAsIsLine`, so drift is caught; no user harm | reject |
| 16 | blind | Few `glyphs` entries removed; KeyBlock keeps *Provenance marks* title | low | Remaining glyphs still have readers; Story 4.6 deletes KeyBlock | reject |
| 17 | blind | Test pins EXPERIENCE.md revision 25 | false | Deliberate repo pattern (`tokens.test.ts` pins DESIGN.md revision) to force a re-check on doc revision | reject |
| 18 | blind | Alignment AC checked only structurally; spec and sprint statuses differ | false | Sprint status moves at the done step per workflow; implementer's browser check measured one right edge | reject |
| 19 | blind | Some comments narrate | low | Cited comments state cell rules, not history; no named harm | reject |
| 20 | edge | Wide EV figure overflows the 96px column | low | Needs ≥9-character figures (e.g. −12345.67); EVs are well below that | reject |
| 21 | edge | EV in (−0.005, 0) prints a dimmed `−0.00` | low | Pre-existing `formatDivine` behaviour; needs a near-zero negative EV | reject |
| 22 | edge | ≈ prints before `—` on a pending uniform-prior row | false | EXPERIENCE.md *Estimated odds*: ≈ is not a price-trust state and answers a different question from the price | reject |
| 23 | edge | `unitLabel` mishandles `X_str_str` or `_str` | low | No such className in the contracts grammar or tracked data | reject |

## Design Notes

The epic context's ranked-row grid is the same work as the deferred entry *Replace the fixed 1012px ranked-row grid*. This story adopts the `DESIGN.md` grid, so the last commit removes that ledger entry. The italic ledger entry stays, because only the row's italic goes here. The ≈ and the retired provenance column overlap with `UniformPriorBanner` until Story 4.6. That interim duplication is accepted.

## Verification

**Commands:**
- `pnpm check` -- expected: green.
- `pnpm --filter @poe/web test` -- expected: the new row tests pass.

**Manual checks:**
- agent-browser with a named session against `pnpm dev`: take a screenshot of a page with crafted, raw, rough, pending and negative rows, then hover a mark and `EV (Divine)`.
