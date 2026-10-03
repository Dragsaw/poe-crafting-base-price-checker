---
title: 'Epic 3 retro item 29, second half: formatDivine never prints -0.00'
type: 'bugfix'
created: '2026-10-03'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
---

<intent-contract>

## Intent

**Problem:** `(-0.001).toFixed(2)` is `"-0.00"`, so `formatDivine` and `formatThreshold` print `-0.00` for a tiny negative value (retro item 29, second half). The first half landed in 679aae2.

**Approach:** `formatTwoDecimals` prints `0.00` when the rounded figure is zero, whatever the sign. Both callers share it. A negative figure that rounds to a non-zero value keeps its sign.

</intent-contract>

## Implementation Notes

- `packages/web/src/shared/money.ts` -- `formatTwoDecimals` maps a `-0.00` result to `0.00`.
- `packages/web/src/shared/money.test.ts` -- cases for `-0.001`, `-0.0049`, `-0`, and `-0.01` (keeps its sign).
- Oneshot: one function and its test, no owner document changes.
