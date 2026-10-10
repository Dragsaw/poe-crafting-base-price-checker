---
title: 'Epic 4 retro item 8: an accept step in bmad-build and a review guard in finish-worktree'
type: 'chore'
created: '2026-10-10'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** bmad-build moves a story key in `docs/stories/sprint-status.yaml` to `review` and nothing moves it to `done`. The key moved only when the human typed "accept" in the session, so 4-1, 4-2, 4-6 and 4-8 merged at `review` (epic 4 retro T1, item 8).

**Approach:** Decision (human, 2026-10-10): both an accept step and a guard.
1. Accept step: extend `on_complete` in `_bmad/custom/bmad-build.toml`. When the run set `development_status[{story_key}]` to `review`, ask the user to accept the story and HALT for the answer. On accept, set the key to `done`, update `last_updated`, and make one commit. Any other answer leaves the key at `review`. Do not change the epic key. Keep the existing impeccable offer.
2. Guard: edit the user-level `~/.claude/skills/finish-worktree/SKILL.md`. After the rebase and before the push, stop and report when the branch changed a file named `sprint-status.yaml` and a `development_status` key that the branch changed reads `review` at HEAD. The report names each key and tells the user to accept the story first. The guard stays generic and does nothing in a repository with no such file. This file is outside the repository, so it is not in this branch's diff.
3. Set action item `epic-4-retro-item-8-add-an-acceptance-step-to-finish-worktre` to `done` in `sprint-status.yaml`. Add a status note to item 8 of `docs/stories/epic-4-retro-2026-10-10.md`, in the form that items 4 and 5 use.

</frozen-after-approval>

## Implementation Notes

- `_bmad/custom/bmad-build.toml`: the accept step comes first in `on_complete`, above the impeccable offer. Both `step-05-present.md` and `step-oneshot.md` render it (checked by a fresh `render_skill.py` run). It commits only `sprint-status.yaml`, with a `docs(stories)` subject that `.githooks/commit-msg` accepts.
- `~/.claude/skills/finish-worktree/SKILL.md`: the guard is item 5 of section 3, after the rebase and the verification command and before the push. It compares keys at `<BASE>` and `HEAD`, so a key that was already at `review` on `BASE` does not block an unrelated branch.
- `docs/stories/sprint-status.yaml`: action item 8 is `done`. `docs/stories/epic-4-retro-2026-10-10.md`: item 8 has a status note.
- Review fixes: the accept step now fires when the key reads `review` at the end of the run, not only when this run set it. It accepts any clear yes, including a misspelt "accept", and asks once more on an unclear answer. The guard reads both ends with `git show`, skips a file absent at `HEAD`, treats a file absent at `<BASE>` as all-new keys, and gives the exact accept commit.

## Review Triage Log

- medium — the accept step skipped a re-run, because `sync-sprint-status.md` stops when the key is already at `review`. Patched: the condition is now "reads `review` at the end of this run".
- medium — only the exact word "accept" counted, but the T1 evidence has the typo "accpet". Patched: any clear yes counts, and an unclear answer gets one re-ask.
- medium — the guard did not say what happens when the file is missing at `BASE` or at `HEAD`. Patched in finish-worktree.
- low — the guard's fix skipped `last_updated` and the commit subject. Patched: it gives both.
- low — the decline message stated an unversioned guard as fact. Patched: "where it has the review guard".
- low — the notes called the guard "step 3.5", but it is item 5 of section 3. Patched.
- false — the spec was still `in-progress`. Finalize sets it to `done` in this step. The render evidence is the fresh `render_skill.py` run noted above.
- false — the guard blocks the push, not the merge. The human chose this mechanism at planning, and its option text said "Before the push".
- medium, deferred — nothing moves the epic to `done`. The frozen intent forbids changing the epic key. Recorded in deferred-work.md.
- medium, deferred — bmad-build-auto and deferred-work-sweep bypass both the accept step and the guard. Recorded in deferred-work.md.
- low, deferred — AGENT-WORKFLOW.md and the WORKFLOW NOTES in sprint-status.yaml do not describe acceptance. The architect owns AGENT-WORKFLOW.md (Review brief rule 2). Recorded in deferred-work.md.
