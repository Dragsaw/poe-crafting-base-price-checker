---
title: 'Story 4.4: The expansion — one line per entry, top lines and the trust reasons'
type: 'feature'
created: '2026-10-10'
status: 'done'
baseline_commit: '23243200214eac8c334b1a1a30e15fed2d255184'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-4-context.md'
  - '{project-root}/docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/EXPERIENCE.md'
  - '{project-root}/docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The expansion still has the paper layout. It has a fixed 1012px box, an h4 title with a unit glyph, a sub-line, and two-line combination rows with state glyphs, a sample column and two age columns. It ignores the per-entry `trust` that `core` returns on `summands` and `combinations`, never shows pruned entries, and opens every line at once.

**Approach:** Rebuild the panel and its lines on `DESIGN.md` `expansion-panel` / `expansion-line`. The panel holds a context line, then one 32px line per non-pruned entry in `core`'s order, cut to the top 8 lines with `+ N more combinations` / `− show fewer`, then `+ N pruned`. Each line shows its combination, price or `—`, the inline trust cell (`<mark> <word> · <reason>` in the *expansion-line* reason column) and the ↗. All strings come from the `EXPERIENCE.md` Copy Deck and *Price trust*.

## Boundaries & Constraints

**Always:**
- Line order is `core`'s: `row.summands` (by contribution), then `row.combinations` (below-threshold, then pending, then broken). A raw row expands to one line with no combination text.
- A summand line prints its price, and its trust cell follows its `trust`. A priced combination (verdict `current` or `rough`) is below the threshold: it is dimmed, prints only `below threshold`, and has no mark (state 20). A pending or broken line prints `—` and its mark, word and reasons.
- Expansion-line reasons differ from the row tooltip only for `no-listings`: `tried N days ago · no listings`. Ages print only inside a reason (FR-12). The three `not-yet-synced` causes keep distinct words (FR-9).
- `* pinned` leads a pinned line's combination. Pruned entries of the class come from the Tracked List, by canonical key. They sit behind `+ N pruned` and are struck through, led by `† pruned`, with price `—`, an empty trust cell, no link, and a second line holding the prune reason (states 9, 10).
- Top 8: a panel with more than 8 non-pruned lines shows 8 and `+ N more combinations`, where N excludes pruned lines. A panel with 8 or fewer shows all of them and no affordance (state 39). The remainder and pruned toggles are local to the panel and reset when it closes. Open panels stay open across a re-rank.
- The context line holds the full name in its rarity colour. A `uniform-prior` row continues it with the ≈ sentence (state 12).
- ↗ follows `tradeSearchHref` (FR-33, AD-24), is drawn as SVG, and opens in a new tab. The mark is the only target. With no link the cell is empty.
- `web` reads `trust` from `core`. It derives no verdict, no cut-off and no below-threshold test of its own beyond the summand/combination split.

**Never:**
- Changes to `core`, `contracts` or `sync`.
- Header controls (4.5). List statements, the recipeless group of state 43, the appendix restyle, and the deletion of `UniformPriorBanner`, `KeyBlock`, `TrustStrip`, `RunningFoot` and `TrustMark` (4.6).
- A tooltip, ellipsis or hover state inside the panel.
- A Copy Deck string or a token value copied as a literal into a test that can import it.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Priced, current | summand, current | price, empty trust cell, ↗ (state 1) | N/A |
| Rough | summand, old 4 and thin 2 | price, `◐ rough · priced 4 days ago · only 2 listings` | N/A |
| Below threshold, rough | combination, rough | dimmed, `below threshold` only, no mark (state 20) | N/A |
| No listings | days 2 | `—`, `○ pending · tried 2 days ago · no listings` (state 2) | N/A |
| Not yet synced | never-synced / league-mismatch / no-exchange-rate | `—`, ○ with three distinct reasons, no age (states 5–7) | N/A |
| Broken | unresolvable | `—`, `✕ broken · gone after a patch` (state 4) | N/A |
| Pinned | status pinned | `* pinned` leads the combination (state 9) | N/A |
| Pruned | 2 pruned in the class | `+ 2 pruned`. Opened: struck through, `† pruned`, `—`, reason line, no ↗ (state 10) | N/A |
| 11 lines, 2 pruned | open panel | 8 lines, `+ 1 more combinations`, `+ 2 pruned` | N/A |
| Estimated odds | `uniform-prior` | context line `<name> · ≈ Some roll odds …` | N/A |
| Raw Base | raw row | context line with the base name; one line: price or `—`, trust cell, ↗ | N/A |
| Foreign search | `lastSearchId` from another league | empty link cell | N/A |

