---
title: 'Step nextOnGrid past a midpoint that is not an exact double'
type: 'bugfix'
created: '2026-11-15'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-7-retro-2026-11-15.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic 7 retro action item 2 (finding ECH-1). `nextOnGrid((0.7+0.1)/2, 1, 2)` returns 0.4, not 0.45. The float midpoint 0.39999999999999997 is not the double of the decimal 0.4, so `nextOnGrid` takes it as off-grid and returns the shared value. The own interval of the tier above then still meets the tier below, against AD-11.

**Approach:** In `packages/core/src/probability/value-grid.ts`, treat a value within a small tolerance of a grid value as on that grid value, so it steps once. An off-grid value (at least half a grid step away) still lands on the next grid value. The result stays `k / steps`, the decimal's own double. Add a unit test for `nextOnGrid((0.7+0.1)/2, 1, 2) === 0.45`, plus the on-grid and off-grid cases.

</frozen-after-approval>

## Implementation Notes

**Agent browser checks:** exempt. The page cannot change: a scan of the committed `data/weights.json` found 954 two-range lines and no midpoint whose float sum differs from its exact decimal (scratchpad `scan.mjs`), so `nextOnGrid` returns the same value for every committed tier before and after the fix. The retro says the same ("The committed data hits none of them").

- `packages/core/src/probability/value-grid.ts` -- `nextOnGrid` is now `(floor(highest * steps + ON_GRID) + 1) / steps` with `ON_GRID = 1e-6` grid units. Every `highest` that `deriveOwnInterval` passes is an interval end: a literal, or the midpoint of two literals of at most `digits` decimals. So it is on the grid within a few ulps, or half a step off it. The tolerance cannot mistake either case. Negative values step correctly (`floor`).
- `packages/core/src/probability/value-grid.test.ts` (new) -- the ECH-1 case, midpoints a few ulps below and above the grid, on-grid and off-grid cases, negatives. `own-interval.test.ts` gains the ECH-1 case through `ownInterval`: the high tier's own minimum is 0.45, off the tier below. Exact doubles are asserted through `toEqual` on a structure, as `own-interval.test.ts` does, because `sonarjs/no-floating-point-equality` refuses `toBe` with a float literal. Both ECH-1 tests fail on the old code (checked by restoring the HEAD `value-grid.ts`).
- `docs/stories/sprint-status.yaml` -- action item 2 → `done`, as item 1 did.
- `pnpm check` -- 8 passed, 0 failed, after review. One run in between failed only `tools/dev-stop/stop-listeners.test.ts` (a control character in the live process-list JSON); that file passed twice alone and the next full run passed.

## Review Triage Log

Layers: Blind Hunter, Deferred Ledger Auditor (zero findings), OCR delegate (zero findings). Impeccable design review skipped: no file under `packages/web/src/`.

- BH-1 no `ownInterval`-level ECH-1 test -- low, patched: case added to `own-interval.test.ts`; it fails on the old code.
- BH-2 only the below-the-grid side of the tolerance tested -- low, patched: `(0.1+0.2)/2 → 0.2` and `(0.3+0.6)/2 → 0.5` added.
- BH-3 `ON_GRID` does not name its unit -- low, patched: the comment says "In grid steps (`highest * steps`)".
- BH-4 spec status `in-progress` while the tracker says `done` -- false: finalization sets `done`; the oneshot template has no `baseline_commit`.
- BH-5 the scan evidence lives in the scratchpad -- low, patched: the evidence goes into the commit message. A data-test assertion is rejected: with the fix, an inexact midpoint is handled, so there is nothing to guard.
- BH-6 `{ min }` wrapper in a scalar test -- low, patched: arrays throughout.
- BH-7 missing Code Map and Boundaries; preconditions in `interval` (two ranges read, `hashes = ranges.length`) and `fractionDigits` (exponent notation) -- Code Map/Boundaries false (the oneshot route deletes them). More than two ranges: false, `WeightsLineSchema` caps `ranges` at `.max(2)` (`packages/contracts/src/weights-file.ts:54-58`, OQ-19). Exponent notation in `fractionDigits`: low, rejected. It predates this change, it needs a range endpoint under 1e-6, and the committed `data/weights.json` has none.
- Gate flake (found during finalization, not by a reviewer) -- one full `pnpm check` failed only `tools/dev-stop/stop-listeners.test.ts` on the live process-list JSON. It predates this change, so it is deferred to `deferred-work.md`.
