---
title: 'Story 2.5: Row expansion — the evidence behind a row, its tombstones and its trade link'
type: 'feature'
created: '2026-09-26'
status: 'done'
baseline_revision: 'fb3b2d83ee8bb93e228e020b97c9199b8c4b1f21'
route: 'dispatch'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/docs/stories/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A click on a ranked row toggles `data-open` and the sepia marker, but nothing opens under it. The player cannot see the Price State, the listing count, both exact ages or the trade search behind a rank.

**Approach:** Render `{components.expansion-panel}` in place under every open row. It holds a title, a context sub-line and `{components.combination-row}` entries, and it has a `{components.trade-link}` when the stored search qualifies. `web` already holds the data. Thread the dataset entry, the curation status and the active league through `DisplayRow` into the panel.

## Boundaries & Constraints

**Always:**
- The epics.md Story 2.5 ACs are normative for every surface this story renders. DESIGN.md `expansion-panel`, `combination-row`, `price-state-glyph`, `money-slot`, `trade-link` and `curation-status-pinned` own the look. The mockup `key-expanded-states.html` (lines 171-261, Raw Base panel 489-500) owns the geometry. Add the missing panel and column tokens to `theme/tokens.ts`, and assert the column sums against `columnSums.combinationLine1/2`.
- Panel: joins flush under its row (the row's `rule-strong` bottom is the panel's top edge), no animation, not a modal. Many panels can be open. Only a second click on its own row closes a panel. Growing or collapsing the list never changes the open set. This settles deferred-work L173: a hidden open row reappears open.
- Title: the row's unit glyph (sepia), then the unit name. Sub-line: the Raw Base copy from mockup lines 489-493, with the row's own Item Level, the active threshold at 2dp, and the canonical sentence `Every price here is a current asking price from a live instant-buyout listing.` Omit the Craft Recipe sentence. Story 3.4 extends the line and does not rewrite it.
- Raw Base panel: exactly one combination row. Line one reads `no affixes`, led by `* pinned ` when the status is `pinned`, then the glyph + the state word (with ` · <reason>` for not-yet-synced), the figure at 2dp or `< 0.01` or the money phrase, and the sample (`N listings`, `1 listing`, `0 listings found`, `no sample`). Line two is the note plus `priced …` in the observed cell and `tried …` in the attempted cell. The panel shows exact ages with no 48h cut-off: `< 1h`, then `Nh` under 24h, then `Nd`. A missing clock leaves its cell empty.
- Notes are verbatim from EXPERIENCE.md states 2, 5, 6 and 7. The priced note is `no affixes — this Base Type priced as it drops, at Item Level {itemLevelMin}`.
- Trade link: shown only when `lastSearchId` is present, `lastSearchLeague` equals the active league, and the status is not pruned. Never read Price State for this test. URL per IMPLEMENTATION-NOTES §5.4, with the league segment alone passed through `encodeURIComponent`. Reuse `frame/TradeGlyph`. A click on it does not toggle the row. When the link does not qualify, the cell is blank.
- Nothing truncates, ellipsises or tooltips inside a combination row. Line two wraps in 20px steps.
- **Decisions (2026-09-26):**
  - The crafted-only ACs are deferred to Epic 3 in `deferred-work.md`: the crafted entry list, the below-threshold note, the `unresolvable` row, the tombstone band and its removal date, and the tier + short-form text with its mono fallback. `CombinationRow` takes one entry, and `ExpansionPanel` takes a list, so Epic 3 adds rows and does not rewrite them.
  - A never-synced entry leaves both age cells empty.
  - On an unpriced raw row, the state note replaces the raw note.
- Tests stay offline. No request fires on expand or on a link click.

