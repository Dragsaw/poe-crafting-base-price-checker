---
title: 'Epic 4 retro item 3: small web fixes'
type: 'bugfix'
created: '2026-10-10'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic 4 retro (`docs/stories/epic-4-retro-2026-10-10.md`, action item 3) found five small defects: the expansion panel prints "+ 1 more combinations" (R6); the ≈ odds cue draws beside a "—" EV cell (R7); an EV in (−0.005, 0) prints `0.00` but is dimmed as a loss (R8); three CSS header comments run past three lines and narrate (A6); three test comments narrate the story id (A7).

**Approach:** `moreLinesCopy` uses the shared `plural` helper. `ExpectedValueCell` draws ≈ only beside a figure. `display-rows` derives `negative` from the printed text (a U+2212 sign), so a figure that prints `0.00` is never dimmed. Trim the CSS headers to at most three lines that state only a non-obvious why. Drop the story-id narration from the three test comments. Each code fix gets a test.

</frozen-after-approval>

## Implementation Notes

- R8: `formatDivine` already prints `0.00` for (−0.005, 0) (Epic 3 item 5); the defect was only the dimming in `display-rows.ts` `figure()`.
- R6: Copy Deck (`EXPERIENCE.md` state 39) gives the template `+ N more combinations`; the singular form follows the existing `plural` convention (`shared/text.ts`).
- A6 lint extension for CSS is tracked as `epic-4-retro-item-11-deferrals-tie-to-a-story-or-a-testable-r` in `sprint-status.yaml` `action_items`, not this change.
- Files: `list/format.ts`, `list/row/ExpectedValueCell.tsx`, `list/display-rows.ts` and their tests; `frame.css`, `recipe.css`, `threshold.css`; the three A7 test files.
- Review: the ≈ gate moved from `ExpectedValueCell` into `hasEstimate` (`display-rows.ts`), so the EV cell and the expansion context line agree.

## Review Triage Log

- Ledger: CSS lint gate has no ledger entry — false: tracked as `epic-4-retro-item-11-…` in `sprint-status.yaml` `action_items`.
- Design: `figure()` comment cited state 21, which says the opposite — low, patched to cite NFR-10.
- Design + Blind: a negative in (−0.005, 0) prints `0.00`, against *Money* (`< 0.01`) and states 21/25 (dimmed) — low, pre-existing in `formatDivine`; signed vs unsigned form needs a UX ruling. Deferred as `[NOTE FOR UX]`.
- Blind: ≈ context sentence still shows on a `—` row's expansion — medium, patched (`hasEstimate` gates `ContextLine`; test added).
- Blind: EXPERIENCE.md *Estimated odds* / state 12 have no `—` exception — low, owner-doc gap; deferred as `[NOTE FOR UX]` (reviewers do not edit owner docs).
- Blind: R7 test covered only pending — low, patched with broken and uncostable cases.
- Blind: ≈ gate lived in the view — low, patched with `hasEstimate`.
- Blind: `recipe.css` header still narrated — low, patched to state why the active segment is no target.
- Blind: `frame.css` trim dropped "no transition, no shadow" — low, patched (restored).
- Blind: `envelopes.test.ts` comment lacked the why — low, patched.
- Blind: `raw-ranks-note.test.tsx` JSDoc adds little — low, rejected: it names the fixture's two recipes, which the body does not.
- Blind: spec still in-progress, sprint item open — false at review time: finalize sets the spec to done; the item stays open for the player's acceptance (retro item 8).
