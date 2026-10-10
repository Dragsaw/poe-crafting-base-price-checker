---
title: 'Repair the Epic 4 context: the story order and two dropped constraints'
type: 'chore'
created: '2026-10-10'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The rewrite of `docs/stories/epic-4-context.md` that added Story 4.7 left a garbled order sentence ("4.3, then 4.7 ahead of 4.4 to 4.6, then 4.6 last"). It also dropped two constraints without citing their owners: the build check that bundled Inter holds − † * · — – at every weight, and the rule that no colour goes on a surface where it falls below the contrast floor (deferred from spec-4-5).

**Approach:** Rewrite the order sentence as one plain sequence and cite the sprint change proposal of 2026-10-10 as its owner. Restore the two constraints as short citations of `DESIGN.md` *Typography* and *Colors* (*Measured contrast*), not as copies of their text. Remove the ledger entry.

</frozen-after-approval>

## Implementation Notes

- Order source: `docs/sprint-change-proposal-2026-10-10.md` *Order* puts 4.7 next after 4.3 and keeps 4.4, 4.5 and 4.6 in their order. `docs/epics.md` *Order* still reads "4.3 to 4.5, then 4.6" and predates the proposal; it is not edited here.
- Glyph check owner: `DESIGN.md` *Typography*, the paragraph after the mark list. Contrast owner: `DESIGN.md` *Colors*, *Measured contrast*, which names the pairs under the floor.
- Changed `docs/stories/epic-4-context.md` (three lines) and removed the spec-4-5 entry from `docs/stories/deferred-work.md`. No code changed.
- Review patches: added Story 4.8 to *Stories* and the order bullet; the order cites `epics.md` for 4.1–4.3 and the proposal for the rest, including the `tracked.json` re-check; the glyph line points at the characters `DESIGN.md` lists and records that Story 4.1 ran the check; the contrast rule is one sentence. Checked that `parseLedger` still reads `deferred-work.md` (7 entries).

## Review Triage Log

- Blind Hunter: a recompile from stale `epics.md` *Order* undoes the fix — medium, defer: `epics.md` is PM-owned (Review brief rule 2); ledger entry `[NOTE FOR PM]` added.
- Ledger auditor: the `epics.md` carve-out has no ledger entry — medium, same root cause; fixed by the same entry.
- Blind Hunter: the order and *Stories* omit Story 4.8 — medium, patched.
- Blind Hunter: the proposal citation does not cover 4.1–4.3 and drops the re-check step — low, patched (two citations, re-check in sequence).
- Blind Hunter: the glyph line is ambiguous and loses "every weight" — low, patched.
- Blind Hunter: the glyph check reads as open work, but Story 4.1 ran it (spec-4-1 Implementation Notes) — low, patched.
- Blind Hunter: the contrast sentence repeats the floor and copies 4.5:1 — low, patched into one sentence; the 4.5:1 figure predates this change and is left alone.
- Blind Hunter: the spec has no Verification, Change Log or Triage Log, and `context` is empty — false: the oneshot route drops those sections by template rule.
- Blind Hunter: the GitHub issue for the removed entry stays open — false: `gh issue list --state all` finds no issue for it.
