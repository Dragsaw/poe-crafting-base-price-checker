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

- source_spec: `docs/stories/spec-4-1-the-dark-token-set-bundled-inter-and-the-sticky-header-bar.md`
  summary: Restyle the components Story 4.1 repointed mechanically, replace the interim px values in the tokens.ts layout group, change weight 700 to the DESIGN.md weights, and fix the failure screen to padding-top 24px and a 640px body.
  evidence: Spec Design Notes call the repointing interim. Weight 700 in recipe.css, TrustStrip.tsx, KeyBlock.tsx, FailureScreen.tsx and TrustMark.tsx. FailureScreen reads layout.gutter (34) and layout.failureBodyMaxWidth (480). UniformPriorBanner lead and body share the line-text role and differ only by colour.
  retry_when: Story 4.6 is done in sprint-status.yaml

- source_spec: `docs/stories/spec-4-3-the-ranked-row-rarity-names-the-uncrafted-base-line-the-mark-slot-and-the-odds-cue.md`
  summary: Delete packages/web/src/list/TrustMark.tsx, its unused 'prior' kind and glyphs.prior, and move its remaining readers (UnrankableAppendix, KeyBlock) to the drawn marks in packages/web/src/marks/.
  evidence: The Story 4.3 spec's Never list gives the TrustMark deletion to Story 4.6, but the Story 4.6 retirement list in docs/stories/epic-4-context.md names only UniformPriorBanner, KeyBlock, TrustStrip and RunningFoot. After Story 4.3 no production code renders TrustMark kind 'prior'.
  retry_when: Story 4.6 is done in sprint-status.yaml

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
  summary: Delete TrustStrip.tsx, its tests (frame/trust-strip.test.tsx, frame/trust-strip/) and any dependency-cruiser exception it has, now that no page mounts it.
  evidence: The spec's Design Notes and Never list leave the deletion to Story 4.6. packages/web/src/App.tsx no longer mounts TrustStrip; only its own tests render it.
  retry_when: Story 4.6 is done in sprint-status.yaml

- source_spec: `docs/stories/spec-4-5-header-controls-and-the-sync-button.md`
  summary: Pin glyphs.prior with a literal test, or retire it.
  evidence: The removed Story 4.1 re-pin entry also covered glyphs.prior. Its only test reference is `expect(text).not.toContain(glyphs.prior)` in packages/web/src/list/ranked-list/key-and-glyphs.test.tsx, which passes for any value.
  retry_when: Story 4.6 is done in sprint-status.yaml

- source_spec: `docs/stories/spec-4-5-header-controls-and-the-sync-button.md`
  summary: Repair docs/stories/epic-4-context.md: the order sentence "4.3, then 4.7 ahead of 4.4 to 4.6, then 4.6 last" is garbled, and the rewrite dropped the Inter glyph check (− † * · — – at every weight) and the "no colour on a surface below the contrast floor" constraint without citing their owners.
  evidence: The epic-context rewrite that added Story 4.7 was in the working tree before this build's baseline. A review of Story 4.5 found the wording and the two dropped lines.
  retry_when: now