**Never:**
- No change to `core`, `contracts` or `vite.config.ts`. No new artifact fetch. No key-block entries for `† pruned` / `* pinned` (the `[NOTE FOR UX]` at deferred-work L161 stays open). No Craft Recipe text.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Priced raw | priced 0.8, 10 listings, observed 11h, tried 11h, search in league | `● priced`, `0.80`, `10 listings`, raw note, `priced 11h ago`, `tried 11h ago`, `↗` | N/A |
| Tiny price | priced 0.003 | `< 0.01` | N/A |
| No listings | no-listings, tried 3h | `○ no-listings`, *an open question*, `0 listings found`, state-2 note, observed empty, `tried 3h ago` | N/A |
| Never synced | not-yet-synced/never-synced | `∆ not-yet-synced · never-synced`, *no figure yet*, `no sample`, state-5 note, both age cells empty, no link | N/A |
| League mismatch | observation from the old league | `· league-mismatch`, state-6 note | N/A |
| Old-league search | `lastSearchLeague` ≠ active | blank link cell | N/A |
| League with spaces | `Forbidden Rites` | `…/poe2/Forbidden%20Rites/{id}` | N/A |
| Pinned | status pinned | line one starts `* pinned no affixes` | N/A |
| Two open, grow | open rows 3 and 22, collapse and regrow | both panels still open | N/A |

</frozen-after-approval>

## Code Map

- `packages/web/src/list/RankedList.tsx` -- `open: ReadonlySet<string>` keyed by `row.key` (L26), `toggle` (L28-36), `grown` (L25). Render the panel after each open `RankedRow`. Do not reset `open` on grow or collapse.
- `packages/web/src/list/RankedRow.tsx` -- the whole row div is the click target (L51). The open state is `data-open` + `openRowMarker` + a `rule-strong` bottom (L42-62). The panel sits under that rule.
- `packages/web/src/list/display-rows.ts` -- `DisplayRow` (L15-27) and `toDisplayRows(ranking, dataset, now)` (L43), which builds `byKey` from the dataset. Add the dataset entry (`price`, `lastAttemptedAt`, `lastSearchId`, `lastSearchLeague`), the `status` and the `itemLevel`. Keep the ordering untouched.
- `packages/web/src/list/format.ts` -- reuse `MONEY_PHRASES`, `formatDivine`, `BELOW_PRINTABLE`, `rawNote` (fix it to take `itemLevelMin`) and `unitLabel`. Add the exact-age formatter beside `ageMark`.
- `packages/web/src/list/UnitGlyph.tsx`, `frame/TradeGlyph.tsx` (`↗`, weight 400, `target=_blank rel=noopener`) -- reuse both.
- `packages/web/src/App.tsx` -- `ReadyList` (L120-139) calls `rank` and `toDisplayRows`, and has the threshold and the config league. Pass the threshold and the active league down to `RankedList`.
- `packages/contracts/src/dataset.ts` -- `PriceStateSchema` (L30), `NotYetSyncedReasonSchema` (L17), `DatasetEntrySchema` (L61); `observation.sampleSize`. Read only.
- `packages/web/src/theme/tokens.ts` -- `columnSums` (L136), `stacks.mono` (L150), the type roles `panel-title`, `panel-sub`, `detail-row`, `detail-meta`, `combination-line-2`, and glyphs. Add the panel padding `18/22/20`, the `4/13` sub margins, the col-combination-* widths, `pad-combination-cell-right` 12, `detail-row-height` 28, `combination-row-line-2-height` 20, and `combination-row-height` 48 (a minimum).
- `packages/web/src/frame/frame.css` -- `.fg-trade-glyph` hover precedent.
- `packages/web/src/list/ranked-list.test.tsx` (`mountList`, `rowsIn`, `cell`, `many`, `rgb`; the toggle test at L161) and `test-support/list-fixtures.ts` (`priced` sets no search fields: add an optional one).
- `docs/architecture/.../IMPLEMENTATION-NOTES.md` §5.4 (L636-646) -- the trade URL form.

## Tasks & Acceptance

**Execution:**
- [x] `packages/web/src/list/trade-link.ts` (+ test) -- `tradeSearchHref(entry, activeLeague)`: undefined unless all three conditions hold; the league-only encoding.
- [x] `packages/web/src/list/format.ts` (+ test) -- exact ages, the sample copy, the state word + reason, the notes, and the sub-line text.
- [x] `packages/web/src/theme/tokens.ts` (+ test) -- the panel and combination tokens; the widths sum to 966.
- [x] `packages/web/src/list/display-rows.ts` (+ test) -- the detail fields on `DisplayRow`.
- [x] `packages/web/src/list/CombinationRow.tsx`, `ExpansionPanel.tsx` -- the panel, and a generic two-line row.
- [x] `packages/web/src/list/RankedList.tsx`, `App.tsx` -- render open panels; pass the threshold and the league.
- [x] `packages/web/src/list/expansion.test.tsx`, `App.test.tsx` -- the matrix rows, the column sums, multiple open panels, the open set surviving collapse and regrow, a link click not toggling the row, and no request on expand or click.

