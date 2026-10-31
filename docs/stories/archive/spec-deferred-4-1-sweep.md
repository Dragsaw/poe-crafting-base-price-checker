---
title: 'Deferred 4.1 sweep: chase-cell tooltip and count, last-row rule, sub-day tried age'
type: 'feature'
created: '2026-10-10'
status: 'done'
route: 'dispatch'
baseline_commit: '5e5e673974cb7d30132b8108fb5361dcaac22f22'
review_loop_iteration: 1
context:
  - '{project-root}/docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The four ledger entries under *Deferred from: spec-4-1* in `docs/stories/deferred-work.md` are unbuilt. (1) A cut chase cell has no tooltip. (2) The crafted chase column always shows three cells. (3) The last row of a list draws a rule. (4) A fresh no-listings attempt reads `tried 0 days ago`.

**Approach:** Build all four in one branch (the user chose to keep all goals): (1) DESIGN `chase-cell.cutHover`, EXPERIENCE Interaction 8; (2) DESIGN *The chase column*; (3) DESIGN *Density*; (4) EXPERIENCE *Ages*, "In a reason". `core` keeps the age figure (AD-1, AD-10, AD-17), and `web` only spells it. The last commit removes the four ledger entries.

## Boundaries & Constraints

**Always:**
- The tooltip opens only when the cell is truncated (`scrollWidth > clientWidth`, read at hover). It uses the global Tooltip shell (`theme.ts`, mark-tooltip shell) and adds no other tooltip.
- The tooltip text is in `typography.chase`, with mod text in `rarity-magic` and tier and joiner in `text-secondary`. The row cursor does not change.
- One cell count for every crafted row of the page. Three cells while `(listWidth − 390 − 36) ÷ 3 ≥ B`, otherwise two cells with one `chase-gap`.
- `B` is a named web constant measured in the browser (agent-browser) at `typography.chase` in bundled Inter. Its comment cites DESIGN *Measure at build*. Decision (Q1): B is the width of the widest real chase-cell text of at most 27 characters. Build every combination of two `SHORT_FORMS` entries, each led by `T1` and joined by ` · `. A test fails when the table yields a wider candidate than the one measured, so B gets re-measured when the table changes.
- Decision (Q2): the build edits EXPERIENCE.md L210, L628-629, L639, L789, L1135 and L1191 so the no-listings age cites *Ages* (`tried N min/hours/days ago`) and no longer says whole days.
- A row draws no bottom rule when it is the last row of the list, or when show-more follows it. In state 35 the raw branch's last row keeps its rule when the crafted branch follows it directly. When such a row is open, its expansion panel draws no rule either. Show-more does not count as a row. (Human ruling, review iteration 1.)
- The no-listings reason carries whole minutes since `lastAttemptedAt`, rounded down and clamped at 0: `{ kind: 'no-listings', minutes? }`, which replaces `days`. Web spells it as `tried N min ago` under 60, `tried N hour(s) ago` under 1440, and otherwise `tried N day(s) ago`. `min` never pluralises, and under a minute reads `tried 0 min ago`.

**Never:**
- No media queries, and no change to `packages/web/vite.config.ts`, to `sync`, or to any artifact schema. The trust reason is in-memory only (AD-4).
- Do not colour the row's own tier and joiner. That is a separate gap and is out of scope.
- Do not change `relativeAge` or `compactAge`, or the `old` reason.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| Cut cell hovered | scrollWidth 300 > clientWidth 175 | tooltip with full text, recoloured |
| Uncut cell hovered | scrollWidth == clientWidth | no tooltip |
| Wide list | width ≥ 3B + 426 | 3 cells on every crafted row |
| Narrow list | width < 3B + 426 | 2 cells on every crafted row; raw rows unchanged |
| Last row, show-more below | 21 rows, top 20 shown | row 20 has no rule |
| Last row open | panel open under last row | neither row nor panel draws a bottom rule |
| Attempt 4 h ago | lastAttemptedAt = now − 4h | `tried 4 hours ago · no listings` |
| Attempt 59 s / 1 h / 2 d ago | — | `tried 0 min ago` / `tried 1 hour ago` / `tried 2 days ago` |
| Attempt in the future | lastAttemptedAt > now | `minutes: 0` |
| No attempt | lastAttemptedAt unset | `no listings` only |

</frozen-after-approval>

## Code Map

