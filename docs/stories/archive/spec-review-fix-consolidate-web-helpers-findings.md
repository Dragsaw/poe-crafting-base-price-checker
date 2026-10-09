---
title: 'Fix the review findings on the web helpers consolidation'
type: 'bugfix'
created: '2026-09-27'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/spec-deferred-consolidate-duplicated-web-helpers.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The code review of `78db4da..ec38dce` left two `[Review][Patch]` findings on `spec-deferred-consolidate-duplicated-web-helpers.md`. The Sync Report panel prints "1 league validation requests" because the noun does not go through `plural` (`packages/web/src/frame/trust-facts.ts:141`). The `formatDivine` docblock names the threshold, but the threshold goes through `formatThreshold`, which has no `< 0.01` floor (`packages/web/src/shared/money.ts:19`).

**Approach:** Agree "request"/"requests" with the league-validation figure through `plural`, and update the two tests that assert the old string. Correct the `formatDivine` docblock to name only EV and price. Tick both findings in the source spec.

</frozen-after-approval>

## Implementation Notes

- The noun agrees with the league-validation figure, the figure it follows. The panel copy stays provisional; UX owns its final wording (deferred-work story 2.6 panel-copy `[NOTE FOR UX]`).
- Changed `panelColumns` in `packages/web/src/frame/trust-facts.ts` and the `formatDivine` docblock in `packages/web/src/shared/money.ts`. Updated the singular string in `trust-facts.test.ts` and `trust-strip.test.tsx`. Added many and zero request-line assertions, and a `money.test.ts` case that shows `formatThreshold` has no `< 0.01` floor. Ticked both findings in the source spec. `pnpm check` passes. `pnpm test` passes 1188 tests.

## Review Triage Log

- `low` defer (blind) The one trailing noun agrees with only the league-validation figure, so "10 tracked list · 1 league validation request" can read as one request in total. The copy is UX-owned and provisional, so a `[NOTE FOR UX]` ledger entry was added.
- `low` defer (blind) The story 2.6 panel-copy ledger entry quotes the old string. The same new ledger entry records the change, and older entries stay unedited.
- `low` patch (blind) The zero request line was untested. Added a `0 … requests` assertion.
- `false` (blind) There is no test for mixed tracked/league counts. The copy question is deferred to UX, so a test would pin wording that is not yet ruled.
- `low` patch (blind) No test shows that `formatThreshold` has no floor. Added `formatThreshold(0.004)` → `0.00` next to `formatDivine(0.004)` → `< 0.01`.
- `false` (blind) The spec is left `in-progress`. The finalize step sets it to `done`.
- `low` reject (blind) The frozen intent cites line numbers. These are the review's own citations, which record where the defect was found.
- `low` reject (blind) The ticked source findings do not link to this spec. Git history and this spec's `context` link them.
- (ledger audit) Zero findings.