**Acceptance Criteria:**
- Given the committed `data/` under `pnpm dev`, when the player clicks two rows in agent-browser (named `--session`), then both panels open in place and match the mockup geometry. Each priced row's `↗` points at a `Forbidden%20Rites` search, and no request fires.
- Given `pnpm check` and `pnpm test`, when they run, then both pass.

## Implementation Notes

- The exact ages are computed in `toDisplayRows` (field `ages`), against the same `now` as the Age cell, so `now` does not need to be threaded to `RankedList`.
- `tradeSearchHref` takes `{ lastSearchId, lastSearchLeague, status }`: the dataset entry has no status, so the caller spreads the entry and adds the tracked status.
- The observed cell shows `priced …` only when the printed state is `priced`. A league-mismatched entry has an `observedAt`, but its observed cell stays empty, as in the mockup's state-6 specimen.
- The trade-link cell has no right padding. The mockup's `.k5` has none, although DESIGN.md says "12px on every cell". The mockup owns geometry, and a 24px cell less 12px would crowd the glyph.
- Browser check (agent-browser, committed `data/`, port 5185): two panels, each 1012 wide and 0px under its row. Padding 18/22/20. Line cells 460/250/116/116/24 and 560/200/206, 966 each. Combination row 48px. `↗` goes to sepia on hover at weight 400. Both links are `…/poe2/Forbidden%20Rites/…`. The request count did not change across expand, panel clicks and close. The committed data has only two rows, so grow and collapse are covered by the unit tests only.