- `packages/web/src/list/RankedRow.tsx` -- `ChaseCells` L100-122 (grid of `CHASE_CELLS`, `ELLIPSIS` cells, `CombinationText` without tones). Row border inline at L58 (`open ? transparent : line`).
- `packages/web/src/list/display-rows.ts` -- `CHASE_CELLS = 3` L113, stale `492 = 3 × 164` comment; `summands.slice(0, CHASE_CELLS)` L159 keeps three summands in the data. Keep it.
- `packages/web/src/list/RankedList.tsx` -- `Branch` maps `visible` rows plus optional panel, then show-more. It knows the last index.
- `packages/web/src/list/ExpansionPanel.tsx` -- own `borderBottom` L84.
- `packages/web/src/list/UnrankableAppendix.tsx` L114 -- the `last` prop pattern to copy.
- `packages/web/src/list/expansion/CombinationText.tsx` -- `tones` prop (tier, joiner). The mod colour comes from the parent.
- `packages/web/src/theme/theme.ts` L73-91, L133-136 -- global Tooltip defaults (mark shell). Examples: `list/row/MarkSlot.tsx` L38-46.
- `packages/web/src/theme/tokens.ts` -- `spacing` (`chase-gap` 18, `col-*`), `typeRoles.chase`.
- `packages/web/src/test-setup.ts` L26 -- ResizeObserver stub. Tests must drive width and stub `scrollWidth`/`clientWidth`.
- `packages/contracts/src/ranked-row/price-trust.ts` L13-16 -- no-listings `days` → `minutes`. Test: `ranked-row.test.ts:140`.
- `packages/core/src/price-trust.ts` `entryTrust` L52-84 -- `Math.floor(ageMs(...) / DAY_MS)` → minutes. Tests: `price-trust.test.ts:86-104`, `rank.test.ts:115`.
- `packages/web/src/shared/time.ts` -- add a reason-age speller next to `unitAgo`. Tests in `time.test.ts`.
- `packages/web/src/list/row/trust-words.ts` `lineReasonWords` L65-72. Tests: `trust-words.test.ts` (adapt `isWrittenInExperience` to the *Ages* forms), `recipe/craft-recipe/crafted-panel.test.tsx:64` (today asserts `tried 0 days ago`), `list/expansion/raw-base-combination-row.test.tsx:60-68`.
- Row tests: `list/row/ranked-row.test.tsx` (asserts 3 cells at L77, L124), `list/ranked-list.test.tsx`, `list/ranked-list/top-20-bound.test.tsx`. Helpers: `test-support/hover.ts`, `test-support/dom.tsx`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/ranked-row/price-trust.ts` (+ test) -- `minutes` replaces `days` on no-listings.
- [x] `packages/core/src/price-trust.ts` (+ tests) -- compute whole minutes.
- [x] `packages/web/src/shared/time.ts` (+ test) -- reason-age speller per *Ages*. `trust-words.ts` uses it, and the dependent tests are updated.
- [x] Measure B in the browser. Add the constant and a chase-count hook (ResizeObserver on the list container, one value for the page). `ChaseCells` renders that many cells. Fix the stale `display-rows.ts` comment.
- [x] `RankedRow.tsx` -- cut-cell Tooltip, with the cut check at pointer enter and the recoloured `CombinationText`. Add a `last` prop that drops the row rule.
- [x] `RankedList.tsx`, `ExpansionPanel.tsx` -- pass `last`, and drop the panel rule when it is under the last row.
- [x] `docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/EXPERIENCE.md` -- the Q2 line edits.
- [x] Tests for every matrix row. Remove the four entries from `deferred-work.md` in the last commit.

**Acceptance Criteria:**
- Given a crafted list in the browser at a 1000px and a 1120px frame, when the page renders, then every crafted row shows the cell count that the B rule gives, and a hovered cut cell shows its full text.
- Given `pnpm check`, when run, then it passes with no network call.

## Implementation Notes

- B measurement (agent-browser, Chromium, `pnpm dev`, bundled Inter loaded): 1902 candidates of at most 27 characters. Widest: `T1 % Armour · T1 Mana Regen` at 177.547px (DOM span) / 177.545px (canvas). Next: `T1 % Mana · T1 Elem Atk Dmg` at 175.27px. `CHASE_CELL_BUDGET = 178` (rounded up) in `packages/web/src/list/ranked-list/chase-count.ts`. Three cells show from a list width of 960px, a frame of 1008px.
- Browser check: frame 1000 and 1007 show 2 cells on all 8 crafted rows; 1008 and 1120 show 3. A hovered cut cell at 1120 opens the full text in the raised shell, mod text `rgb(136,136,255)`. The last row has a transparent rule, and an open last row's panel has no rule.
- `chase-count.ts` sits in `list/ranked-list/` because `list/` is at its 25-file cap.

## Spec Change Log

- Iteration 1 (intent_gap, triage rows 1-2). Trigger: in state 35, a raw branch of 20 rows or fewer dropped its last-row rule, so no hairline separated it from the crafted branch. Amended: the frozen last-row Boundaries line now applies at the list end or above show-more, not at every branch end (human ruling; the human chose to amend and patch in place, not revert). Known-bad state avoided: two branches run together with no rule. KEEP: everything else in commits `c100e17` and `ee826e8`, including the per-branch show-more case, the open-panel case and the `last` props.

## Review Triage Log

Iteration 1 (baseline `5e5e673`, layers: blind, edge-case, verification-gap, ledger, design).

| # | Layer | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | design, blind | State 35: the raw branch's last row (≤ 20 rows, no show-more) and its open panel drop their rule, so no hairline separates the two branches | medium | `Branch` sets `isLast` per branch; nothing else draws a boundary between the two `data-list-branch` divs. DESIGN *Density* says "last row of a list"; EXPERIENCE L90 lists state 35's branch boundary as an unruled gap; the frozen line says "each branch" | intent_gap (group A) |
| 2 | verification-gap | No test mounts two branches, so a per-list vs per-branch `isLast` regression ships silently | medium | `chase-and-rules.test.tsx` mounts one branch only; `crafted-states.test.tsx` asserts no rules | intent_gap (group A, the test follows the ruling) |
| 3 | edge-case, design, blind | A cell cut by under ~0.5px shows an ellipsis but opens no tooltip (integer `scrollWidth`/`clientWidth`) | low | Real in Chromium, but needs an overrun inside one rounding step; the fix replaces the frozen `scrollWidth > clientWidth` check with Range measurement | reject (rare, fix adds mechanism) |
| 4 | edge-case | Tooltip state goes stale if the list resizes while the pointer rests on a cell | low | Needs a resize under a resting pointer; fix adds an observer | reject (rare, fix adds mechanism) |
| 5 | edge-case | First render at a narrow width paints three cells for one frame before the observer sets two | low | Count starts at 3; the RO update is a default-lane React update scheduled after paint. Met on every narrow load; fix seeds the count in the ref callback | patch |
| 6 | edge-case | `reasonAge` prints fractional or negative minutes | false | Its only input is the contract's `WholeCountSchema` (whole, ≥ 0), filled by `Math.floor` over a clamped age in core | reject |
| 7 | blind | B's candidate set covers only `T1`, but `data/tracked.json` holds 197 `T1-T2` tiers | maybe-false | Frozen Q1 says "each led by T1". An estimate with guessed `2`/`-` advances puts the widest `T1-T2` candidate of ≤ 27 chars at ~178.6px vs B 178: at most ~1px per cell, a ≤ 3px boundary shift. Settle by measuring `T1-T2` candidates in the browser. If true, only low | reject (would only be low) |
| 8 | blind | The spec is untracked, so committing it lands after the ledger-removal commit | medium | `git status` shows `??`; `7ea1467` already removes the entries; AGENTS.md wants the removal in the last commit | patch (commit order at finalize) |
| 9 | blind | `ClassExpansionPanel`'s `last` path is untested (`many(3)` gives raw rows) | low | Only `RawExpansionPanel` is reached in the last-row-open test; one added case covers it | patch |
| 10 | blind | No test for the tooltip in two-cell mode or for hovering an empty slot | low | Both render the same `ChaseCell`, and an empty slot is a plain div with no handler | reject |
| 11 | blind | Teardown clears `observers` itself, so a missing `disconnect()` would pass | low | `afterEach` calls `observers.clear()`; one assertion fixes it | patch |
| 12 | blind | "leaves the row cursor as it is" is vacuous | low | It reads the cell's inline `cursor`, which nothing sets; the row cursor lives in `list.css` | patch (drop it) |
| 13 | blind | `pixels()` gives NaN if a token stops being px | low | Every `col-*` and `chase-gap` token is a px string today; a guard adds code for an unshown state | reject |
| 14 | blind | `CUT_TONES` comment is cryptic and cites no owner | low | "fall under the floor on the raised step" names no source; DESIGN `chase-cell.cutHover` owns it | patch |
| 15 | blind | Implementation Notes do not record the AD-17 check; older specs still say days | low | The fix edits this spec or done specs | reject (spec edit) |
| 16 | blind | Manual-check screenshots are described, not attached | low | The fix edits this spec | reject (spec edit) |
| 17 | blind | Tests call 952/1072 "frames", but they are inner (list) widths | low | DESIGN gives frame = inner + 48; a direct rename | patch |
| 18 | ledger | Colouring the row's own tier and joiner is carved out with no ledger entry | medium | Boundaries *Never* carves it out; `deferred-work.md` has no entry | defer |

Iteration 2 (re-review after the iteration-1 patches; same five layers).

| # | Layer | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 19 | verification-gap, blind | The pre-paint seed in `useChaseCellCount` is never run by a test | medium | jsdom gives no client rects, and every count assertion follows `resizeListTo` | patch |
| 20 | design, blind | `CUT_TOOLTIP_OFFSET.crossAxis: -9` puts the tooltip text 1px right of the cell text, and the number is not tied to the shell | low | `MARK_TOOLTIP_SHELL` in `theme.ts` has a 1px border plus 9px padding, and the border-box edge sits at −9, so the text lands at +1 | patch |
| 21 | design | The `last` prop comments still say "last visible row of its branch" | low | `isLast` now follows the ruling: the list end or the row above show-more | patch |
| 22 | edge-case | The integer `clientWidth` seed can disagree with the fractional `contentRect` within 0.5px of the bound | low | Needs a list width inside one rounding step of 960px; at worst a one-frame flip | reject (rare) |
| 23 | edge-case | A failing `observers.size` assertion in `afterEach` skips the cleanup after it | low | Only bites while a test already fails; capturing the size, cleaning up and then asserting is a direct reorder | patch |
| 24 | edge-case | The ledger removal is not the branch's last commit | medium | carried: row 8 | patch (commit order at finalize) |
| 25 | blind | State 35: raw row 20 drops its rule above show-more, then the crafted branch follows | false | Conforms to the iteration-1 human ruling ("or when show-more follows it"); the affordance and its padding sit between the branches | reject |
| 26 | blind | DESIGN `expansion-panel.borderBottom` has no last-row exception, and the show-more ruling lives only in the spec | low | DESIGN *Density* names only "the last row of a list". The panel and show-more cases are in no owner doc. Per the Review brief a reviewer does not edit DESIGN.md | defer ([NOTE FOR UX]) |
| 27 | blind | The measured B is not written back into DESIGN or EXPERIENCE | false | The spec makes B a named web constant that cites *Measure at build*; the code owns the value (AGENTS.md owner rule), and the 27-character filter stays the Q1 decision | reject |
| 28 | blind | The B candidate set leaves out `T1-T2` | maybe-false | carried: row 7 | reject (would only be low) |
| 29 | blind | The cut-cell tooltip has no keyboard or touch path | low | Ruled out by EXPERIENCE *Accessibility Floor* (keyboard paths); AGENT-WORKFLOW Review brief rule 1 | reject |
| 30 | blind | Every filled cell mounts its own Mantine `Tooltip` | low | A closed Mantine Tooltip renders no floating node; no measured cost, and the fix restructures the cell | reject |
| 31 | blind | The `CELL_WIDTH = 175` comment describes a three-cell column at a 952px list width, which shows two cells | low | `chaseCellCount(952)` returns 2; the iteration-1 comment rewrite is wrong | patch |
| 32 | blind | No cut-cell test in two-cell mode | low | carried: row 10 | reject |
| 33 | blind | EXPERIENCE L1192 ties an all-league condition to `tried N hours ago` | low | "All league" means days have passed. A concrete day form, as L1135 gives, is a direct correction inside the Q2 edit set | patch |
| 34 | blind | The spec's Code Map line numbers are stale | low | The fix edits this spec | reject (spec edit) |

## Verification

**Commands:**
- `pnpm check` -- expected: pass

**Manual checks:**
- agent-browser: screenshots at frame 1000 and 1120 (three versus two cells), a cut-cell tooltip, the last-row rule gone, and the B measurement recorded in Implementation Notes.