</frozen-after-approval>

## Code Map

- `packages/web/src/list/ExpansionPanel.tsx` -- `ExpansionPanel` L41, `RawExpansionPanel` L94, `ClassExpansionPanel` L114, `rawCombination` L13, `craftedCombination` L27. Rebuild these. Drop the `layout.contentWidth` box, the h4, `UnitGlyph` and the sub-line. `contentWidth` stays for the appendix until 4.6.
- `packages/web/src/list/CombinationRow.tsx` -- the two-line row (`Combination` L27, `CombinationRow` L66). Replace it with a one-line `expansion-line` in `list/expansion/`. Keep `CombinationText` L43, so tiers stay `{typography.tier}`. Delete the file if it has no readers left, and lower `OVER_CAP['packages/web/src/list']` in `test/directory-structure.test.ts` to match.
- `packages/web/src/list/display-rows.ts` -- `craftedDetail` L144 rebuilds its own order and ignores `core`'s trust. `CraftedCombination` L91 should carry `trust`, the price, a below-threshold flag (a member of `row.combinations` whose verdict is `current` or `rough`) and the dataset `entry`. Use `row.summands` then `row.combinations` as the order. Add the class's pruned entries: `tracked`, crafted, same `classKeyOf`, `status === 'pruned'`, with `prunedReason`. `trackedByClass` L134 excludes pruned via `craftedClassesOf`. Drop `ages` / `combinationAges` and `craftedCombinationNote` when they lose their readers. `DisplayRow.trust` already exists for raw rows.
- `packages/web/src/list/row/trust-words.ts` -- add the expansion-line reason words (only `no-listings` differs; with `days` unset, print `no listings`) and a line-form `<word> · <reason>` helper. Reuse `VERDICT_WORDS`, `TRUST_JOINER` and `rowReasonWords`.
- `packages/web/src/marks/marks.tsx` -- `VerdictMark` L52 and `EstimateMark` L61 for the line form. Add a drawn ↗ there, and retire `frame/TradeGlyph.tsx` and `glyphs.tradeLink` / `REGULAR_ONLY_GLYPHS` if they lose their last reader.
- `packages/web/src/list/format.ts` -- `BELOW_THRESHOLD_NOTE`, `STATE_NOTES`, `NO_AFFIXES`, `rawPanelSubLine`, `classPanelSubLine`, `PANEL_ASKING_SENTENCE`, `RAW_NO_RECIPE_SENTENCE`. Align them to the Copy Deck (`below threshold`, curation marks, the ≈ context sentence, the show-more forms). Delete the ones that lose their readers.
- `packages/web/src/theme/tokens.ts` -- `combinationLine1Columns` L164, `combinationLine2Columns` L173 and `columnWidths.combinationLine1/2` L157 become the `expansion-line` grid: combination 1fr · price 90 · trust `expansion-trust-cell` · link 24, `col-gap`, padding-right 16, indent `expansion-indent`, height `line-height-expansion`. Test: `tokens.test.ts`.
- `packages/web/src/list/trade-link.ts` -- `tradeSearchHref` L12. Reuse it unchanged.
- `packages/web/src/shared/product.ts` -- add `TOP_LINES = 8` beside `TOP_ROWS`.
- `packages/web/src/list/RankedList.tsx` -- `open: Set<string>` L43. Mount the panel with a key so that its local toggles reset when it closes.
- `packages/web/src/list/KeyBlock.tsx` -- delete only the key lines that describe a panel cell this story removes.
- Tests: `list/expansion.test.tsx`, `list/expansion/{open-set,raw-base-combination-row,trade-link}.test.tsx` (helpers `list/expansion/test-support.ts`: `line1`, `line2` go), `recipe/craft-recipe/{crafted-panel,chase-cells,provenance-banner}.test.tsx`, `recipe/craft-recipe.test.tsx`, `App/{list-statement,page-chrome,unrankable-appendix}.test.tsx`, `list/display-rows.test.ts`, `list/combination-fit.test.ts` and `list/tracked.data.test.ts`. The last two fit the longest pinned text in the combination cell at `content-min`, about 464px. Shared helpers: `test-support/dom.tsx`, `test-support/list-fixtures.ts`.
- New files go in `packages/web/src/list/expansion/`. `list/` is at its cap.

