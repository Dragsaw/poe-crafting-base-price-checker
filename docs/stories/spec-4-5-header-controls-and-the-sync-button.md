---
title: 'Story 4.5: Header controls and the sync button'
type: 'feature'
created: '2026-10-10'
status: 'done'
baseline_commit: 'd6d3d00542bc89aa17cb5ab19b6225fa9de10d53'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-4-context.md'
  - '{project-root}/docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/EXPERIENCE.md'
  - '{project-root}/docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The header bar's three slots are empty. The threshold and recipe panels sit in the interim band below the bar, and sync health hides behind the `TrustStrip` click. The broken count is read from the report's `unresolvable` records, not from the dataset (AD-12).

**Approach:** Fill the slots with the `DESIGN.md` `recipe-toggle`, `threshold-control` (slider plus typed figure) and `sync-button`. The sync button opens a four-column `sync-report-panel` under the header (Interaction 5, state 32). The page stops mounting the interim band and `TrustStrip`. All strings come from the `EXPERIENCE.md` Copy Deck.

## Boundaries & Constraints

**Always:**
- Threshold (Interaction 1; the AC's "Interaction 2" is a misnumbering): the slider snaps to 0.05 and re-ranks at each step with no debounce, and a track click jumps to the nearest step. The typed figure is set to 0.01, re-ranks debounced 150 ms, and is clamped on blur. The range is 0 to 3, there are no negatives, and the two inputs follow each other. Persisted under the existing key. The unset state is the cold-start `DEFAULT_THRESHOLD` (FR-7).
- Recipe: two or more recipes show the segmented toggle, where only the inactive segments are targets. One recipe shows `Recipe` · its word as plain text (state 42). None shows nothing, and the bar keeps its width (state 43). Craft Cost reads `N.NN div / craft`, or `no figure yet` when uncostable (state 35). Nothing costs a recipe at zero (AD-20).
- Problem count (AD-12): the dataset entries in state `unresolvable`, plus the starved entries of the `pinned-starvation` record that matches the loaded curation (`pinnedCount − pinnedRefreshed`, and 1 when that is 0). Stale patch counts nothing. The button leads with ✕ when any counted entry is broken, and with ◐ otherwise. It never shows the age and the count together. Cross-file failures, absent tolerable files and attribution ages never count.
- Healthy shows `Synced <compact age> ▾`. The age is rounded down: `just now`, `Nm`, `Nh`, `Nd ago`.
- Panel: closed on load. It opens under the header and pushes the list down. A second click closes it. A click while the page is scrolled scrolls the page to the top. Height cap 400px, with its own scroll. The columns are `Problems` · `Sync run` · `Weights coverage` · `Built from`. The figures are read as published, and `session-probe` is never rendered. Built from holds the two attribution lines and one `Not published` line per absent tolerable file (state 38). A missing Tracked List date reads `unknown`.
- The header never wraps. The brand block, the three controls and the 22px gaps fit 952px at `content-min`.

**Never:**
- Changes to `core`, `contracts` or `sync`.
- Deleting `TrustStrip`, `KeyBlock`, `RunningFoot` or `UniformPriorBanner` (4.6). List statements, including state 35's (4.6).
- A green dot, `All good` or `0 problems`. A tooltip on the header controls. Copy Deck strings or token values copied as literals into a test that can import them.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Healthy | report 40 min old, no problem | `Synced 40m ago ▾` (state 30) | N/A |
| Broken | 2 dataset entries `unresolvable`, report has 5 old records | `✕ 2 problems ▾` (state 31, 4) | N/A |
| Starved only | matching record, M 6, refreshed 5 | `◐ 1 problem ▾` | N/A |
| Starved, N 0 | matching record, M 6, refreshed 6 | `◐ 1 problem ▾`, plus the N=0 line | N/A |
| Stale record | record's curation differs | healthy button, no problem | N/A |
| Cross-file failure only | 1 failing check | healthy button. The diagnosis is listed and not counted | N/A |
| Drag | slider to 0.40 | re-ranks at each 0.05 step, figure `0.40` | N/A |
| Type | `1.234` then blur | `1.23`, debounced re-rank. `9` clamps to `3.00` on blur | N/A |
| One recipe | 1 published | `Recipe greater`, plain text, with Craft Cost | N/A |
| Uncostable | rate missing | `no figure yet` | N/A |
| Tracked date absent | no `trackedListEditedAt` | `Tracked List last edited unknown` | N/A |
| weights.json absent | tolerable | `Not published` line in Built from, no count | N/A |
| Report absent | no `sync-report.json` | `Not synced yet ▾`, or `✕ N problems ▾` from dataset broken entries. The panel shows `unknown` report figures and the `sync-report.json` absence line | N/A |
| Non-numeric | `abc` then blur | no re-rank. Blur restores the last valid figure | N/A |

**Decisions (2026-10-10, human):**
1. Absent `sync-report.json` → the matrix row above (an `EXPERIENCE.md` open gap, settled here).
2. The problem-list lines ship as drafted, and this PR writes them into the `EXPERIENCE.md` Copy Deck: `✕ N entries can no longer be priced` (`✕ 1 entry can no longer be priced`), `◐ N of M pinned entries are not being refreshed`, and for N = 0 `◐ M pinned entries take every search, so nothing else rotates`. With no problem, the Problems column holds its heading and, if present, the diagnosis.
3. Non-numeric threshold → restore on blur (the matrix row above).
4. The full spec is kept above the token guideline. It is one header-bar goal.

</frozen-after-approval>

## Code Map

- `packages/web/src/frame/HeaderBar.tsx` -- `HeaderBar`, `SLOTS`, `HEADER_SLOT_WIDTHS` (294/238/128, interim). Fill the slots and re-measure the widths. `header-bar.test.tsx` asserts that the slots are empty: re-pin it.
- `packages/web/src/frame/InterimControls.tsx` -- delete it. Move the `HeaderRecipe` type to the recipe slot. `columnSums.interimControls` in `theme/tokens.ts` and `tokens.test.ts:168` go with it.
- `packages/web/src/threshold/PayoutThreshold.tsx` -- a `NumberInput` with `useThresholdDraft` (150 ms debounce, blur restore). Keep that logic and add a Mantine `Slider` (step 0.05, no label, 100px track). Restyle to `threshold-control` with the label `Worth ≥` (≥ drawn as SVG) and the unit `div`. Retire `ThresholdTrack`, `ThresholdRange` and `THRESHOLD_LABEL`. `threshold-storage.ts` stays unchanged.
- `packages/web/src/recipe/CraftRecipe.tsx`, `recipe-view.ts` -- the word toggle becomes `recipe-toggle`. Add the single-recipe plain form. Craft Cost becomes `div / craft` (it is `Divine / craft` today). `recipeCostLine` and `activeRecipe` are reused.
- `packages/web/src/frame/trust-facts.ts` -- `healthSignals` and `countUnresolvable` read the report records. Replace them with a problem summary: `{ broken, starved, kind: '✕' | '◐', lines }`, taking the dataset entries and the curation. `panelColumns` becomes four columns with the new headings, and `lastSynced` stays for Built from. Add a compact age to `shared/time.ts` beside `relativeAge`.
- `packages/web/src/frame/SyncReportPanel.tsx` -- three columns today. Make it four columns per `DESIGN.md` `sync-report-panel`. Fold the attribution lines and `AbsenceLines` into Built from.
- `packages/web/src/frame/SyncButton.tsx` (new) -- the sync button. The open state lives in `App`.
- `packages/web/src/App.tsx` -- `renderPending` and `renderReady`. Wire the controls into `HeaderBar`. Render the panel under it. Drop `InterimControls`, `TrustStrip` and `TrustStripSlot`.
- `packages/web/src/marks/marks.tsx` -- reuse `VerdictMark` for ✕ and ◐.
- Tests to re-pin: `App/{header-bar,page-chrome,payout-threshold,interaction-surface,unresolvable-hand-off,unrankable-appendix}.test.tsx`, `App.test.tsx`, `threshold/*.test.*`, `recipe/craft-recipe.test.tsx` and `recipe/craft-recipe/test-support.tsx`, `frame/trust-facts.test.ts`, and `frame/trust-strip/*`. The `TrustStrip` tests stay until 4.6. Helpers: `test-support/threshold-input.ts`, `test-support/dom.tsx`.
- `docs/stories/deferred-work.md` -- this story discharges the three entries for 4.1 with `retry_when: Story 4.5` (the slots, the width re-measure, the threshold token re-pin). Remove them in the last commit.

## Tasks & Acceptance

**Execution:**
- [x] `shared/time.ts` (+ test) -- the compact age -- Copy Deck *Ages*.
- [x] `frame/trust-facts.ts` (+ test) -- the AD-12 problem summary and the four panel columns -- FR-24, FR-25, FR-18.
- [x] `threshold/PayoutThreshold.tsx` (+ tests) -- `threshold-control` with the slider -- Interaction 1.
- [x] `recipe/CraftRecipe.tsx`, `recipe-view.ts` (+ tests) -- `recipe-toggle`, states 35, 42, 43 -- Interaction 1a.
- [x] `frame/SyncButton.tsx`, `SyncReportPanel.tsx` (+ tests) -- states 30, 31, 32, 38; Interaction 5.
- [x] `frame/HeaderBar.tsx`, `App.tsx`, delete `InterimControls.tsx`, `theme/tokens.ts` -- wiring, slot widths, re-pin the threshold tokens.
- [x] The App tests in the Code Map -- re-pin them, and add one test per I/O matrix row and a width-budget test at `content-min`.
- [x] `EXPERIENCE.md` Copy Deck -- add the problem-list lines from Decision 2 under *Sync report*, and drop them from *Strings drafted at build*.

**Acceptance Criteria:**
- Given a threshold or recipe change, when the list re-ranks, then no request is made, open panels stay open, and the value survives a reload.
- Given the bar at `content-min` with `✕ 999 problems ▾`, two recipes and a cost, then nothing wraps or overflows.
- Given every colour removed, then the problem kind still reads from ✕ / ◐ and the active segment from its weight (NFR-10).
- Given `pnpm check`, then it is green.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | edge, blind | Orphaned TrustStripSlot JSDoc at the end of `TrustStrip.tsx` | low | The comment documents deleted code | patch |
| 2 | blind, design, verification | Segment padding/radius and thumb ring are CSS literals; the `headerControls` tokens are pinned but unread | medium | `segmentPadY/X`, `thumbRing` have no consumer; a DESIGN.md change passes the token test and ships the old value | patch |
| 3 | design | `ABSENCE_LEAD` has a colon the Copy Deck lacks | low | EXPERIENCE.md: "The lead is `Not published`" | patch |
| 4 | blind | Starved-line singulars are not in the Copy Deck | low | `plural` ships `is` / `pinned entry`; the deck row says `N of M pinned entries are` | patch |
| 5 | blind | Bare `unknown` for not-reached with the report absent | low | The line loses its noun, unlike `Requests unknown` | patch |
| 6 | design | Filled sync slot leaves ~50px gap, not DESIGN.md's 22px | low | Fixed slot width plus `flex-end`; header-bar layout gives the free space to the brand block | patch |
| 7 | blind | Banned-word scan strips every `'Worth'` literal | low | `replaceAll` over every source file | patch |
| 8 | blind | Slider bound test is vacuous | low | `every` on zero calls is true | patch |
| 9 | ledger | TrustStrip deletion carved to 4.6 has no ledger entry | medium | Design Notes carve it; no entry names this spec | patch (ledger) |
| 10 | edge, blind, verification | Removed 4.1 re-pin entry still owed `glyphs.prior` | medium | Only test is `not.toContain(glyphs.prior)` | patch (ledger) |
| 11 | edge, blind, verification | Width-budget test sums constants only | medium | jsdom has no layout; a wider control still passes | defer |
| 12 | blind | `epic-4-context.md`: garbled order sentence, two dropped constraints | low | Planning edit made before the baseline, not this build | defer |
| 13 | blind | Slider stops following the `value` prop | false | `usePersistedThreshold` is written only by this control | reject |
| 14 | edge, blind | Slider name, focus ring, `aria-controls`, filled-slot `aria-hidden` test | false | Accessibility Floor: no screen-reader or keyboard path is specified | reject |
| 15 | blind | `Math.max(left, 1)` invents a count | false | Spec Boundaries: "and 1 when that is 0" | reject |
| 16 | edge, blind | `pinnedRefreshed > pinnedCount` prints a false line | low | Sync truncation keeps at most M; a guard adds a branch for unreachable data | reject |
| 17 | edge, blind | Problems column empty on a healthy run | false | Decision 2: heading and, if present, the diagnosis | reject |
| 18 | edge, blind | `✕ 1,000 problems` or three recipes overflow a slot | maybe-false | DESIGN.md budget names `✕ 999 problems` the longest form; no third recipe is designed; low if real | reject |
| 19 | edge | Task names `recipe-view.ts`, diff leaves it unchanged | false | No bad outcome; Craft Cost unit lives in `CraftRecipe.tsx` | reject |
| 20 | blind | Ledger entries removed before 4.5 is done | false | They are removed in the branch's last commit, as the ledger rule says | reject |
| 21 | blind | localStorage written at every drag step | low | Spec persists each change; cost is negligible | reject |
| 22 | blind | "starts closed again after a reload" cannot fail | false | It fails if the open state were persisted | reject |
| 23 | blind | `pressTrackAt` real timers may flake | maybe-false | Low if real; passes in every run so far | reject |
| 24 | blind | Weights and report both absent: Problems lists an uncounted diagnosis | false | Spec: cross-file lines are listed, never counted | reject |

## Design Notes

- `TrustStrip` stops mounting here because the sync button and the panel replace everything it did. Story 4.6 deletes the file and its tests. Until then they test the component in isolation.
- The open state of the panel is lifted to `App`, so that the button and the panel, which sit in different regions, share it. It is not persisted (*What survives a reload*).

## Verification

**Commands:**
- `pnpm check` -- expected: green.

**Manual checks:**
- Run agent-browser with a named session against `pnpm dev` at 1000px and 1080px. Take screenshots of the header in the healthy state and the problem state, and of the open panel. Drag the slider, and check the debounce of the typed figure. Measure the bar against the 952px budget.
