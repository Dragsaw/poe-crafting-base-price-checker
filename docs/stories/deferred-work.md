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

## Deferred from: spec-4-1-the-dark-token-set-bundled-inter-and-the-sticky-header-bar (2026-10-09)


- source_spec: `docs/stories/spec-4-3-the-ranked-row-rarity-names-the-uncrafted-base-line-the-mark-slot-and-the-odds-cue.md`
  summary: Give a cut chase cell its full-text tooltip (DESIGN.md chase-cell.cutHover; EXPERIENCE.md What may be cut), the third tooltip kind.
  evidence: ChaseCells in packages/web/src/list/RankedRow.tsx cuts with an ellipsis and has no Tooltip. Neither the old row nor Story 4.3's task list built it, and docs/epics.md names no story for it.
  retry_when: a story that owns the chase cells is planned

- source_spec: `docs/stories/spec-4-3-the-ranked-row-rarity-names-the-uncrafted-base-line-the-mark-slot-and-the-odds-cue.md`
  summary: Switch the crafted chase column from three cells to two below the budget B (DESIGN.md Layout & Spacing, The chase column; ranked-row.chaseCrafted).
  evidence: ChaseCells in packages/web/src/list/RankedRow.tsx always renders repeat(CHASE_CELLS = 3). The row has no two-cell form, and docs/epics.md names no story for it.
  retry_when: a story that owns the chase cells is planned

- source_spec: `docs/stories/spec-4-3-the-ranked-row-rarity-names-the-uncrafted-base-line-the-mark-slot-and-the-odds-cue.md`
  summary: Drop the bottom rule under the last row of a list (DESIGN.md Layout & Spacing, Density).
  evidence: RankedRow in packages/web/src/list/RankedRow.tsx draws a 1px line border on every row, the last included, as the old row also did. The fix needs an isLast signal from RankedList or the border moved into list.css.
  retry_when: a story that restyles the ranked list is planned

- source_spec: `docs/stories/spec-4-4-the-expansion-one-line-per-entry-top-lines-and-the-trust-reasons.md`
  summary: Make an expansion line's no-listings reason follow EXPERIENCE.md *Ages* under a day (`tried N min ago` / `tried N hours ago`, then `tried N days ago` from one day), in place of `tried 0 days ago`.
  evidence: Decided 2026-10-10 (option 1 of three): follow *Ages*; the *Price trust* table's `tried N days ago` is the from-one-day case. The no-listings reason in contracts carries whole days only (`{ kind: 'no-listings', days? }`), and core fills it in entryTrust (packages/core/src/price-trust.ts), so lineReasonWords in packages/web/src/list/row/trust-words.ts cannot print a sub-day age. Needs contracts and core to carry the attempt age at minute grain (check AD-17), then the web wording. A sync runs about every 15 hours, so a fresh no-listings attempt is the common case.
  retry_when: now

## Deferred from: spec-deferred-4-5-repair-epic-4-context (2026-10-10)

- source_spec: `docs/stories/spec-deferred-4-5-repair-epic-4-context.md`
  summary: [NOTE FOR PM] Bring the Epic 4 *Order* of docs/epics.md ("4.3 to 4.5, then 4.6") in line with docs/sprint-change-proposal-2026-10-10.md *Order*, which puts 4.7 and the tracked.json re-check after 4.3, and place Story 4.8.
  evidence: epics.md *Order* predates the proposal and omits 4.7 and 4.8. epic-4-context.md now cites both sources, but a recompile from epics.md would bring the stale order back. The PM owns epics.md, so a build review does not edit it (AGENT-WORKFLOW.md *Review brief*, rule 2).
  retry_when: now
