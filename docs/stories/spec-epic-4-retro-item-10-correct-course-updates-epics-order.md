---
title: 'Epic 4 retro item 10: a correct-course that inserts a story updates epics.md Order and regenerates the epic context'
type: 'chore'
created: '2026-10-11'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Correct-course (`566ab0c`, `78af60e`) inserted Story 4.7 and left the Epic 4 *Order* paragraph of `docs/epics.md` unchanged. The epic context was then patched by hand, the order came out garbled and two constraints were lost, and two repair commits followed (`cfb47bf`, `2904ecd`). The retro records this as S-Order, P4 and item 10 in `docs/stories/epic-4-retro-2026-10-10.md`.

**Approach:**
1. Add a project override `_bmad/custom/bmad-correct-course.toml`. Use `persistent_facts` for the rule and `on_complete` for the steps. When the proposal inserts, removes or reorders a story of epic N:
   - Edit the `**Order.**` paragraph of epic N in `docs/epics.md` so that it states the full new order. Do not cite the proposal as the owner of the order.
   - Regenerate `docs/stories/epic-N-context.md` with bmad-build's `compile-epic-context.md`, in a context-free subagent. Do not patch the order or the story list by hand.
   - Commit the proposal, the `epics.md` edit, the `sprint-status.yaml` change and the regenerated context in one commit.
2. Add a short section to `AGENT-WORKFLOW.md` that states the same rule for any agent, with or without the skill. It names the override.
3. Set action item `epic-4-retro-item-10-a-correct-course-that-inserts-a-story-up` to `done` in `sprint-status.yaml`. Add a status note to item 10 of the retro, in the form that items 4 to 8 use.

</frozen-after-approval>

## Implementation Notes

- Decision (agent): a regenerated context keeps each must-discharge line of the old file (AGENT-WORKFLOW *Must-discharge lines in an epic context*). Those lines come from deferred work, not from the planning documents, so the compiler cannot rebuild them. Everything else comes from the compiler.
- Decision (agent): the compiler is found at `{skill-root}/../bmad-build/compile-epic-context.md`. bmad-correct-course and bmad-build are sibling skills of one installed module.
- Decision (agent, cancelled, not deferred): the Epic 4 *Order* paragraph of `epics.md` is not changed. It already states the full order. Its citation of the proposal predates this rule, and Epic 4 is done. The rule applies from the next proposal.
- Files: new `_bmad/custom/bmad-correct-course.toml` (`persistent_facts` and `on_complete`); new section *A change to the stories of an epic* in `AGENT-WORKFLOW.md`, with `updated` bumped; action item 10 `done` and `last_updated` in `sprint-status.yaml`; status note on item 10 of the retro.
- Checked: `resolve_customization.py --skill <bmad-correct-course> --key workflow.on_complete` and `--key workflow.persistent_facts` return the override. `compile-epic-context.md` is present beside `bmad-correct-course` in the installed module (6.13.0-next).
- The Epic 4 narrative stays out of the `AGENT-WORKFLOW.md` body (AGENTS.md: rationale goes in the commit message).
- Review fixes: `AGENT-WORKFLOW.md` *A change to the stories of an epic* is now the one owner of the rule; the toml cites it and adds only the mechanics (the approval gate, the compiler path, the subagent prompt). The section also covers changes made outside a proposal, the `sprint-status.yaml` key edits, a re-check of the anchors of kept must-discharge lines, a check for dropped constraints, and the compiler's "Edit freely" header.

## Review Triage Log

- medium — regeneration can drop constraints, which is the S-Order failure. Patched: compare old and new bullets and show each dropped one to the user.
- medium — `on_complete` had no approval gate. Patched: runs only on an approved proposal.
- medium — kept must-discharge lines could name a removed or moved story. Patched: re-check each anchor and report failures.
- low — the compiler's "Edit freely" header conflicts with the rule. Patched: the section says the header does not cancel it.
- low — the `sprint-status.yaml` change was not defined. Patched: add new keys as `backlog`, remove unstarted removed keys.
- low — the toml and `AGENT-WORKFLOW.md` stated the rule twice and differently. Patched: the toml cites the section.
- low — `AGENT-WORKFLOW.md` gave no compiler location. Patched: names `compile-epic-context.md` of the installed bmad-build skill.
- low — insertions outside correct-course had no rule. Patched: the section covers any change to the stories of an epic.
- low — Epic 4 *Order* and `epic-4-context.md` still cite the proposal (also the ledger audit's finding). Decision: cancelled, see Implementation Notes. The rule applies from the next proposal.
- false — the PM owns `epics.md`. Review brief rule 2 binds reviewers. Correct-course already edits `epics.md` (`78af60e` added Story 4.7).
- false — spec status was `in-progress`. Finalize sets `done`.
- low, rejected — no dry run against the S-Order case. The dropped-constraint check covers the risk, and a dry run would rewrite a done epic's context.
