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
  summary: Move the CraftRecipe and PayoutThreshold panels from the interim band into the header-bar recipe and threshold slots, then delete frame/InterimControls.tsx and the data-interim-controls band.
  evidence: The frozen decision (Open Question 1, option B) in the spec. packages/web/src/frame/InterimControls.tsx holds the band, and the data-slot="recipe|threshold|sync" divs in packages/web/src/frame/HeaderBar.tsx stay empty.
  retry_when: Story 4.5 is done in sprint-status.yaml

- source_spec: `docs/stories/spec-4-1-the-dark-token-set-bundled-inter-and-the-sticky-header-bar.md`
  summary: Re-measure the reserved header-bar slot widths (recipe 294, threshold 238, sync 128) against the real controls, and add a test that the brand block, slots and gaps fit the bar at content-min.
  evidence: HEADER_SLOT_WIDTHS in packages/web/src/frame/HeaderBar.tsx came from the mockup at 1000px (about 939px of 952px). No test holds the budget sum.
  retry_when: Story 4.5 is done in sprint-status.yaml

- source_spec: `docs/stories/spec-4-1-the-dark-token-set-bundled-inter-and-the-sticky-header-bar.md`
  summary: Restyle the components Story 4.1 repointed mechanically, replace the interim px values in the tokens.ts layout group, change weight 700 to the DESIGN.md weights, and fix the failure screen to padding-top 24px and a 640px body.
  evidence: Spec Design Notes call the repointing interim. Weight 700 in recipe.css, TrustStrip.tsx, KeyBlock.tsx, FailureScreen.tsx and TrustMark.tsx. FailureScreen reads layout.gutter (34) and layout.failureBodyMaxWidth (480). UniformPriorBanner lead and body share the line-text role and differ only by colour.
  retry_when: Story 4.6 is done in sprint-status.yaml

- source_spec: `docs/stories/spec-4-1-the-dark-token-set-bundled-inter-and-the-sticky-header-bar.md`
  summary: Remove italic from the page, since DESIGN.md Typography says the page sets no italic and only upright Inter faces are bundled, so every italic run is a synthesized oblique.
  evidence: About 10 fontStyle italic sites in packages/web/src (RankedRow, CombinationRow, ExpansionPanel, AskingPriceLine, UnrankableAppendix, CraftRecipe, TrustStrip, SyncReportPanel, TrustMark). TrustMark's italic is the NFR-10 cue for never attempted, so it goes when Story 4.3 draws the marks.
  retry_when: Story 4.3 is done in sprint-status.yaml

- source_spec: `docs/stories/spec-4-1-the-dark-token-set-bundled-inter-and-the-sticky-header-bar.md`
  summary: Re-pin the values whose literal tests Story 4.1 removed (the resident glyph twins, the 1.2 line height of in-row roles, and the threshold gaps and marker rise) once their replacements land.
  evidence: The tests were deleted from packages/web/src/theme/tokens.test.ts. glyphs.prior and glyphs.close and layout.thresholdTrackGap, thresholdRangeGap, thresholdValueGap and thresholdMarkerRise are now unpinned.
  retry_when: Story 4.5 is done in sprint-status.yaml

- source_spec: `docs/stories/spec-4-2-the-price-trust-verdict-in-core.md`
  summary: Make core return a recipeless-class group when the published recipe set is empty, with each crafted class's pending no-recipe verdict and its per-entry verdicts, so state 43 can list crafted rows unranked.
  evidence: Story 4.2 Decision 1. rank in packages/core/src/rank.ts returns no crafted row when recipes is absent or empty, so the Price trust rule "No recipe is published" has no row to carry it.
  retry_when: Story 4.3 is done in sprint-status.yaml

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
  evidence: Decided 2026-10-10 (option 1 of three): follow *Ages*; the *Price trust* table's `tried N days ago` is the from-one-day case. The no-listings reason in contracts carries whole days only (`{ kind: 'no-listings', days? }`), and core fills it at packages/core/src/price-trust.ts:73, so lineReasonWords in packages/web/src/list/row/trust-words.ts cannot print a sub-day age. Needs contracts and core to carry the attempt age at minute grain (check AD-17), then the web wording. A sync runs about every 15 hours, so a fresh no-listings attempt is the common case.
  retry_when: now
