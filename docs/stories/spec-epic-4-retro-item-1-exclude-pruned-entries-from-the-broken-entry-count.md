---
title: 'Exclude pruned entries from the broken-entry problem count'
type: 'bugfix'
created: '2026-10-10'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `problemSummary` counts every `unresolvable` dataset entry, pruned ones included (epic 4 retro R1, item 1). A pruned entry is never re-checked, so the header shows a problem count forever while the list shows no ✕ row.

**Approach:** Count only non-pruned `unresolvable` dataset entries in `web/src/frame/trust-facts.ts`, with a test that has a pruned `unresolvable` entry. Amend the AD-12 *Broken entries* source row to say non-pruned.

</frozen-after-approval>

## Implementation Notes

- `Curation` gains `prunedKeys`, the canonical keys of `pruned` tracked entries; `readyControls` fills it from `set.tracked`. The dataset entry carries no status, so the key set is the join.
- Files: `web/src/frame/trust-facts.ts`, `header-controls.tsx`, tests, AD-12 *Broken entries* row (non-pruned). `pnpm check` passed apart from a typecheck fix to inline test literals, then rechecked.

## Review Triage Log

- false: key join unproven on real data. `DatasetEntry.entryKey` is the canonical key by contract; `display-rows.ts` joins the same way.
- false: panel lists pruned `unresolvable` records. The panel prints `problems.lines` and cross-file diagnosis only.
- low, rejected: no header-level test, mandatory `prunedKeys` field, two test files, JSDoc and AD-12 wording. A one-line join, and the fixes would add more than they correct.
- Impeccable: no findings. Ledger audit: no findings.
