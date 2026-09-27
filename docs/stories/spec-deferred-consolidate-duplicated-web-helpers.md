---
title: 'Consolidate the duplicated web helpers and module homes'
type: 'refactor'
created: '2026-09-27'
status: 'done'
baseline_revision: '5fb836a30832812b83b0efbdbaf35dc2a428623b'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/docs/stories/epic-2-retro-2026-09-27.md'
warnings: ['oversized']
deferred:
  - summary: >-
      [NOTE FOR UX] DESIGN.md `listCopyClosed` (`+ Read the remaining {N} rows`) has no singular form, but the page now prints `+ Read the remaining 1 row` for one hidden row; DESIGN.md should spell the singular so the owner doc and the code agree.
    evidence: |-
      Epic 2 retro action item 11 (P5 calls "1 rows" a bug) ordered one pluralize helper. `expandCopy` in `packages/web/src/list/RankedList.tsx` now uses `plural` from `packages/web/src/shared/text.ts`, and `ranked-list.test.tsx` asserts the singular at 21 rows. The story 2.3 `[NOTE FOR UX]` entry on "1 rows" described the reverse drift (code verbatim from DESIGN.md) and can close with this one. The same applies to the provisional Sync Report panel singulars (`1 tracked entry was`, `1 entry is`, `1 pinned-starvation record`, `pinned entry`, `tracked Item Class`) under the story 2.6 panel-copy entry.
    location: >-
      packages/web/src/list/RankedList.tsx
    severity: low
---

<intent-contract>

## Intent

**Problem:** Epic 2 left `packages/web` with duplicated helpers (age formatters and time constants, 2dp money spellings, `NBSP`, fixed-cell styles, ad-hoc pluralization that prints "1 rows" / "1 entries"), duplicated test helpers (`rgb`, `mountList`/`rowsIn`, `NOW`), product constants homed in `list/format.ts`, list and threshold styles homed in `frame/frame.css`, and an `App.test.tsx` that repeats unit tests (retro F22, F23, F24, P5).

**Approach:** Give each shared helper one home under a new `packages/web/src/shared/` folder and each shared test helper one home under `test-support/`, repoint every caller, move the list and threshold CSS next to their components, add one tested pluralize helper and use it for every count-plus-noun, and delete the `App.test.tsx` tests whose assertion a unit test already makes.

## Boundaries & Constraints

**Always:** Rendered output stays byte-identical except the singular forms listed in the I/O matrix. Every value keeps its current owner-doc citation comment. Callers import from the new home directly (no re-export shims left in `list/format.ts`, `frame/trust-facts.ts` or `ColumnHeader.tsx`). `pnpm check` and `pnpm test` pass.

