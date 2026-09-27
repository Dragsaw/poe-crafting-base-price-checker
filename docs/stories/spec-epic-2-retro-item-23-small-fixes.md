---
title: 'Epic 2 retro item 23: small fixes (coverage floor and clamp, grown reset, appendix unitLabel, frame flex column)'
type: 'bugfix'
created: '2026-09-27'
status: 'done'
baseline_revision: '5fb836a30832812b83b0efbdbaf35dc2a428623b'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Four small defects from the epic 2 retrospective (`docs/stories/epic-2-retro-2026-09-27.md` F11, F12, F14, F17; action 6; sprint-status `epic-2-retro-item-23-…`). The Sync Report coverage percent rounds, so partial coverage can print `100%` and non-zero coverage `0%` (review E9). `RankedList`'s `grown` state survives a drop to 20 rows or fewer, so a later rise opens the full list unasked (A12, E5). The Unrankable appendix prints `className` raw instead of through `unitLabel` (AD-5, spine "web trims at render time"; A6, E4, V1). Nothing asserts the frame is a flex column, which the page tail's `margin-top: auto` pin depends on (V3).

**Approach:** Floor the coverage percent and clamp a non-zero fraction to at least 1%; reset `grown` whenever `remaining <= 0`; route the appendix class name through `unitLabel`; add tests for each, including an underscore fixture and a frame/tail layout assertion.

## Boundaries & Constraints

**Always:** Coverage stays a fraction in `[0, 1]` on the wire (IMPLEMENTATION-NOTES §3 wire shape); only the displayed percent changes. Omitted coverage keeps its current `not measured` / `unknown` treatment. Keep existing copy, tokens and cell widths unchanged. Follow `test/setup.ts` network-guard convention in any new test file.

