---
title: 'rank refuses a Payout Threshold that is not a finite number ≥ 0'
type: 'bugfix'
created: '2026-09-27'
status: 'done'
baseline_revision: 'c6b576c9f21a9937bbbfd1528afdd7b880785808'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `RankInput.threshold` in `packages/core/src/rank.ts` is a bare `number` and `rank` never checks it. `priceDivine < NaN` is always false, so a `NaN` threshold puts every priced entry in `ordering`; a negative or infinite threshold misgroups every priced entry, and nothing reports it. Closes the deferred-work entry from spec 2.2 review finding 6.

**Approach:** Guard the value at the one entry point that consumes it. `rank` throws a `RangeError` that names the threshold when it is not finite or is below 0, before it groups anything. The `web` side already validates the value before `rank` (Story 2.4: `PayoutThreshold.tsx` rejects a non-finite parse and clamps to [0, 3]; `readStoredThreshold` returns the default for anything outside [0, 3]), so the guard never fires in the app; it turns a future caller's bug from a silent misgrouping into a loud failure.

## Boundaries & Constraints

**Always:** `0` is a valid threshold (`THRESHOLD_MIN` in `packages/web/src/threshold/threshold-storage.ts` is 0; FR-7), so the rule is finite and `≥ 0`, not `DivineAmountSchema` (which is strictly positive). A valid threshold ranks exactly as before. Update the `rank` doc comment: it now throws for one caller error, the out-of-domain threshold; every expected data condition is still a group of the result.

**Never:** No change to `web`, `contracts`, the `RankInput` type shape, or any owner document (PRD, spine, IMPLEMENTATION-NOTES). No branded type. No clamping or coercion inside `rank`: an invalid value is a caller bug, not a value to repair. No edit to `docs/stories/deferred-work.md` or `docs/stories/sprint-status.yaml`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Zero | threshold `0`, one priced entry | entry in `ordering` | No error expected |
| Valid | threshold `0.25` | unchanged grouping | No error expected |
| NaN | threshold `NaN` | no `Ranking` returned | throws `RangeError`, message names the threshold and the value |
| Negative | threshold `-0.01` | no `Ranking` returned | throws `RangeError` |
| Infinite | threshold `Infinity` or `-Infinity` | no `Ranking` returned | throws `RangeError` |

</intent-contract>

## Code Map

- `packages/core/src/rank.ts` -- `RankInput.threshold` (line ~45) and `rank` (line ~111). The threshold is read once, at `observation.priceDivine < input.threshold` (line ~161). Doc comment at lines 11-35 says "nothing is thrown"; amend it.
- `packages/core/src/rank.test.ts` -- `ranked()` helper (line 66) fills defaults; `THRESHOLD = 0.25`. Existing threshold tests at lines 108-135 and 226-240 show the style.
- `packages/web/src/threshold/threshold-storage.ts`, `packages/web/src/threshold/PayoutThreshold.tsx` -- read-only evidence that `web` already validates before `rank`.
- `docs/stories/spec-2-2-the-raw-ranking-branch-league-scoped-and-computed-at-read-time.md` -- review triage row 6, the origin of the entry.

## Tasks & Acceptance

**Execution:**
- `packages/core/src/rank.ts` -- at the start of `rank`, throw `RangeError` when `!Number.isFinite(input.threshold) || input.threshold < 0`; amend the doc comments of `rank` and `RankInput.threshold` -- makes the silent misgrouping impossible.
- `packages/core/src/rank.test.ts` -- add a `describe` that covers each row of the I/O matrix, including a price exactly at threshold `0` -- proves the guard and that 0 stays valid.

**Acceptance Criteria:**
- Given a caller passes a `NaN`, negative or infinite threshold, when it calls `rank`, then `rank` throws a `RangeError` and returns no `Ranking`.
- Given the app runs with any threshold the Payout Threshold input or the stored value can produce, when the list ranks, then the grouping is unchanged (existing `web` and `core` tests pass).

