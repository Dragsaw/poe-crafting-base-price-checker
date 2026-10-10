---
title: 'Restate the appendix row height as a minimum in DESIGN.md'
type: 'chore'
created: '2026-10-10'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** DESIGN.md `components.unrankable-appendix.row` reads as a fixed height (`{spacing.line-height-expansion} tall`). Story 4.8 (human decision, 2026-10-10) lets an over-long note wrap in its note cell, so a row can grow past that height. `UnrankableAppendix.tsx` already sets it as `minHeight`.

**Approach:** Restate the row height in DESIGN.md as a minimum that grows when the note wraps, and close the deferred-work entry from `spec-4-8-the-appendix-s-raw-ranks-note`. The user invoked this build on that `[NOTE FOR UX]` entry, which authorizes the edit to the UX owner document.

</frozen-after-approval>

## Implementation Notes

- `docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/DESIGN.md` — `components.unrankable-appendix.row` now reads as a minimum height; only the note cell wraps. No code change: `packages/web/src/list/UnrankableAppendix.tsx` and its test already use `minHeight`.
- `docs/stories/deferred-work.md` — removed the Story 4.8 section, the only entry under it.
- Review patches: the DESIGN.md *Do / Don't* row now names the appendix row as the exception to fixed row height. The wrap clause moved from `row` to `note`, and `note` gains the 4px block padding that Story 4.8 put in code. The *Unrankable appendix* prose section has no height wording, so it is unchanged.
- No GitHub issue matched the removed entry (`gh issue list --state all`), so none needs closing.

## Review Triage Log

- Blind 1, Do/Don't row bans content-driven row height: medium, patched.
- Blind 2, vertical alignment of a wrapped row unstated: low, rejected. Only the 14 + 16 note wraps, and the code centres the cells. Naming it would add a new UX decision.
- Blind 3, note cell's 4px block padding missing from DESIGN.md: low, patched (a one-clause correction).
- Blind 4, wrap clause sits under `row`: low, patched with 3.
- Blind 5, EXPERIENCE.md *What may be cut* has no appendix bullet: medium, deferred as a `[NOTE FOR UX]` (EXPERIENCE.md is outside this chore).
- Blind 6, spec status still `in-progress`: false. Finalize sets `done`.
- Blind 7, issue check unrecorded: low, patched in Implementation Notes.
- Blind 8, prose section unchecked: false. It has no height wording.
- Ledger audit: zero findings.
