---
title: 'Ledger the deferred epic 7 review findings'
type: 'chore'
created: '2026-11-15'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The epic 7 retro deferred six findings (action item 6): ADV-2 and ECH-3 (notes for the architect on AD-17 and AD-11), VG-1, ADV-3 and ADV-5 (low fixes) and B1 (a UX decision on the filter-modal lead). None of them is in `docs/stories/deferred-work.md`, so `pnpm deferred:issues` and the deferred-work sweep cannot see them.

**Approach:** Append one ledger entry per finding to `docs/stories/deferred-work.md` under a new `## Deferred from: epic 7 retro (2026-11-15)` heading, with `source_spec` set to the retro file. The finding id leads each summary. Set action item 6 to `done` in `sprint-status.yaml`.

</frozen-after-approval>

## Implementation Notes

- **Files:** `docs/stories/deferred-work.md` (append only) and `docs/stories/sprint-status.yaml` (action item 6 `open` → `done`, `last_updated`).
- **Evidence source:** `docs/reviews/review-epic-7-diff.md` and the retro's R2 table. Every cited line is re-checked against HEAD `c0619e8`, because retro items 2–5 moved code (`ownInterval` now filters weight 0, so ECH-3's lines are `probability.ts:75-113`).
- **`retry_when`:** `never — needs a human` on ADV-2 and ECH-3 (an AD decision, sweep condition 4) and on B1 (a UX decision owned by `EXPERIENCE.md`). VG-1, ADV-3 and ADV-5 carry none: each can be built now.
- **Done conditions:** each buildable entry names the test or check that proves it, as the epic 6 entries do.
- **Agent browser checks: none needed.** The change touches only `docs/` (`agent-browser-checks.md` rule 1).
- **Hand-off:** each `never — needs a human` entry says that the commit recording the ruling removes it and appends a buildable entry for the code (retro P1).
- **Verified:** `pnpm vitest run tools/deferred-issues` passes (64 tests), the live ledger parses to 19 entries with the six new issue titles, and `pnpm check` exits 0 with all 8 gates passing.

## Review Triage Log

- BH-1 (ECH-3 says the higher-level tier gives up the overlap): medium, patched. `deriveOwnInterval` cuts the tier whose minimum lies inside the other's span, so with T2@75 [40,50] and T3@82 [35,48] the lower-level T2 is cut and T3 keeps the overlap. The sentence came inverted from the review; the entry now gives the worked case.
- BH-2 (ADV-2 omits the `FLOOR_CHECKS` JSDoc that states the premise): low, patched. The entry cites `cross-file.ts:161`, says the `HIGHEST_CRAFTING_ITEM_LEVEL` JSDoc rests on a related claim, and gives the spine lines as 1297-1299.
- BH-3 (ADV-2 and ECH-3 are one decision, third option missing): low, patched. Both say to decide together, and ADV-2 names the level reading of AD-11 as a third option.
- BH-4 (VG-1 floors 75, 80, 82 are wrong): low, patched. Entry floors in the cross-file tests are 70, 75 and the default 82; 80 is a tier floor.
- BH-5 (ECH-3 line range): low, patched. The entry cites `ownInterval` and `deriveOwnInterval` at `probability.ts:75-113`, which covers the weight filter at `:78`.
- BH-6 (ADV-3's filter would drop a T2 that still counts at 82): medium, patched. The done condition now keeps the sibling, reports the reference in `noT2` only when every sibling sits above 79, and tests the mixed case.
- BH-7 (ADV-5 code option has no test): low, patched. That option now needs a default-context test with a not-counted combination.
- BH-8 (human-decision entries have no hand-off): low, patched. Each says the ruling's commit appends a buildable entry.
- BH-9 (spec text and state): the `in-progress` status is false, since finalize sets `done` in this commit; a missing Verified line and triage log are patched here. The tag ahead of the finding id in three summaries is low and rejected: the Intent is frozen, and the tag is what `[NOTE FOR …]` filtering relies on.
- BH-10 (the 309 negative ranges figure has no stated meaning): low, patched. Dropped from ECH-3.
- Deferred Ledger Auditor: zero findings. OCR delegate: zero findings above low; the citations it checked hold at HEAD.