**Never:** No change to `docs/stories/deferred-work.md`, `sprint-status.yaml`, DESIGN.md, EXPERIENCE.md, the PRD or the spine. No change to the literal word `Divine` or where it comes from (a separate retro entry owns the denomination source). Do not move `TradeGlyph` or `ColumnHeader` out of their folders, and do not change token values. Do not merge the three age formatters into one output format: they print three different ruled copies (48h stale mark, exact `h`/`d` age, relative `minutes/hours/days ago`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| One hidden row | 21 ranked rows | `+ Read the remaining 1 row` | — |
| Many hidden rows | 22 ranked rows | `+ Read the remaining 2 rows` (unchanged) | — |
| One not reached | `notReachedCount` 1 | `1 tracked entry was not reached in the last sync pass.` | — |
| Zero / many not reached | 0 or 3 | `0 tracked entries were not reached…` / `3 tracked entries were…` (unchanged) | — |
| One unresolvable | 1 `unresolvable` record | `1 entry is unresolvable.` | — |
| One starvation record | 1 `pinned-starvation` record | `1 pinned-starvation record.` | — |
| Existing pluralizers | `1 listing`, `1 minute ago`, `1 Item Class` | unchanged output, now via the shared helper | — |

</intent-contract>

## Code Map

- `packages/web/src/list/format.ts` -- `TOP_ROWS`:14, `DEFAULT_THRESHOLD`:17, `HOUR_MS`:31, `BELOW_PRINTABLE`/`formatDivine`:29-39, `ageMark`:55 (48h stale mark, list-specific, stays), `sampleText`:152 (pluralizes `listing`), `exactAge`:167, `rawPanelSubLine` threshold `toFixed(2)`:215.
- `packages/web/src/frame/trust-facts.ts` -- `NBSP`:14, `MINUTE_MS/HOUR_MS/DAY_MS`:52-54, `unitAgo`/`relativeAge`:56-72, `panelColumns`:150 (the "entries"/"records" copy).
- `packages/web/src/list/list-statement.ts:20` -- threshold `toFixed(2)`.
- `packages/web/src/threshold/PayoutThreshold.tsx:24` -- `formatThreshold` (`toFixed(THRESHOLD_DECIMALS)`); imports `frame/frame.css`.
- `packages/web/src/threshold/threshold-storage.ts:8` -- imports `DEFAULT_THRESHOLD` from `list/format` (the F22 threshold→list edge).
- `packages/web/src/list/RankedList.tsx:12` -- `expandCopy` ("1 rows"); imports `TOP_ROWS` and `frame/frame.css` (for `.fg-affordance`).
- `packages/web/src/list/RankedRow.tsx:1` -- imports `frame/frame.css` for `.fg-row`.
- `packages/web/src/list/ColumnHeader.tsx:25` `cellStyle`, `list/CombinationRow.tsx:45` `cell` + `NBSP`:55, `list/UnrankableAppendix.tsx:23` `cell` -- three fixed-cell helpers; `appendixCount`:17 pluralizes `Item Class`.
- `packages/web/src/frame/frame.css` -- `.fg-affordance` (FailureScreen + RankedList), `.fg-trade-glyph`, `.fg-row*` (list), `.fg-threshold*` (threshold), `.fg-strip-affordance`/`.fg-trust-strip` (frame).
- Tests: `rgb` in `App.test.tsx:948`, `frame/trust-strip.test.tsx:28`, `list/expansion.test.tsx:18`, `list/ranked-list.test.tsx:21`, `list/unrankable-appendix.test.tsx:11`, `threshold/payout-threshold.test.tsx:17`; `mountList`/`rowsIn` in `ranked-list.test.tsx:39,51` and `expansion.test.tsx:37,53`; `NOW` in 7 files (5 at `2026-09-26T12:00Z`, `trust-facts.test.ts` 15:00, `trust-strip.test.tsx` 21:32 mirroring the committed report's run).
- `packages/web/src/App.test.tsx` -- repeats: `:603` (vs `payout-threshold.test.tsx:167`), `:847` and `:878` (vs `list-statement.test.ts`), `:1025` and `:1038` (vs `packages/core/src/rank.test.ts:365,387`).

## Tasks & Acceptance

**Execution:**
- `packages/web/src/shared/product.ts` -- new: `TOP_ROWS`, `DEFAULT_THRESHOLD` with their FR comments; repoint all importers (source and tests).
- `packages/web/src/shared/time.ts` -- new: `MINUTE_MS`, `HOUR_MS`, `DAY_MS`, `exactAge`, `relativeAge`; `list/format.ts` `ageMark` and `trust-facts.ts` use them; delete the local copies.
- `packages/web/src/shared/text.ts` -- new: `NBSP`, `plural(count, singular, pluralForm)`; replace both `NBSP` copies and every ad-hoc `count === 1 ?` noun choice (`sampleText`, `unitAgo`, `appendixCount`, `expandCopy`, `panelColumns` notReached/unresolvable/starvation lines with verb agreement).
- `packages/web/src/shared/money.ts` -- new: `BELOW_PRINTABLE`, `formatDivine`, `formatThreshold` (2dp); `rawPanelSubLine`, `list-statement.ts` and `PayoutThreshold.tsx` use `formatThreshold`.
- `packages/web/src/shared/cell.ts` -- new: one `fixedCell({ width, padRight })`; `ColumnHeader.cellStyle` spreads it and adds `textAlign`; the two local `cell` functions are deleted.
- `packages/web/src/shared/affordance.css`, `list/list.css`, `threshold/threshold.css` -- move `.fg-affordance`, `.fg-row*`, `.fg-threshold*` out of `frame/frame.css` verbatim with their comments; each component imports its own sheet; `list/` and `threshold/` no longer import `frame/frame.css`.
- `packages/web/src/test-support/dom.ts(x)` -- new: `rgb`, `NOW`, `mountList`, `rowsIn`, and the mount/unmount bookkeeping `mountList` needs; repoint the test files. `trust-facts.test.ts` adopts the shared `NOW` by shifting its fixture instants; `trust-strip.test.tsx` keeps its report-mirroring clock renamed (not `NOW`) with a one-line reason.
- `packages/web/src/shared/*.test.ts` -- tests for `plural`, and move the `exactAge`/`relativeAge`/`formatDivine` unit tests next to their new home; add the I/O-matrix singular cases to `ranked-list.test.tsx` / `trust-facts.test.ts`.
- `packages/web/src/App.test.tsx` -- delete each listed repeat only after confirming its unit counterpart makes the same assertion; keep any composition-only part.

**Acceptance Criteria:**
- Given the web source, when grepping for `HOUR_MS =`, `NBSP =`, `toFixed(2)`, `function cell(` and `count === 1 ?`, then each has at most one definition, in `shared/`.
- Given `list/` and `threshold/` sources, when grepping imports, then none imports `frame/frame.css`, and `threshold/` imports nothing from `list/`.
- Given the test sources, when grepping, then `const rgb`, `function mountList`, `function rowsIn` appear only in `test-support/`, and `const NOW` only there.
- Given `pnpm check` and `pnpm test`, when run, then both pass.

## Design Notes

The singular copy follows the retro's human-accepted action item 11 (P5 calls "1 rows" and "1 entries" bugs). DESIGN.md `listCopyClosed` has no singular form, so record a deferred item that DESIGN.md should spell `+ Read the remaining 1 row`.

## Verification

**Commands:**
- `pnpm check` -- expected: exit 0
- `pnpm test` -- expected: exit 0

## Spec Change Log

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 35 findings — high 0, medium 4, low 27, false 3, maybe-false 1
- findings:
  - `false` `reject` (ledger audit) The DESIGN.md singular-copy carve-out has no `deferred-work.md` entry — the invocation makes the caller maintain the ledger; the item is in this spec's frontmatter `deferred`, which the deferred-work sweep appends to the ledger when it closes the entry.
  - `low` `reject` (blind) `CombinationRow` cells now emit `flex: 0 0 <W>px; min-width: 0` instead of `flex: 0 0 auto` — layout-equivalent: each cell has a specified width, `box-sizing: border-box` and `flex-shrink: 0`, so basis and size are unchanged; restoring it would re-split the one helper the intent asks for.
  - `low` `reject` (blind) `cellStyle` drops `padding-right: 0px` on the Provenance and Age cells — zero padding and no padding render the same; no test or reader depends on the attribute string.
  - `low` `patch` (blind) 2dp precision has two sources (`toFixed(2)` vs `THRESHOLD_DECIMALS`) — added `MONEY_DECIMALS` in `shared/money.ts`; `THRESHOLD_DECIMALS = MONEY_DECIMALS`.
  - `low` `patch` (blind) `formatDivine` calls the threshold-named formatter — both now call the neutral `formatTwoDecimals`.
  - `low` `reject` (blind) Two appendix App tests were deleted whole — the intent names `:1025`/`:1038` as repeats of `rank.test.ts:365/387`; the rendered title and count stay covered by `unrankable-appendix.test.tsx` and the remaining App appendix tests.
  - `medium` `patch` (blind) Deleting the nothing-clears copy assertion lost the only App-level proof that the typed threshold reaches the statement — assertion restored.
  - `medium` `patch` (blind) The emptied-field test lost the page-level no-re-rank and blur-to-0.25 checks — original test restored verbatim.
  - `low` `reject` (blind) `trust-strip`, `unrankable-appendix` and `payout-threshold` tests still hand-roll mount/teardown — the intent lists `mountList`/`rowsIn`, not generic mounting; no named breakage.
  - `low` `patch` (blind) `mount` leaks a root when called twice — `mount` now calls `unmount()` first.
  - `low` `reject` (blind) `test-support/dom.tsx` mixes generic and list-specific helpers — the only cost is import time in a few test files; no rule or caller breaks.
  - `low` `patch` (blind) The NBSP test uses an invisible U+00A0 literal — now asserts length 1 and `codePointAt(0) === 0xa0`.
  - `low` `patch` (blind) `affordance.css` copies the `frame.css` header verbatim — replaced with a short header of its own that cites `frame.css` for the token-only rule.
  - `low` `reject` (blind) The spec has no check behind "byte-identical" — fix edits this build's spec.
  - `low` `reject` (blind) The spec's `deferred` item has no named path to the ledger — fix edits this build's spec; the sweep appends it.
  - `low` `reject` (blind) The spec's Code Map is stale after the diff — fix edits this build's spec.
  - `low` `patch` (edge) Double `mount` leaks — same fix as above.
  - `low` `patch` (edge) `formatThreshold` hardcodes 2 while `THRESHOLD_DECIMALS` drives the input — same fix as above.
  - `low` `reject` (edge) Combination-row style attribute changed — layout-equivalent, as above.
  - `low` `reject` (edge) Header/row Provenance and Age lose `padding-right: 0px` — renders the same, as above.
  - `low` `reject` (edge) The empty-Tracked-List App test was deleted with its `expectChromeAround()` — the intent names `:878` as a repeat; `expectChromeAround()` still runs in the other list-statement App tests, and an empty list takes the same chrome path.
  - `medium` `patch` (edge) The typed-threshold to statement-text wiring is untested — assertion restored.
  - `low` `patch` (edge) The NBSP comment lost the CombinationRow mockup `.ps-*::before` citation — citation added to `shared/text.ts`.
  - `medium` `patch` (verification-gap) No page-level check that the nothing-clears statement prints the live threshold — assertion restored.
  - `low` `reject` (verification-gap, other) Inline styles are not byte-identical — layout-equivalent, as above.
  - `low` `patch` (verification-gap, other) `formatThreshold` no longer tied to `THRESHOLD_DECIMALS` — same fix as above.
  - `low` `patch` (intent) Panel still prints `of 1 pinned entries refreshed` and `of 1 tracked Item Classes` — both pluralized by their count, with tests; `league validation requests` is left: its noun is shared by two counts, so a singular is a copy ruling.
  - `low` `reject` (intent) Panel singulars are tested on the pure `panelColumns` output, not the mounted panel — the panel renders those segments verbatim and `trust-strip.test.tsx` covers the wiring.
  - `false` `reject` (intent) UX-owned copy changed without a halt — epic 2 retro action item 11, accepted by a human, orders the helper for the "1 rows"/"1 entries" bugs; the DESIGN.md sync is carried as a deferred item.
  - `false` `reject` (intent) `min-width: 0` lets an unbreakable word overflow where `min-width: auto` let the cell grow — with a specified width the automatic minimum is at most that width, so the old cell never grew either.
  - `low` `patch` (intent) 2dp precision spelled in two places — same fix as above.
  - `low` `reject` (intent) `HOUR = 3_600_000` remains in `test-support/list-fixtures.ts` — test-only, and the intent counts source constants.
  - `low` `reject` (intent) No test enforces the web folder import graph, and the CSS moves are not browser-checked — the intent asks for the moves, not an enforcement test; selectors and class names are unchanged and each sheet is imported by its component.
  - `maybe-false` `reject` (intent) Only the cited App tests were audited against "composition only" — settle by auditing the other ~40 App tests; if true it is low (a slower suite), so rejected.
  - `low` `reject` (intent) The deleted appendix tests asserted page DOM while `rank.test.ts` asserts core output — as above: the intent names them as repeats and the component tests cover the DOM.

## Auto Run Result

Status: done

**Summary:** Each duplicated `packages/web` helper now has one home under `src/shared/`. `product.ts` holds `TOP_ROWS` and `DEFAULT_THRESHOLD`. `time.ts` holds the clock units, `exactAge` and `relativeAge`. `text.ts` holds `NBSP` and `plural`. `money.ts` holds `MONEY_DECIMALS`, `formatTwoDecimals`, `formatThreshold` and `formatDivine`. `cell.ts` holds `fixedCell`. The list and threshold styles moved out of `frame/frame.css`: `.fg-row*` to `list/list.css`, `.fg-threshold*` to `threshold/threshold.css` and `.fg-affordance` to `shared/affordance.css`. Every count-plus-noun goes through `plural`, which fixes "1 rows", "1 entries", "1 records", "1 pinned entries" and "1 tracked Item Classes". The test helpers (`NOW`, `rgb`, `mount`, `unmount`, `mountList`, `rowsIn`, `cellIn`) live in `test-support/dom.tsx`. `App.test.tsx` drops the tests that repeat unit tests (`:878`, `:1025`, `:1038`).

**Files changed:**
- `packages/web/src/shared/{product,time,text,money,cell}.ts` + tests: the new shared homes.
- `packages/web/src/shared/affordance.css`, `list/list.css`, `threshold/threshold.css`: the CSS moved out of `frame/frame.css`.
- `packages/web/src/frame/trust-facts.ts`: uses the shared time and text helpers, with singular panel copy.
- `packages/web/src/list/{format,list-statement}.ts`, `ColumnHeader`, `CombinationRow`, `RankedList`, `RankedRow`, `UnrankableAppendix`, `display-rows.ts`: repointed to the shared helpers.
- `packages/web/src/threshold/{PayoutThreshold.tsx,threshold-storage.ts}`: shared product constant, formatter and decimals.
- `packages/web/src/test-support/dom.tsx` + 10 test files: the shared test helpers, repointed tests and the new singular cases.
- `packages/web/src/App.test.tsx`: the repeat tests removed.

**Review:**
- 35 findings. 11 patch rows were applied as 8 fixes: 4 at medium (all restorations of App-level assertions) and the rest at low.
- 0 items were deferred from review.
- The rejected findings and their reasons are in the triage log above.

**Follow-up review recommended: false.** The two medium entries patched both restore the original App assertions verbatim, and those assertions pass, so no unverified risk remains to name. Patched counts by entry verdict: medium 2 (statement wiring, emptied-field page checks), low 6.

**Verification:** `pnpm check` exits 0 (eslint clean, depcruise reports no violations). `pnpm test` exits 0: 93 files, 1163 tests. Both ran after the review patches. The matrix audit found a test for every I/O row: `ranked-list.test.tsx` (21 and 22 rows), `trust-facts.test.ts` (1, 0 and 3 counts, starvation, pinned and coverage singulars), `expansion.test.tsx`/`format.test.ts` (`1 listing`), `time.test.ts` (`1 minute ago`) and `unrankable-appendix.test.tsx` (`1 Item Class`).

**Residual risks:**
- The inline style strings of the combination-row and header cells changed (`flex` basis, `min-width`, `padding-right: 0px`). By the flexbox rules the layout is the same, but no one checked it in a browser.
- The CSS moves are not observable in jsdom.
- DESIGN.md has not yet been given the singular copy (carried as a deferred item).