**Never:** No change to `packages/core`, `packages/contracts` or `packages/sync`. No new tests that duplicate unit tests at App level beyond the one frame/tail composition assertion (retro F23). Do not measure rendered boxes (F17's browser measurement is retro item 10, deferred). Do not touch raw-row label rendering or other F-findings.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Typical coverage | `coverage: 0.862` | `86% of 29 tracked Item Classes.` | — |
| Near-full | `coverage: 0.996` | `99%` (never `100%`) | — |
| Full | `coverage: 1` | `100%` | — |
| Near-zero, non-zero | `coverage: 0.004` | `1%` (never `0%`) | — |
| Zero | `coverage: 0` | `0%` | — |
| Grown then shrink then grow | 25 rows, grow clicked; rerender 20 rows; rerender 25 rows | 20 rows, no affordance; then 20 rows with `+ Read the remaining 5 rows`, `aria-expanded=false` | — |
| Underscored class | `className: 'Body_Armours_dex_int'` | appendix row prints `Body Armours dex int` | — |

</intent-contract>

## Code Map

- `packages/web/src/frame/trust-facts.ts:184-191` -- `coverageGroup`; line 190 `Math.round(figures.coverage * 100)` is the defect. A small local percent helper fits beside it.
- `packages/web/src/frame/trust-facts.test.ts:135-146,162` -- existing coverage cases (`0.862` → `86%`); add the matrix rows here.
- `packages/web/src/list/RankedList.tsx:27-84` -- `RankedList`; `grown` `useState` at :38, `remaining` at :51, affordance only rendered when `remaining > 0`. Reset during render (`if (grown && remaining <= 0) setGrown(false)`, the React adjust-state-in-render pattern) or equivalent that actually clears state.
- `packages/web/src/list/ranked-list.test.tsx:229-264` -- "the top-20 bound" describe; `many(n)`, `mountList(tracked, dataset)`, `rowsIn(view)`, `expandCopy`, `COLLAPSE_COPY` helpers. The shrink test needs a re-render of the same root with fewer rows (extend `mountList` or render `RankedList` directly with a kept `Root`).
- `packages/web/src/list/UnrankableAppendix.tsx:83-126` -- `AppendixRow`; `{item.className}` at :101 becomes `{unitLabel(item.className)}`; import from `./format`.
- `packages/web/src/list/format.ts:74-76` -- `unitLabel` (replaces `_` with space). Reuse; do not re-implement.
- `packages/web/src/list/unrankable-appendix.test.tsx:31,92-106` -- `klass(className)` fixture; row-text assertion at :97-99 compares to raw `className` (still valid for underscore-free names). Add an underscore case.
- `packages/web/src/frame/Frame.tsx:16-37` -- already sets `display: 'flex'`, `flexDirection: 'column'`; read-only.
- `packages/web/src/App.tsx:151-159` -- `PageTail` with `marginTop: 'auto'`, rendered inside the frame; read-only.
- `packages/web/src/App.test.tsx:69-75` -- `frame()` helper returning `[data-frame]`; host for the one composition assertion.

## Tasks & Acceptance

**Execution:**
- `packages/web/src/frame/trust-facts.ts` -- display percent = `floor(coverage × 100)`, raised to 1 when coverage > 0 and the floor is 0 -- partial coverage never reads 100%, non-zero never 0%.
- `packages/web/src/frame/trust-facts.test.ts` -- add the five coverage matrix rows -- pins E9.
- `packages/web/src/list/RankedList.tsx` -- clear `grown` whenever `remaining <= 0` -- no sticky grown state.
- `packages/web/src/list/ranked-list.test.tsx` -- add the grow → shrink to 20 → grow-back test from the matrix -- pins A12/E5.
- `packages/web/src/list/UnrankableAppendix.tsx` -- print `unitLabel(item.className)` -- AD-5 render-time trim.
- `packages/web/src/list/unrankable-appendix.test.tsx` -- add a `Body_Armours_dex_int` fixture asserting `Body Armours dex int` -- pins V1.
- `packages/web/src/App.test.tsx` -- one test: once ready, `[data-frame]` has `style.display === 'flex'` and `style.flexDirection === 'column'`, and its `[data-page-tail]` child has `style.marginTop === 'auto'` -- pins V3.

**Acceptance Criteria:**
- Given a Sync Report with any coverage in `(0, 1)`, when the trust strip's report panel renders, then its percent is never `0%` and never `100%`.
- Given the ranked list was grown and its rows drop to 20 or fewer, when rows later exceed 20 again, then only the top 20 show and the affordance reads the expand copy.
- Given an unrankable class whose name contains underscores, when the appendix renders, then its row shows the name with spaces.
- Given the page is ready, when the frame renders, then it is a flex column and the page tail carries `margin-top: auto`.

## Spec Change Log

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 14 findings — high 0, medium 0, low 8, false 6, maybe-false 0
- findings:
  - `[low]` `[patch]` (verification-gap) No test reaches the `Math.min(floored, 99)` cap; `1 - 1e-12` would print 100% if it were removed — added rows `[1 - 1e-12, '99%']` and `[0.01, '1%']`.
  - `[low]` `[reject]` (edge-case) Open panel keys on rows 21+ survive the grown reset and reappear on a later expand — pre-existing: the collapse button already leaves `open` untouched (`RankedList.tsx` `toggle`), so the reset matches it; pruning adds state logic for a rare path.
  - `[low]` `[patch]` (blind) The new App test duplicated the tail pin checks at `App.test.tsx:980-982` (retro F23) — folded the two flex assertions into that test and deleted the new `it`.
  - `[low]` `[patch]` (blind) `coveragePercent` JSDoc named the floor as the never-100% guard, but the 99 cap is — reworded the docblock to name all three guards.
  - `[low]` `[patch]` (blind) Matrix lacks the clamp-reaching row and a lower boundary — grouped with the first row; same rows added.
  - `[low]` `[patch]` (blind) Test title "clamped to 1-99 when partial" labelled the 0 and 1 rows; six rows vs five in the spec — title renamed to `prints coverage %s as %s`; the row-count half is a spec edit and is rejected.
  - `[false]` `[reject]` (blind) `unrankable-appendix.test.tsx:97-99` still compares raw `className` — its fixtures have no underscore, so raw equals the label and the assertion is true; the new underscore test pins the label rule.
  - `[false]` `[reject]` (blind) Other views may print a class name raw — the verification-gap layer grepped `packages/web/src`: the only other `className` use of an unrankable class is a React key.
  - `[low]` `[patch]` (blind) The grow → shrink → grow test never asserts the expanded state before the shrink — added `aria-expanded === 'true'` and `COLLAPSE_COPY` assertions after the click.
  - `[false]` `[reject]` (blind) No bookkeeping: spec untracked, sprint-status still open — the spec commits with this change at finalize; retro item 13 (`5fb836a`) likewise left sprint-status to the branch-finish flow.
  - `[false]` `[reject]` (intent) F12 is tested at component level, not through the threshold control — `RankedList` stays mounted at a fixed position in `ReadyBody` (`App.tsx:139`), and the reset depends only on `rows`, so any source of a row drop takes the same path.
  - `[false]` `[reject]` (intent) F17 asserts inline style, not layout — action 6 asks for exactly a jsdom assertion; `frame.css` sets no `display` on the frame; the rendered measurement is retro item 10.
  - `[low]` `[reject]` (intent) The display formula lives only in code, not IMPLEMENTATION-NOTES — a view-level rounding rule the old `Math.round` never documented either; a planning-doc edit is outside this small-fix item.
  - `[false]` `[reject]` (intent) F14's render-time trim is checked only in the appendix — same evidence as the other-views row: no other surface prints an unrankable class name.

## Verification

**Commands:**
- `pnpm test` (or `pnpm vitest run packages/web` while iterating) -- expected: all pass, new cases included
- `pnpm check` -- expected: typecheck, lint, depcruise pass

## Auto Run Result

Status: done

**Summary.** Retro item 23 (epic 2 retro action 6; F11, F12, F14, F17). The coverage percent now floors, lifts a non-zero fraction to at least 1% and caps partial coverage at 99%. `RankedList` clears `grown` when rows drop to 20 or fewer. The Unrankable appendix prints class names through `unitLabel`. A test asserts the frame is a flex column beside the tail pin.

**Files changed.**
- `packages/web/src/frame/trust-facts.ts` -- `coveragePercent` helper used by `coverageGroup`.
- `packages/web/src/frame/trust-facts.test.ts` -- table test over 0.862, 0.996, 1, 0.004, 0, 0.29, 1 - 1e-12 and 0.01.
- `packages/web/src/list/RankedList.tsx` -- adjust-state-during-render reset of `grown`.
- `packages/web/src/list/ranked-list.test.tsx` -- `rerenderList` helper and the grow, shrink, grow-back test.
- `packages/web/src/list/UnrankableAppendix.tsx` -- `unitLabel(item.className)`.
- `packages/web/src/list/unrankable-appendix.test.tsx` -- `Body_Armours_dex_int` fixture.
- `packages/web/src/App.test.tsx` -- flex-column assertions added to the existing tail-pin test.

**Review.** 14 findings: 6 patches applied (all low), 0 deferred, 2 low rejected (the open panel keys, which match the existing collapse behavior; the IMPLEMENTATION-NOTES record, which is a planning-doc edit outside scope), and 6 false. The triage log has the reasons.

**Follow-up review recommended:** false. Patched counts: high 0, medium 0, low 6.

**Verification.** `pnpm check`: typecheck, lint and depcruise pass. `pnpm test`: 88 files, 1165 tests pass. An earlier full run had 2 failures in untouched packages (`sync` price-entry fixtures, root boundary-check). Both passed alone and on every later full run, so they are load flakes. Each I/O matrix row has a passing test.

**Residual risks.** jsdom checks only the declared inline style, not the rendered layout. The browser measurement is retro item 10. The coverage display rule is recorded only in code.