## Spec Change Log

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 30 findings — high 0, medium 0, low 14, false 15, maybe-false 1
- findings:
  - `[low]` `[patch]` (ledger) The grow/collapse agent-browser check was not done and had no ledger entry — appended a `deferred-work.md` entry naming the >20-row condition that settles it.
  - `[low]` `[patch]` (ledger) The trade-link cell has 0 padding, following mockup `.k5` against DESIGN.md "12px on every cell", with no ledger entry — appended a `[NOTE FOR UX]` entry to `deferred-work.md`.
  - `[low]` `[patch]` (verification-gap) No test asserted `* pinned` on an unpriced row — the implementation subagent added a pinned no-listings + pinned never-synced case to `expansion.test.tsx`, and it passes.
  - `[low]` `[patch]` (blind) `sprint-status.yaml` said `ready-for-dev` while the spec is in review — set to `review`, as the 2.2–2.4 build commits did.
  - `[low]` `[reject]` (blind) The spec's manual check asks for a grow/collapse check that two committed rows cannot exercise — the fix edits this build's spec. The gap is carried by the ledger entry above.
  - `[false]` `[reject]` (blind) The link-click test "cannot fail" — false: if the panel were nested inside the row, the click would bubble to `onToggle` and the `data-open` assertion would fail. The test pins the sibling layout that makes the AC hold.
  - `[false]` `[reject]` (blind) `lastSearchId` is not encoded — IMPLEMENTATION-NOTES §5.4 and the frozen intent require the league segment alone to be encoded. The id is stored verbatim from the trade API.
  - `[false]` `[reject]` (blind) `exactAge` prints `< 1h` for an unparseable clock — both clocks are `IsoTimestampSchema` (`z.iso.datetime()`, `packages/contracts/src/primitives.ts:15`), so `NaN` is unreachable from a parsed artifact. The future-clock case is deliberate and tested.
  - `[false]` `[reject]` (blind) The nowrap line one could spill over — every day-one text (`* pinned no affixes`; `∆ not-yet-synced · no-exchange-rate` at 10.5px sans in 238px) is a mockup specimen at these exact widths. The Epic 3 short-form measurement is logged as a ledger entry.
  - `[false]` `[reject]` (blind) The 9px glyph and the 600 pinned weight bypass tokens — no named harm. The values are the mockup's `.ps-*::before` and DESIGN.md `curation-status-pinned`, and no token owns them to diverge from.
  - `[false]` `[reject]` (blind) No `aria-expanded` / region wiring — EXPERIENCE.md (Accessibility Floor, L1057-1082) puts screen-reader behaviour and keyboard paths out of scope, so this is conformant.
  - `[low]` `[reject]` (blind) No test changes the threshold with a panel open — the sub-line derives purely from the `threshold` prop, and `rawPanelSubLine` is tested at two thresholds. An App-level test adds cost for a negligible risk.
  - `[low]` `[reject]` (blind) The committed-data App test will break when Story 2.7 changes `data/` — the failure is loud and names the data. The test mirrors the AC's own "committed `data/`" surface.
  - `[low]` `[reject]` (blind) The matrix omits no-exchange-rate / pruned / `1 listing` — the fix edits this build's spec. All three are tested.
  - `[false]` `[reject]` (blind) The `rawNote` "fix" is only a rename — its callers pass `itemLevel`, which is the entry's `itemLevelMin`, so no wrong-field fault exists. The rename is the whole fix the Code Map asked for.
  - `[maybe-false]` `[reject]` (edge-case) A threshold drop keeps the key in `open`, so the row reappears open — consistent with the intent's open-set rule ("a hidden open row reappears open"). If it is a defect it is only low, and the fix adds an effect. Settled by a UX ruling on threshold-hidden rows.
  - `[false]` `[reject]` (edge-case) A never-synced entry with a stored search shows a link — the intent forbids reading Price State for the link test. A never-synced entry has had no answered search, and an answered search is the only thing that sets `lastSearchId` (`dataset.ts` L53-57).
  - `[false]` `[reject]` (edge-case) The id is unencoded — same refutation as the blind finding: §5.4 mandates league-only encoding.
  - `[false]` `[reject]` (edge-case) `NaN` age reads `< 1h` — same refutation: `IsoTimestampSchema`.
  - `[false]` `[reject]` (edge-case) The nowrap cell overflows — same refutation: every day-one text is a mockup specimen at these widths.
  - `[false]` `[reject]` (intent) Geometry is tested via inline styles, not rendered — the AC's surface is the agent-browser check, which ran (Implementation Notes: 1012 wide, 0px under the row, 966 lines, 48px).
  - `[false]` `[reject]` (intent) The no-truncation test reads inline styles only — no class CSS on the row sets overflow or ellipsis (`frame.css` `.fg-trade-glyph` sets only colour on hover), and day-one texts fit.
  - `[low]` `[reject]` (intent) The title glyph uses `UnitGlyph` (11.5px, 14px box, 4px margin) against the mockup's 11px + 8px margin — the visual gap is under 1px, the Code Map says to reuse `UnitGlyph`, and the fix adds a parameter.
  - `[false]` `[reject]` (intent) The league travels as a `RankedList` prop, not on `DisplayRow` — no bad outcome. The league is list-wide, and the App test proves it reaches each link.
  - `[low]` `[reject]` (intent) The never-synced override is tested only in `format.test.ts` — `combinationAges` is the only path to the cells, and it is tested with a stamped clock.
  - `[low]` `[patch]` (intent) DESIGN.md and the mockup disagree on trade-link padding — grouped with the ledger finding. Covered by the `[NOTE FOR UX]` entry.
  - `[low]` `[reject]` (intent) New-tab opening is not exercised — jsdom cannot open tabs. `target="_blank"` and `rel="noopener"` are asserted, and so are no `fetch` and no `window.open`.
  - `[low]` `[patch]` (intent) Sprint status vs spec status — grouped with the blind finding. Set to `review`.
  - `[false]` `[reject]` (intent) Deferred-work L173 stays in the file — AGENTS.md: only `deferred-work-sweep` removes an entry.
  - `[low]` `[patch]` (intent) The 460px `* pinned` + longest short-form measurement AC was not named in the ledger — appended a `deferred-work.md` entry.


## Verification

**Commands:**
- `pnpm check` -- expected: typecheck, lint and depcruise clean.
- `pnpm test` -- expected: all green, no escaped-request failures.

