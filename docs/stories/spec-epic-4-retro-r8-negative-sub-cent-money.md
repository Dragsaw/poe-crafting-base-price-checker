---
title: 'Epic 4 retro R8: print a negative sub-cent figure as < 0.00'
type: 'bugfix'
created: '2026-10-10'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A negative EV or price in (−0.005, 0) prints `0.00`, undimmed. EXPERIENCE.md revision 28 (*Money*, *Missing figures*, state 21, Accessibility Floor; memlog 289) rules that it prints `< 0.00`, dimmed. The source is the `deferred-work.md` entry "Deferred from: UX ruling on spec-epic-4-retro-item-3-small-web-fixes R8 (2026-10-10)".

**Approach:** `formatDivine` in `packages/web/src/shared/money.ts` prints `< 0.00` for a value `-0.005 < v < 0`, the mirror of the `< 0.01` guard. `figure()` in `packages/web/src/list/display-rows.ts` dims that text as well as a U+2212 figure, so the dim keeps following a printed cue. `-0` still prints `0.00`, undimmed. `formatThreshold` does not change. Update `money.test.ts` and the `-0.003` row of `display-row-trust.test.ts`, and remove the R8 entry from `deferred-work.md` in the branch's last commit.

</frozen-after-approval>

## Implementation Notes

- `money.ts` exports `LOSS_BELOW_PRINTABLE` (`< 0.00`) beside `BELOW_PRINTABLE`. The guard is `-0.005 < v < 0`, symmetric with the positive one, so `-0.005` prints `−0.01`. `-0` fails `v < 0` and stays `0.00`, undimmed.
- `display-rows.ts` `figure()` dims on the U+2212 prefix or `LOSS_BELOW_PRINTABLE`, so the dim keeps following a printed cue rather than `expectedValue < 0`.
- `recipe-view.ts` (Craft Cost) and `ExpansionLine.tsx` (price) also call `formatDivine`; they get the new form for free and print no dim of their own.
- Surprise: the rev-28 UX commit on master (`160c93a`) left `trust-words.test.ts` pinned to revision 27, so it failed. Rev 28 changes no reason words; the pin moves to 28.
- Another session holds uncommitted rev-29 UX edits in the main checkout (`EXPERIENCE.md`, `.memlog.md`, `deferred-work.md`). They are left out of this branch; `pnpm check` ran in a clean worktree and passed 8/8. Rev 29 owes its own pin bump.

## Review Triage Log

- Blind Hunter 1 (Implementation Notes empty) — false: the reviewer read an earlier copy; the notes are filled in.
- Blind Hunter 2 (R8 ledger entry still present) — false: the Approach removes it in the branch's last commit.
- Blind Hunter 3 (`figure()` should test `expectedValue < 0`) — false: the frozen Approach keeps the dim on a printed cue; the two agree on every input, `-0` included.
- Blind Hunter 4 (`figure()` JSDoc names only the minus sign) — low, patched.
- Blind Hunter 5 (no rendered test of a dimmed `< 0.00`) — low, rejected: `ExpectedValueCell` dims from the `negative` flag, which `ranked-row.test.tsx` already renders; the new text only sets that flag, which `display-row-trust.test.ts` pins.
- Blind Hunter 6 (no negative `formatThreshold` case) — low, patched.
- Blind Hunter 7 (price and Craft Cost could print `< 0.00` undimmed) — false: `craftCost` is `z.number().min(0)` in `packages/contracts/src/ranked-row.ts`, and a price is a `DivineAmountSchema`, so neither reaches the branch.
- Blind Hunter 8 (`LOSS_BELOW_PRINTABLE` JSDoc describes the view) — low, patched.
- Blind Hunter 9 (boundary case mixed into the `< 0.00` test) — low, patched: own `-0.005` test, plus `-0.00499999`.
- Deferred Ledger Auditor — zero findings.
- Impeccable Design Reviewer — zero findings.
