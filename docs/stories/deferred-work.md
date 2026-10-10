# Deferred work

Each entry names work carved out of a spec. Append new entries. Do not rewrite other entries. Remove an entry in the last commit of the branch that lands its work, or in a commit that names the decision to cancel it. `pnpm deferred:issues` opens one GitHub issue for each entry, and the `deferred-work-sweep` skill keeps its run state in that issue, not here. A human can add a `retry_when:` line to an entry as a precondition: the sweep skips the entry until the condition is true.

<!--
    Entry format, read by `pnpm deferred:issues` and `deferred-work-sweep` (tools/deferred-issues/ledger.ts).
    The parser does not skip HTML comments. Every line in here is indented, so none counts as an entry.
    A real entry sits at column 0 under a heading, with a blank line after it, like this (indent removed):

    ## Deferred from: <where it came from> (YYYY-MM-DD)

    - source_spec: `docs/stories/spec-example.md`
      summary: One line, or wrapped lines, saying what work is owed. The issue title is this text cut to 70 characters.
      evidence: Where to look and why it is true: file paths, line numbers, the review finding.
      retry_when: Optional. Story 3.7 is done in sprint-status.yaml

    Rules:
    - The bullet starts with `- source_spec:` at column 0. Every other field is indented by exactly two spaces.
    - `source_spec`, `summary` and `evidence` are required. An entry missing one of them is a note and is skipped.
    - `retry_when` is optional and human-written. Forms the sweep can check: `Story <n.n> is done in
      sprint-status.yaml`, `master has moved past <sha>`, or `never — needs a human`.
    - A field may wrap onto lines indented by two or more spaces. A blank line, a heading or a new bullet ends the entry.
    - Do not write an id. The id is `dw-` plus a hash of source_spec and summary, so editing either field
      makes a new entry and a new issue.
-->


## Deferred from: spec-retro-4-2 review (2026-10-10)

- source_spec: `docs/stories/spec-retro-4-2-state-23-verdict-and-recipeless-order.md`
  summary: Guard against CRLF in edited files: Serena `replace_content` writes CRLF on Windows, so add a CR check to lint-on-edit or a Known pitfalls line in AGENTS.md.
  evidence: Every Serena edit on this branch left CRLF in the working copy despite `.gitattributes` `eol=lf`; `packages/web/src/list/display-rows.test.ts`'s raw-source scan of `summands` uses then failed on a trailing `\r` until the files were normalised (Blind Hunter finding).

## Deferred from: spec-epic-4-retro-item-8-acceptance-step review (2026-10-10)

- source_spec: `docs/stories/spec-epic-4-retro-item-8-acceptance-step.md`
  summary: Move `epic-N` to `done` in sprint-status.yaml when its last story is accepted; the accept step leaves the epic key unchanged.
  evidence: The frozen intent says "do not change the epic key", and the sprint-status.yaml status block defines an epic as done when all its stories are done. Retro item 4 had to set `epic-4` by hand (Blind Hunter finding).
  retry_when: never — needs a human
- source_spec: `docs/stories/spec-epic-4-retro-item-8-acceptance-step.md`
  summary: Give the unattended bmad-build-auto path a non-interactive answer to T1; it gets no accept step and does not go through finish-worktree.
  evidence: `_bmad/custom/bmad-build-auto.toml` has no accept step, and deferred-work-sweep opens PRs without finish-worktree. An interactive HALT must not enter the auto loop (Blind Hunter finding).
  retry_when: never — needs a human
- source_spec: `docs/stories/spec-epic-4-retro-item-8-acceptance-step.md`
  summary: [NOTE FOR ARCHITECT] Record the accept-then-finish sequence in AGENT-WORKFLOW.md, and update the WORKFLOW NOTES comment in sprint-status.yaml, which still ends the story flow at `review`.
  evidence: AGENT-WORKFLOW.md owns command-level rules (AGENTS.md); `docs/stories/sprint-status.yaml` line 29 says "Dev moves story to 'review', then runs code-review" (Blind Hunter finding).
  retry_when: never — needs a human