## Tasks & Acceptance

**Execution:**
- [x] `list/row/trust-words.ts` (+ test) -- expansion-line reason words and the line-form trust text -- *Price trust* expansion column.
- [x] `marks/marks.tsx` (+ test) -- drawn ↗ -- DESIGN.md `trade-link`.
- [x] `theme/tokens.ts`, `tokens.test.ts`, `shared/product.ts` -- the expansion-line grid, `TOP_LINES` -- DESIGN.md `expansion-line`, state 39.
- [x] `list/display-rows.ts` (+ test) -- `core`'s order and trust per line, the below-threshold flag, pruned entries with their reasons -- FR-8, FR-9, FR-15.
- [x] `list/expansion/*` (new), `ExpansionPanel.tsx`, `RankedList.tsx` -- the context line, the line, the pruned line, the show-more look, the top-8 cut and the toggles -- states 1–10, 12, 20, 39.
- [x] `format.ts`, `KeyBlock.tsx`, `CombinationRow.tsx`, `frame/TradeGlyph.tsx`, `test/directory-structure.test.ts` -- remove what lost its readers.
- [x] The tests in the Code Map -- re-pin them to the new panel, and add one test per I/O matrix row.

**Acceptance Criteria:**
- Given any open panel, when every colour is ignored, then each line's trust state, below-threshold status, pinned and pruned status still read from a word, a mark silhouette or the strike (NFR-10).
- Given an open panel, when the threshold or the recipe changes, then the panel stays open and re-renders its lines and its remainder count in the same pass.
- Given a panel, when it is searched, then it holds no tooltip, no ellipsis and no hover state other than the ↗ accent.
- Given `pnpm check`, when it runs, then it is green.

## Implementation Notes

