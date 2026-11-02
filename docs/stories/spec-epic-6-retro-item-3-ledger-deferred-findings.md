---
title: 'Ledger the deferred epic 6 review findings'
type: 'chore'
created: '2026-11-02'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The epic 6 retro deferred three review findings (action item 3): D1/ADV-13 (the active-recipe narrowing is written twice), VG-2 (no test proves the download uses no File System Access API) and ADV-12 (pick-up entries sort by JSON key text). None of them is in `docs/stories/deferred-work.md`, so `pnpm deferred:issues` and the deferred-work sweep cannot see them.

**Approach:** Append one ledger entry per finding to `docs/stories/deferred-work.md` under a new `## Deferred from: epic 6 retro (2026-11-01)` heading, with `source_spec` set to the retro file. No entry has a `retry_when`: each can be built now. Set action item 3 to `done` in `sprint-status.yaml`.

</frozen-after-approval>

## Implementation Notes

- **Files:** `docs/stories/deferred-work.md` (append only, under `## Deferred from: epic 6 retro (2026-11-01)`) and `docs/stories/sprint-status.yaml` (action item 3 `open` → `done`, `last_updated`).
- **Entries:** the ledger owns their text; see the ADV-13, VG-2 and ADV-12 entries. The evidence was checked against master `9f5b941`.
- **`retry_when`:** absent on ADV-13 and VG-2, which can be built now (ledger format comment, `tools/deferred-issues/ledger-rules.ts`). ADV-12 carries `never — needs a human`: no owner document names the target order, and the order is visible in the downloaded filter.
- **Agent browser checks: none needed.** The change touches only `docs/` (`agent-browser-checks.md` rule 1).
- **Verified:** `pnpm vitest run tools/deferred-issues` passes (64 tests), the live ledger parses to four entries, and `pnpm check` exits 0 with all 8 gates passing.

## Review Triage Log

- BH-1 (`source_spec` goes stale when the retro moves to `archive/`): low, rejected. A sweep finds the moved file with one glob, and a fix needs an archiving policy, not a ledger edit.
- BH-2 (the spec still reads `in-progress`): false. Finalize sets `done` in this commit.
- BH-3 (ADV-13 names only the `ordering` test): medium, patched. The evidence now names `ev === null` and the four collections `forRecipe` narrows.
- BH-4 (ADV-13 has no done condition): low, patched. Added one.
- BH-5 (ADV-12 has no target order): medium, patched. The entry names the open choice and carries `retry_when: never — needs a human`.
- BH-6 (ADV-12 changes the download oracle text): low, patched in the ADV-12 evidence.
- BH-7 (the review id is cut off in the 70-character issue title): low, patched. The id now leads each summary.
- BH-8 (the VG-2 guard passes a `saveFilter` that never downloads): low, patched. The guard also asserts that the Blob download happens.
- BH-9 (the Implementation Notes copy the ledger evidence): low, patched. The notes cite the entries.
- BH-10 (the cited `retry_when` rule is vague): low, patched. The notes cite the format comment and `ledger-rules.ts`.
- Deferred Ledger Auditor: zero findings. OCR delegate: zero findings.