## Spec Change Log

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 11 findings — high 0, medium 0, low 5, false 6, maybe-false 0
- findings:
  - `[low]` `[patch]` blind: the test "a price exactly at 0 survives" uses `priced(0)`, which `DivineAmountSchema` (strictly positive) forbids in any valid dataset — deleted the test; the `priced(0.01)` threshold-0 test covers the Zero matrix row.
  - `[false]` `[reject]` blind: the spec departs from the entry's "validate in web / `DivineAmountSchema`" with no recorded reason — the spec's Intent and Always state both reasons (web already validates per Story 2.4; 0 is valid, so not `DivineAmountSchema`); the fix would also edit this build's spec.
  - `[false]` `[reject]` blind: the throw blanks the page, as `web` has no error boundary — the only caller, `ReadyList` (`packages/web/src/App.tsx:121`), gets its threshold from `readStoredThreshold` or `clampThreshold` after an `isFinite` check, both within [0, 3], so the throw is unreachable in the app.
  - `[false]` `[reject]` blind: the spec calls `rank` "the one entry point that consumes" the threshold, but `listStatement` and `RankedList` also receive it — they use it only for copy and display, not grouping; the misgrouping the entry names lives only in `rank`; the fix edits this build's spec.
  - `[low]` `[reject]` blind: `-0` passes the guard with no test — `-0` groups exactly as `0`, no caller produces it, and a test pins no user-visible behaviour.
  - `[low]` `[reject]` blind: only the NaN case checks the message, and the NaN case does not check that no `Ranking` returns — a call that throws cannot return a value, and a message check on each case is cosmetic.
  - `[low]` `[patch]` blind: "a valid threshold groups as before" repeats the existing threshold tests and compares against nothing earlier — deleted; the existing survive/below tests cover the Valid matrix row.
  - `[false]` `[reject]` blind: Verification does not name the web tests that exercise `rank` — `pnpm test` runs them (86 files pass); the fix edits this build's spec.
  - `[false]` `[reject]` verification-gap (other finding): no `ErrorBoundary`, so a throw would unmount the page — same refutation as the blank-page row: unreachable from today's inputs.
  - `[false]` `[reject]` intent-alignment: the diff guards the callee (`rank`) while the entry's evidence names the caller (`web`), and the type stays `number` — the `web` caller already validates (Story 2.4 spec line 164, `threshold-storage.test.ts`), so the one clause of the summary still true before this diff was `rank`'s silent misgrouping, which is now a `RangeError`; "is a bare `number`" names the cause, not a separate harm.
  - `[low]` `[reject]` intent-alignment: the web domain is [0, 3] and the `rank` guard accepts any finite value ≥ 0 — the entry names only NaN, negative and infinite values; a value above 3 groups correctly in `rank`.
  - deferred-ledger-audit: zero findings. edge-case-hunter: zero findings.

## Auto Run Result

- **Change:** `rank` (`packages/core/src/rank.ts`) throws a `RangeError` that names the value when the Payout Threshold is not finite or is below 0, before it groups anything. A valid threshold, 0 included, ranks as before. The doc comments of `rank` and `RankInput.threshold` state the domain.
- **Files:** `packages/core/src/rank.ts` — the guard and doc comments. `packages/core/src/rank.test.ts` — `describe('rank: the threshold domain')`: threshold 0, NaN (with message), -0.01, ±Infinity, and an empty input at -1.
- **Review:** 2 low patches applied (two test deletions); 0 deferred; 9 rejected, with reasons in the triage log.
- **Follow-up review recommended:** false. Patched: high 0, medium 0, low 2.
- **Verification:** `pnpm check` passes. `pnpm test` passes: 86 files, 1115 tests.
- **Residual risk:** a future caller that bypasses `web`'s validation now gets a render-time throw instead of a silent misgrouping; `web` has no error boundary, so the page would unmount.

## Verification

**Commands:**
- `pnpm check` -- expected: passes
- `pnpm test` -- expected: passes, including the new `rank` threshold-domain tests