- The implementation subagent stalled twice on Serena MCP calls that never returned. The main session finished the tests with the built-in edit tools and converted 18 files that the subagent had saved with CRLF back to LF.
- `display-rows.test.ts` passed the 300-line cap, so the crafted-line tests live in `list/expansion/crafted-lines.test.ts`. `test-support/dom.tsx` now exports `rerender`.
- `KeyBlock.tsx` is unchanged: none of its key lines describes a panel cell this story removes.
- Browser check (agent-browser, frozen data, 1280px): 55 open lines, all 32px, none overflowing. The longest reason, `rough · priced 5 days ago · only 2 listings`, clears the ↗ by at least 23px. Panels open on 8 lines with `+ N more combinations` before `+ N pruned`.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|---|
| 1 | design | Trust cell is flex, so the reason span's leading space before `·` collapses | medium | patch | A flex item starts its own line box; `nowrap` still strips leading white space. Fixed: the cell is inline and the mark is `inline-flex`; the browser check reads `rough · priced …` |
| 2 | edge, blind, gap | `tried 0 days ago` under a day; *Ages* asks for hours or minutes | medium | defer | core's `no-listings` reason carries whole days only and this story may not change core; the *Price trust* table and *Ages* disagree. Logged as a [NOTE FOR UX] in deferred-work.md |
| 3 | edge, blind | `tried 1 days ago` | low | patch | `lineReasonWords` had no singular. Fixed with `plural()`, tested in `trust-words.test.ts` |
| 4 | edge, blind | `+ 1 more combinations` has no singular | false | reject | The frozen I/O matrix writes `+ 1 more combinations` as the expected output |
| 5 | edge | Pruned list reopens expanded after its count drops to 0 and returns | false | reject | The pruned set comes from the Tracked List, which changes only on a reload, and a reload remounts the panel |
| 6 | blind, gap | A re-rank through 8 or fewer lines resets the grown remainder although the panel stays open | low | patch | The spec resets the toggles only when the panel closes. Deleted the reset; `expansion.test.tsx` covers the round trip |
| 7 | edge | The asking-price sentence left the panel | false | reject | EXPERIENCE.md *The expansion*: no title and no sub-line; the footer legend carries the framing (Story 4.6) |
| 8 | edge | `KeyBlock.tsx` is named in the task list but unchanged | false | reject | The task removes only key lines that describe a removed panel cell; there are none |
| 9 | blind | `toDisplayRows` JSDoc reads `isBelowThreshold out` | low | patch | A rename hit the comment; it now names `belowThreshold` |
| 10 | gap, blind | The `RankedList` comment credits the `key` for the toggle reset; no test closes and reopens a panel | low | patch | The reset comes from the closed row unmounting its panel. Comment corrected; the unmount is structural, so no test was added |
| 11 | blind | No fit test for the trust cell | maybe-false | reject | The browser check measured the longest reason at 23px clear of the ↗; no overflow on 55 lines |
| 12 | blind | Panel spacings are px literals, not tokens | low | reject | No user impact; moving them adds surface. DESIGN.md values are transcribed as written |
| 13 | blind | Tier, joiner and trust-word colours are untested | low | reject | A test gap with no observed defect; the browser check shows the colours |
| 14 | blind | `CombinationText` re-parses the tier from display text | low | reject | Carried over from the old `CombinationText`; no current short form breaks it |
| 15 | blind | `prunedReason ?? ''` hides a contract break | low | reject | The contracts schema refuses a pruned entry with no reason, so the fallback is unreachable |
| 16 | blind | A below-threshold line with no stored entry prints `—` | false | reject | core judges a combination priced only from a priced active-league dataset entry, so the join cannot miss |
| 17 | blind | Spec and sprint status disagree; the logs are empty; `last_updated` went backwards | low | patch | Sprint status follows the spec at step 5; the logs are filled here; `last_updated` is reset at the step-5 sync |
| 18 | blind | The show-more toggles have no `aria-controls` | false | reject | AGENT-WORKFLOW.md Review brief rule 1: the Accessibility Floor rules out ARIA additions |
| 19 | ledger | Every carved-out item has a ledger entry | false | reject | Zero findings |

## Design Notes

- The epic's open gap *an expansion whose every line is pruned* cannot occur. `craftedClassesOf` forms a class from non-pruned entries only, and the raw ranking excludes pruned bases, so no such row exists to open. Record this in the PR and do not add a string for it.
- `+ N more combinations` comes before `+ N pruned`. The pruned affordance shows whether the remainder is open or not. Both use the one show-more look (accent text, `+` / U+2212, no chrome).
- An expansion line has no hover state. Only ↗ turns accent.

## Verification

**Commands:**
- `pnpm check` -- expected: green.
- `pnpm --filter @poe/web test` -- expected: the new expansion tests pass.

**Manual checks:**
- Use agent-browser with a named session against `pnpm dev`. Open a crafted row with more than 8 lines, a rough row, a pending raw row and a `uniform-prior` row. Expand the remainder and the pruned lines, take screenshots, and measure that the longest reason clears the ↗.
