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

## Deferred from: spec-deferred-4-5-repair-epic-4-context (2026-10-10)

- source_spec: `docs/stories/spec-deferred-4-5-repair-epic-4-context.md`
  summary: [NOTE FOR PM] Bring the Epic 4 *Order* of docs/epics.md ("4.3 to 4.5, then 4.6") in line with docs/sprint-change-proposal-2026-10-10.md *Order*, which puts 4.7 and the tracked.json re-check after 4.3, and place Story 4.8.
  evidence: epics.md *Order* predates the proposal and omits 4.7 and 4.8. epic-4-context.md now cites both sources, but a recompile from epics.md would bring the stale order back. The PM owns epics.md, so a build review does not edit it (AGENT-WORKFLOW.md *Review brief*, rule 2).
  retry_when: now

## Deferred from: spec-4-8-the-appendix-s-raw-ranks-note (2026-10-10)

- source_spec: `docs/stories/spec-4-8-the-appendix-s-raw-ranks-note.md`
  summary: [NOTE FOR UX] DESIGN.md `components.unrankable-appendix.row` reads as a fixed height, but a wrapped note now grows the row. Restate the row height as a minimum in DESIGN.md.
  evidence: Story 4.8 (human decision, 2026-10-10) lets an over-long appendix note wrap inside its note cell. UnrankableAppendix.tsx sets `minHeight: line-height-expansion` on the row, and only the note cell wraps. The 14 + 16 joined note wraps to two lines at the 1080px target width.
