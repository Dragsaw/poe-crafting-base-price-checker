---
title: 'Rule whether an unresolvable Raw Base gets pick-up blocks'
type: 'chore'
created: '2026-11-02'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic 6 retro action item 4 (review finding ADV-1). A Raw Base whose `baseTypeId` the trade catalogue no longer knows has Price State `unresolvable`. FR-36 does not say whether such a base gets pick-up blocks. Today the code treats it as unpriced, so it gets craft and check the rolls when EV(C) > 0. An unresolvable jewel kind gets no entry.

**Decision (human, 2026-11-02):** Keep today's behavior. An unresolvable Raw Base is a Raw Base with no price, as is any Price State other than `priced`. The risk that the game rejects or ignores a block with an unknown `BaseType ==` is accepted.

**Approach:** State the ruling once in FR-36 as a PRD-owned rule (PRD revision 37). No code change: the AC 7 test in `packages/core/src/pick-up/pick-up.test.ts` already pins the behavior. Set action item 4 to `done` in `sprint-status.yaml`.

</frozen-after-approval>

## Implementation Notes

- **Files:** `prd.md` (one PRD-owned FR-36 bullet, `revision: 37`, `updated`), its `.memlog.md` (revision 37 entry) and `sprint-status.yaml` (action item 4 `open` → `done`, `last_updated`).
- **No code or test change.** The AC 7 `unresolvable` case in `packages/core/src/pick-up/pick-up.test.ts` already pins the kept behavior. `PRODUCT.md` needs no refresh: no user, positioning or constraint fact changed.
- **Agent browser checks: none needed.** The change touches only `docs/` (`agent-browser-checks.md` rule 1).
- **Verified:** `pnpm vitest run tools/deferred-issues` passes (64 tests) with the new ledger entry, and `pnpm check` exits 0.

## Review Triage Log

- Blind Hunter: no `.memlog.md` entry for revision 37 — medium, patched (the `prd.md` Conventions line puts revision history there).
- Blind Hunter: the new bullet's first sentence misreads — low, patched (reworded).
- Blind Hunter: the jewel-kind asymmetry goes unstated — low, patched (one sentence in the bullet).
- Blind Hunter: the in-game effect of an unknown `BaseType ==` is unchecked — maybe-false, high if the whole file fails; deferred to `deferred-work.md` (needs a human in game).
- Blind Hunter: the bullet conflicts with FR-24/FR-35 — false: FR-36 already names unpriced Raw Bases that the ranking excludes, and that rule predates this change.
- Blind Hunter: no through-`rank` test — false: for a Raw Base, `pickUpPurposes` reads only `ordering` and `belowThreshold`, and the AC 7 `in no group` case already covers a base absent from both.
- Blind Hunter: spec status contradicts the ledger — false: finalize sets `done`.
- Blind Hunter: `context: []` is empty — low, rejected: the Intent names the retro item and FR-36.
- Blind Hunter: the retro open question is left dangling — low, rejected: the retro is a record; the commit message names the ruling.
- Blind Hunter: rationale in the spec body — low, patched (line removed; rationale goes in the commit message and `.memlog.md`).
- Deferred Ledger Auditor, OCR delegate: no findings.