**Manual checks:**
- Run `pnpm dev` in the background. With agent-browser: open two panels and take a screenshot; hover `↗`; measure the line widths (966) and the panel padding; grow and collapse the list; stop the server.

## Auto Run Result

Status: done

**Summary.** A click on a ranked row now opens `{components.expansion-panel}` in place under it. The panel holds the sepia unit glyph and the name, the Raw Base context sub-line (with no Craft Recipe sentence), and one generic `{components.combination-row}`. That row shows the Price State glyph and word (with its reason), the figure or money phrase, the sample, the verbatim note, both exact ages, and the qualifying trade link (`↗`, league segment alone encoded). Many panels can be open. The open set survives grow and collapse.

**Files changed**
- `packages/web/src/list/trade-link.ts` (+ test): `tradeSearchHref`, the three-condition link test and the §5.4 URL.
- `packages/web/src/list/format.ts` (+ test): exact ages, labelled ages, the sample text, the state word, the glyphs, the figure, the notes and the sub-line.
- `packages/web/src/theme/tokens.ts` (+ test): the panel padding and sub margins, the combination heights, the cell padding, and the line-1/line-2 column arrays summing to 966.
- `packages/web/src/list/display-rows.ts` (+ test): `DisplayRow` gains `status`, a resolved `state`, `entry` and `ages`.
- `packages/web/src/list/CombinationRow.tsx`, `ExpansionPanel.tsx`: new. A generic one-entry row, and a panel that takes a list.
- `packages/web/src/list/RankedList.tsx`, `App.tsx`: render the panel under each open row, and pass the threshold and the active league.
- `packages/web/src/list/expansion.test.tsx`, `App.test.tsx`, `ranked-list.test.tsx`, `test-support/list-fixtures.ts`: the matrix rows, the geometry, the open set, the link isolation, and a committed-data end-to-end.
- `docs/stories/deferred-work.md`: three crafted-only entries (from planning) and three review entries: the browser grow/collapse check, the UX note on trade-link padding, and the 460px short-form measurement.
- `docs/stories/sprint-status.yaml`: story 2.5 to `review`.

**Review findings.** 30 findings: 0 high, 0 medium, 14 low, 15 false, 1 maybe-false.
- **Patched (low, 8 rows in 6 entries):**
  - a pinned-unpriced test;
  - the sprint-status fix;
  - three ledger entries.
- **Deferred:** none by route. The three ledger entries record the carved-out work.
- **Rejected:** 22 rows, each with its reason in the Review Triage Log. In summary:
  - Spec-edit fixes (2).
  - §5.4 league-only encoding (2).
  - `IsoTimestampSchema` rules out `NaN` ages (2).
  - Day-one texts are mockup specimens at these widths (3).
  - The EXPERIENCE.md Accessibility Floor.
  - A threshold-hidden row reappearing open is consistent with the open-set rule (maybe-false, low if true).
  - Cosmetic or negligible gaps: the title glyph under 1px, the helper-only never-synced override, new-tab in jsdom, the threshold-change test, and 2.7 data fragility.

**Follow-up review recommended:** false. The patched entries are 0 high and 0 medium.

**Verification.**
- `pnpm check` is clean: tsc, eslint with zero warnings, and depcruise.
- `pnpm test`: 76 files, 968 tests pass, none skipped, no escaped requests. The count includes the post-review test.
- The matrix audit passes: every one of the 9 matrix rows has a covering test that ran and passed.
- The implementation subagent ran the manual browser check with agent-browser (named session, `pnpm dev --port 5185`, committed `data/`):
  - two panels, each 1012 wide and flush under its row, padding 18/22/20;
  - lines of 460/250/116/116/24 and 560/200/206;
  - a 48px row;
  - `↗` turns sepia on hover at weight 400;
  - both links go to `Forbidden%20Rites`;
  - no new request.

**Residual risks.**
- Grow and collapse with open panels have not been seen in a browser: the committed data has 2 rows. This is a ledger entry.
- The DESIGN.md/mockup trade-link padding disagreement waits on a UX ruling. This is a ledger entry.
- A row hidden by a threshold change reappears open when it returns. This is untested and has no ruling.
