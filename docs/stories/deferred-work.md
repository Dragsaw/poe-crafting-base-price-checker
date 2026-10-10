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

- source_spec: `docs/stories/spec-4-2-the-price-trust-verdict-in-core.md`
  summary: Make core return a recipeless-class group when the published recipe set is empty, with each crafted class's pending no-recipe verdict and its per-entry verdicts, so state 43 can list crafted rows unranked.
  evidence: Story 4.2 Decision 1. rank in packages/core/src/rank.ts returns no crafted row when recipes is absent or empty, so the Price trust rule "No recipe is published" has no row to carry it.
  retry_when: Story 4.3 is done in sprint-status.yaml

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

## Deferred from: spec-4-5-header-controls-and-the-sync-button (2026-10-10)

- source_spec: `docs/stories/spec-4-5-header-controls-and-the-sync-button.md`
  summary: Repair docs/stories/epic-4-context.md: the order sentence "4.3, then 4.7 ahead of 4.4 to 4.6, then 4.6 last" is garbled, and the rewrite dropped the Inter glyph check (− † * · — – at every weight) and the "no colour on a surface below the contrast floor" constraint without citing their owners.
  evidence: The epic-context rewrite that added Story 4.7 was in the working tree before this build's baseline. A review of Story 4.5 found the wording and the two dropped lines.
  retry_when: now

## Deferred from: spec-4-6-the-footer-legend-list-statements-failure-screens-and-the-appendix-restyle (2026-10-10)

- source_spec: `docs/stories/spec-4-6-the-footer-legend-list-statements-failure-screens-and-the-appendix-restyle.md`
  summary: Wire the appendix's state 16 note in App.tsx. A raw Tracked Entry carries no (categoryId, className), so the page cannot tell which Item Class a ranked Raw Base belongs to.
  evidence: RawTrackedEntrySchema in packages/contracts/src/tracked-entry.ts holds only baseTypeId, itemLevelMin and status, and no artifact the page loads maps a baseTypeId to its class (epic-2 retro P1 notes the same gap for Story 2.8). UnrankableAppendix takes an optional rawRanks set and prints the note, but ReadyBody passes none. Needs a contracts or core change that the Story 4.6 spec forbids, so a human must choose the source of the join.
  retry_when: Story 4.8

- source_spec: `docs/stories/spec-4-6-the-footer-legend-list-statements-failure-screens-and-the-appendix-restyle.md`
  summary: Decide how an appendix row lays out a joined two-part note; the row is nowrap and the note cell has no overflow guard.
  evidence: The 14 + 16 joined note is about 93 characters, about 560px at the note size, against about 450px for the 1fr note column at the target width. No single note overflows today, and the joined note appears only once Story 4.8 wires state 16.
  retry_when: Story 4.8
