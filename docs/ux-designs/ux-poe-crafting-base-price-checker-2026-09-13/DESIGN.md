---
title: PoE2 Crafting Base Price Checker — Design
name: Field Guide
description: >-
  A reference-book page for one player, fixed at 1060x1920, read across a desk
  while the game runs. Warm paper, dense uniform rows, and two semantic inks
  that appear only when something is wrong.
status: final
revision: 2
created: 2026-09-13
updated: 2026-09-19
sources:
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/addendum.md
  - docs/briefs/brief-poe-crafting-base-price-checker-2026-09-12/brief.md
  - docs/briefs/brief-poe-crafting-base-price-checker-2026-09-12/addendum.md
  - docs/sprint-change-proposal-2026-09-13.md
  - docs/sprint-change-proposal-2026-09-19.md
mockups:
  - mockups/key-hero-resting.html      # the resting page at 1060x1920, 1:1
  - mockups/key-expanded-states.html   # every expanded and specimen state
visual-reference:
  - .working/direction-fieldguide-v2.html  # the chosen direction
  - .working/direction-fieldguide.html     # v1, superseded
  - .working/direction-terminal.html       # borrowed only: restrained colour emphasis

# Substrate: Mantine v9 (@mantine/core + @mantine/hooks 9.6.1) [ASSUMPTION — memlog 8].
# Every token below is an override of, or an addition to, Mantine's defaults.
# Mantine's own palette, radius scale, shadow scale and Inter-based type ramp are
# NOT inherited: this product replaces them wholesale. What is inherited is
# Mantine's component behaviour, layout primitives and CSS-variable mechanism.

colors:
  # --- ground and paper (no meaning, ever) ---
  surround: '#E8E3D4'          # outside the 1060px frame on a wider viewport
  paper: '#FDFBF3'             # the frame ground — warm book paper
  paper-inset: '#F5F1E4'       # threshold panel, unrankable appendix, split boxes, banner
  paper-deep: '#F0EADA'        # tombstone band, and the pointer-down active row
  paper-raw: '#F7F3E6'         # the Raw Base row tint
  paper-raw-hover: '#F2EDDC'   # the Raw Base row hovered — paper-raw stepped toward
                               # paper-deep, so the raw tint survives the hover
  # --- ink ---
  ink: '#211E17'               # primary text, and the strong rule
  ink-secondary: '#55503F'     # secondary text, chase-combination text
  ink-tertiary: '#8B8470'      # tertiary text, quiet rank numerals, unit suffixes
  ink-chase-emphasis: '#3E3A2C'  # chase text on ranks 1-5 only
  # --- structure ---
  rule-hairline: '#E0DAC6'     # between rows
  rule-strong: '#211E17'       # above a section, under a column header
  edge: '#D2CAB2'              # panel and frame borders
  # --- structural accent: decorative, carries no meaning ---
  sepia: '#6B4A22'
  # --- the two semantic inks, and there are only two ---
  # A third, slate '#2F4A73', carried Provenance `modelled-split` and retired
  # with it at weights contract 5.0.0. The slot is not reserved. See Colors.
  ochre: '#8A5A12'             # uniform-prior, and absent/unknown
  rust: '#8E3B1E'              # stale, never attempted, unresolvable

typography:
  # font stacks
  stack-serif:
    fontFamily: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif'
  stack-sans:
    fontFamily: '-apple-system, "Segoe UI", system-ui, "Helvetica Neue", sans-serif'

  # EVERY role declares lineHeight. Mantine's Text resolves 1.55 and Title resolves
  # its own headings ramp where a value is omitted, which breaks the 28px row and
  # every vertical number in this file. theme.lineHeights and theme.headings are
  # REPLACED, not inherited. Pass font sizes as literal px, not theme keys, so
  # --mantine-scale's rem conversion cannot round the .5px sizes.

  # masthead
  eyebrow:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 10px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: 0.22em
  masthead-title:
    fontFamily: '{typography.stack-serif.fontFamily}'
    fontSize: 38px
    fontWeight: '400'
    lineHeight: '1.15'
    letterSpacing: -0.012em
  dek:
    fontFamily: '{typography.stack-serif.fontFamily}'
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'

  # threshold control
  threshold-label:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 9.5px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.16em
  threshold-value:
    fontFamily: '{typography.stack-serif.fontFamily}'
    fontSize: 32px
    fontWeight: '400'
    lineHeight: '1.05'
  threshold-value-unit:
    fontFamily: '{typography.stack-serif.fontFamily}'
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.2'
  threshold-range:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 9.5px
    fontWeight: '400'
    lineHeight: '1.2'

  # trust strip and asking-price line
  trust-strip:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 11.5px
    fontWeight: '400'
    lineHeight: '1.85'
  asking-note:
    fontFamily: '{typography.stack-serif.fontFamily}'
    fontSize: 12.5px
    fontWeight: '400'
    lineHeight: '1.4'

  # the ranked table — every in-row role is 1.2 so the 28px row has headroom
  column-header:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 9.5px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.2em
  row-rank:
    fontFamily: '{typography.stack-serif.fontFamily}'
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.2'
  row-base-type:
    fontFamily: '{typography.stack-serif.fontFamily}'
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.2'
  row-ev:
    fontFamily: '{typography.stack-serif.fontFamily}'
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.2'
  row-mark:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 10px
    fontWeight: '600'
    lineHeight: '1.2'
  row-chase:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 10.5px
    fontWeight: '400'
    lineHeight: '1.2'
  raw-base-tag:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 9px
    fontWeight: '400'
    lineHeight: '1.2'
    letterSpacing: 0.13em

  # money-slot phrases (FR-9 / FR-4 resolution)
  money-phrase:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 10.5px
    fontWeight: '400'
    lineHeight: '1.2'

  # appendix, key block, foot
  appendix-title:
    fontFamily: '{typography.stack-serif.fontFamily}'
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.2'
  appendix-lead:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 11.5px
    fontWeight: '400'
    lineHeight: '1.55'
  appendix-row:
    fontFamily: '{typography.stack-serif.fontFamily}'
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.2'
  key-heading:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 9.5px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.18em
  key-body:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 10.5px
    fontWeight: '400'
    lineHeight: '1.85'
  running-foot:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 11px
    fontWeight: '400'
    lineHeight: '1.5'

  # expansion
  panel-title:
    fontFamily: '{typography.stack-serif.fontFamily}'
    fontSize: 20px
    fontWeight: '400'
    lineHeight: '1.2'
  panel-sub:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 11.5px
    fontWeight: '400'
    lineHeight: '1.5'
  detail-row:
    fontFamily: '{typography.stack-serif.fontFamily}'
    fontSize: 12.5px
    fontWeight: '400'
    lineHeight: '1.2'
  detail-meta:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 10.5px
    fontWeight: '400'
    lineHeight: '1.2'
  # Line two of a combination row. Identical to detail-meta except that its
  # lineHeight is ABSOLUTE, so a wrapped note grows the row by exactly
  # {spacing.combination-row-line-2-height} and the 48 + 20n arithmetic holds.
  combination-line-2:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 10.5px
    fontWeight: '400'
    lineHeight: '20px'
  tombstone-band-label:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 9.5px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.16em
  expand-affordance:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 12.5px
    fontWeight: '400'
    lineHeight: '1.5'
  banner-lead:
    fontFamily: '{typography.stack-serif.fontFamily}'
    fontSize: 13.5px
    fontWeight: '700'
    lineHeight: '1.35'
  banner-body:
    fontFamily: '{typography.stack-serif.fontFamily}'
    fontSize: 12.5px
    fontWeight: '400'
    lineHeight: '1.4'
  failure-body:
    fontFamily: '{typography.stack-serif.fontFamily}'
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.55'

rounded:
  none: '0px'
  DEFAULT: '0px'
  # Mantine's radius scale is overridden to zero everywhere. There is no
  # rounded corner anywhere in this product. See Shapes.

spacing:
  # the fixed frame — not a breakpoint, a constant.
  # 1060, NOT 1080: the target viewport is 1080 wide and the document scrolls
  # once a panel opens, so a ~17px vertical scrollbar has to fit. 1060 + the
  # outline's 2px leaves ~1px of slack. Do not change this back to 1080.
  frame-width: '1060px'
  frame-height: '1920px'
  frame-padding-x: '24px'
  content-width: '1012px'   # 1060 − 48. Unchanged: the scrollbar came out of
                            # the gutters, never out of a column.
  # the ranked-row column budget (memlog 40) — these six add to content-width, exact
  col-rank: '32px'
  col-base-type: '222px'
  col-ev: '84px'
  col-provenance: '88px'
  col-age: '94px'
  col-chase: '492px'
  chase-cell: '164px'
  # per-column right padding — load-bearing, because every one of these columns
  # ellipsises and the padding decides how much text survives
  pad-rank-right: '10px'
  pad-base-type-right: '8px'
  pad-ev-right: '12px'
  pad-chase-cell-right: '10px'
  # the Unrankable appendix column budget — sums to 970px (1012 − 2 border − 40 padding)
  col-appendix-base: '292px'
  col-appendix-mark: '118px'
  col-appendix-reason: '250px'
  col-appendix-note: '310px'
  # the combination-row column budget. TWO LINES (memlog 101), each summing to
  # 966px (1012 − 2 border − 44 padding). Line one is the figure, line two is the
  # evidence for it.
  col-combination: '460px'
  col-combination-state: '250px'
  col-combination-figure: '116px'
  col-combination-sample: '116px'
  col-combination-trade-link: '24px'   # {components.trade-link}, funded from col-combination-figure (140->116)
  col-combination-note: '560px'
  col-combination-age-observed: '200px'
  col-combination-age-attempted: '206px'
  # a tombstone's line two: the two age cells are replaced by one date cell
  col-tombstone-removed: '406px'
  pad-combination-cell-right: '12px'
  # row metrics — exact
  row-height: '28px'
  appendix-row-height: '29px'
  # detail-row-height is retained and now means line ONE of a combination row.
  detail-row-height: '28px'
  combination-row-line-2-height: '20px'
  combination-row-height: '48px'   # a MINIMUM: line two wraps by whole 20px lines
  hairline: '1px'
  banner-marker: '5px'
  open-row-marker: '3px'
  # the vertical budget. frame-slack is COMPUTED from the committed block heights
  # at the line-heights declared above (see Layout & Spacing for the arithmetic).
  # The two reservations are charged against it by data, not by a click.
  # sync-report-max-height is an INDEPENDENT cap, chosen to fit the worst case.
  frame-slack: '528px'
  frame-reserve-banner: '74px'
  frame-reserve-health-line: '21px'
  sync-report-max-height: '400px'
  # the general fallback scale, quantised from the mock at 4px. Used for any gap
  # not given an exact token above. Nothing here is dead.
  '1': '4px'
  '2': '8px'
  '3': '12px'
  '4': '16px'
  '5': '20px'
  '6': '24px'
  gutter: '34px'
  threshold-panel-width: '276px'
  dek-max-width: '640px'

components:
  masthead:
    paddingTop: '{spacing.gutter}'
    paddingBottom: '{spacing.5}'
    eyebrow: '{typography.eyebrow}'
    eyebrowColor: '{colors.sepia}'
    title: '{typography.masthead-title}'
    titleColor: '{colors.ink}'
    dek: '{typography.dek}'
    dekColor: '{colors.ink-secondary}'
    dekMaxWidth: '{spacing.dek-max-width}'
    gapEyebrowToTitle: '{spacing.2}'
    gapTitleToDek: '{spacing.2}'
    thresholdPlacement: '{components.payout-threshold} floated right inside the masthead block at {spacing.threshold-panel-width}, top-aligned with the eyebrow, cleared by the trust strip'
    copyEyebrow: 'League {activeLeague} · one perfect transmute + one perfect augment'
    copyTitle: 'the question the page answers, as a phrase — not a product name'
    copyDek: 'one sentence naming what the ordering is and that every figure is in Divine'
  ranked-row:
    height: '{spacing.row-height}'
    background: '{colors.paper}'
    borderBottom: '{spacing.hairline} solid {colors.rule-hairline}'
    columns: 'rank {spacing.col-rank} · base {spacing.col-base-type} · ev {spacing.col-ev} · provenance {spacing.col-provenance} · age {spacing.col-age} · chase {spacing.col-chase}'
    rankType: '{typography.row-rank}'
    nameType: '{typography.row-base-type}'
    evType: '{typography.row-ev}'
    markType: '{typography.row-mark}'
    chaseType: '{typography.row-chase}'
    chaseText: 'Accepted Tier then canonical short form, per affix · never the modifier value · e.g. "T1 Cold Res · T1 Mana" · see Layout & Spacing'
    numerals: 'tabular-nums on rank, EV and every figure'
    padding: '{spacing.pad-rank-right} · {spacing.pad-base-type-right} · {spacing.pad-ev-right} · {spacing.pad-chase-cell-right}'
    hoverBackground: '{colors.paper-inset}'
    activeBackground: '{colors.paper-deep}'
    openMarker: '{spacing.open-row-marker} solid {colors.sepia} left rule, plus borderBottom to {colors.rule-strong}'
  ranked-row-tier-1:
    appliesTo: 'ranks 1-5'
    nameWeight: '700'
    evWeight: '700'
    rankColor: '{colors.sepia}'
    rankWeight: '700'
    chaseColor: '{colors.ink-chase-emphasis}'
  ranked-row-tier-2:
    appliesTo: 'ranks 6-10'
    rankColor: '{colors.ink-secondary}'
  ranked-row-tier-3:
    appliesTo: 'ranks 11-20'
    rankColor: '{colors.ink-tertiary}'
  raw-base-row:
    background: '{colors.paper-raw}'
    hoverBackground: '{colors.paper-raw-hover}'
    nameStyle: 'italic'
    nameCell: 'flex: name flexes and ellipsises, tag is flex 0 0 auto and never truncates'
    tag: '{typography.raw-base-tag}'
    tagText: 'RAW BASE'
    tagColor: '{colors.sepia}'
    tagRule: '{spacing.hairline} solid {colors.sepia}'
    chaseSlot: 'one full-width note in {typography.row-chase}, italic, {colors.ink-tertiary}, naming the Item Level Floor'
    expansionNote: 'line two note cell of its single combination row reads "no affixes — this Base Type priced as it drops, at Item Level 82"'
  column-header:
    typography: '{typography.column-header}'
    color: '{colors.ink-tertiary}'
    borderBottom: '{spacing.hairline} solid {colors.rule-strong}'
    paddingBottom: '{spacing.1}'
    layout: 'the same six fixed-width flex cells as {components.ranked-row}, never inline-block spans'
    labels: '(blank) · Base Type · EV (Divine) · Provenance · Age · Chase Combinations, by contribution to EV'
    trailingLetterSpace: 'not trimmed. Every label fits its column as tracked. A column header never ellipsises.'
  # A trust mark carries colour, weight, glyph and word only. It takes the type
  # size of the line it sits in — {typography.row-mark} in a ranked row,
  # {typography.appendix-row} in the appendix, {typography.key-body} in the key
  # block — so the vocabulary is one vocabulary at whatever size the line is.
  trust-mark-prior:
    color: '{colors.ochre}'
    glyph: '◇'
    word: 'prior only'
    fontWeight: '600'
  trust-mark-unknown:
    color: '{colors.ochre}'
    glyph: '?'
    word: 'unknown'
    fontWeight: '600'
  trust-mark-stale:
    color: '{colors.rust}'
    glyph: '↻'
    word: 'priced Nd ago | tried Nd ago'
    fontWeight: '700'
  trust-mark-never:
    color: '{colors.rust}'
    glyph: '↻'
    word: 'never attempted'
    fontWeight: '700'
    fontStyle: 'italic'
  trust-mark-unresolvable:
    color: '{colors.rust}'
    glyph: '✕'
    word: 'unresolvable'
    fontWeight: '700'
  # Distinct role from the trust marks: these label a Price State inside an
  # expansion. ✕ therefore appears twice on purpose — at 700 as the ranked-row
  # trust mark, at 600 as the expansion's Price State glyph. Not a contradiction.
  price-state-glyph:
    priced: '●'
    no-listings: '○'
    not-yet-synced: '△'
    unresolvable: '✕ in {colors.rust}, fontWeight 600'
  money-slot:
    typography: '{typography.money-phrase}'
    fontStyle: 'italic'
    color: '{colors.ink}'
    colorUnresolvable: '{colors.rust}'
    phrases: 'an open question | no figure yet | not valued | unknown'
  # The figure IS the input (memlog 73). There is no field, no box, no form chrome.
  payout-threshold:
    width: '{spacing.threshold-panel-width}'
    background: '{colors.paper-inset}'
    border: '{spacing.hairline} solid {colors.rule-hairline}'
    padding: '13px 15px'
    label: '{typography.threshold-label}'
    labelColor: '{colors.ink-tertiary}'
    labelText: 'PAYOUT THRESHOLD'
    value: '{typography.threshold-value}'
    valueColor: '{colors.ink}'
    valueNumerals: 'tabular-nums'
    valueIsInput: true
    valueRestingRule: '{spacing.hairline} dotted {colors.sepia} under the figure only, not under the unit'
    valueHoverRule: '{spacing.hairline} solid {colors.sepia}'
    valueEditingRule: '{spacing.hairline} solid {colors.rule-strong}'
    caretColor: '{colors.ink}'
    selectionBackground: '{colors.paper-deep}'
    unit: '{typography.threshold-value-unit} in {colors.ink-secondary}, reading "Divine", outside the editable figure and never selected by it'
    min: '0'
    max: '3'
    step: '0.05'
    decimalScale: '2'
    clampBehavior: 'on blur'
    readout-track-height: '4px'
    readout-track-background: '{colors.rule-hairline}'
    readout-fill: '{colors.sepia}'
    readout-marker: '11px x 14px, {colors.ink}'
    readoutRange: '{typography.threshold-range} in {colors.ink-tertiary}, endpoints "0 Divine" and "3 Divine"'
    readoutInteractive: false
  trust-strip:
    borderTop: '{spacing.hairline} solid {colors.rule-strong}'
    borderBottom: '{spacing.hairline} solid {colors.rule-hairline}'
    typography: '{typography.trust-strip}'
    color: '{colors.ink-secondary}'
    labelColor: '{colors.ink}'
    labelWeight: '600'
    cursor: 'pointer'
    affordance: '{typography.expand-affordance} in {colors.sepia}, right-aligned on the first line: "+ the full sync report" closed, "— the full sync report" open'
    affordanceHoverRule: '{spacing.hairline} dotted {colors.sepia}'
    restingFacts: 'line 1 lead "Weights File", then "producer", "generatedAt", "gamePatch" — line 2 "Last synced", then "Tracked List last edited"'
    restingFactsRule: 'five plain facts, unconditional, no mark and no colour on any of them. They are attribution, not health signals.'
    healthLine: 'a third line, raised only when a health figure is bad. Each signal is a rust mark with its glyph, its word and its count.'
    healthSignals: 'unresolvable entries exist · pinned entries starved'
    healthLineHeight: '{spacing.frame-reserve-health-line}'
  sync-report-panel:
    background: '{colors.paper-inset}'
    borderTop: '{spacing.hairline} solid {colors.rule-hairline}'
    borderBottom: '{spacing.hairline} solid {colors.rule-hairline}'
    padding: '14px 16px 12px'
    maxHeight: '{spacing.sync-report-max-height}'
    overflowY: 'auto'
    columnHeading: '{typography.key-heading}'
    columnHeadingColor: '{colors.ink-tertiary}'
    columnHeadingRule: 'ONE heading per column, never per group. A column that holds two groups prints its heading once. It separates the two groups by {spacing.2} of vertical space. No second heading, no rule, no bullet.'
    body: '{typography.key-body}'
    bodyColor: '{colors.ink-secondary}'
    figureColor: '{colors.ink}'
    figureFeature: 'tabular-nums'
    columns: '3 equal, matching {components.key-block}, carrying five figure groups'
    column1: 'THE SYNC RUN — requests per source · entries not reached in the last sync pass'
    column2: 'WHAT IS BROKEN — unresolvable count · pinned-starvation records'
    column3: 'WHAT THE WEIGHTS COVER — pool coverage, as a fraction with its denominator. The tracked-list edit date is NOT repeated here. It is a resting fact on the strip two lines above.'
  asking-price-line:
    typography: '{typography.asking-note}'
    fontStyle: 'italic'
    color: '{colors.sepia}'
  uniform-prior-banner:
    background: '{colors.paper-inset}'
    borderLeft: '{spacing.banner-marker} solid {colors.ochre}'
    padding: '13px 17px'
    lead: '{typography.banner-lead}'
    body: '{typography.banner-body}'
  unrankable-appendix:
    background: '{colors.paper-inset}'
    border: '{spacing.hairline} solid {colors.rule-hairline}'
    padding: '16px 20px 10px'
    title: '{typography.appendix-title}'
    lead: '{typography.appendix-lead}'
    leadColor: '{colors.ink-secondary}'
    countColor: '{colors.rust}'
    rowHeight: '{spacing.appendix-row-height}'
    rowType: '{typography.appendix-row}'
    columns: 'base {spacing.col-appendix-base} · mark {spacing.col-appendix-mark} · reason {spacing.col-appendix-reason} · note {spacing.col-appendix-note}'
    lastRowRule: 'none'
  key-block:
    borderTop: '{spacing.hairline} solid {colors.rule-strong}'
    columns: '3 equal'
    columnTitles: 'Silence means healthy · Provenance marks · Age marks'
    heading: '{typography.key-heading}'
    body: '{typography.key-body}'
  expansion-panel:
    background: '{colors.paper}'
    border: '{spacing.hairline} solid {colors.edge}'
    padding: '18px 22px 20px'
    width: '{spacing.content-width}'
    marginTop: '0'
    marginBottom: '{spacing.4}'
    join: 'flush under its row. The row keeps its openMarker. The row borderBottom becomes the panel top edge, so there is no double rule.'
    title: '{typography.panel-title}'
    sub: '{typography.panel-sub}'
  combination-row:
    lines: 2
    minHeight: '{spacing.combination-row-height}'
    line1Height: '{spacing.detail-row-height}'
    line2Height: '{spacing.combination-row-line-2-height}'
    typography: '{typography.detail-row}'
    borderBottom: '{spacing.hairline} solid {colors.rule-hairline}'
    line1Columns: 'combination {spacing.col-combination} · state {spacing.col-combination-state} · figure {spacing.col-combination-figure} · sample {spacing.col-combination-sample} · trade-link {spacing.col-combination-trade-link}'
    line2Columns: 'note {spacing.col-combination-note} · observation age {spacing.col-combination-age-observed} · last-attempted age {spacing.col-combination-age-attempted}'
    padding: '{spacing.pad-combination-cell-right} on every cell'
    line2Type: '{typography.combination-line-2}'
    metaType: '{typography.detail-meta}'
    ellipsis: 'none. Nothing in an expansion ellipsises. Line two wraps instead.'
    wrapQuantum: '{spacing.combination-row-line-2-height} exactly, because line2Type sets an absolute lineHeight'
    below-threshold-note: '{typography.detail-meta}, italic, {colors.ink-tertiary}'
  # The one exception to "no icon" (see Components, One denomination / one icon).
  # A single unicode glyph, joining the existing glyph vocabulary rather than
  # adding an SVG or image asset — the page still downloads nothing (NFR-7).
  trade-link:
    glyph: '↗'
    restColor: '{colors.ink-tertiary}'
    hoverColor: '{colors.sepia}'
    typography: 'takes the type size of the line it sits in, same rule as a trust mark'
    clickTarget: 'the glyph only — not the row, not the cell'
    renderedWhen: 'the entry carries a stored lastSearchId AND its lastSearchLeague equals the active league of data/config.json — a test on the stored field, never on Price State (PRD FR-33, FR-21; AD-9, AD-24)'
    hiddenWhen: 'no lastSearchId — a never-synced row, and an entry found unresolvable offline before any request was issued (PRD FR-24) · lastSearchLeague differs from the active league, so the id points into a previous league (PRD FR-31) · a pruned tombstone row'
    appliesTo: '{components.combination-row}, including the Raw Base row''s single combination — never {components.tombstone-band}'
  tombstone-band:
    background: '{colors.paper-deep}'
    borderTop: '2px solid {colors.edge}'
    label: '{typography.tombstone-band-label}'
    rowColor: '{colors.ink-tertiary}'
    nameDecoration: 'line-through'
    marker: '† pruned'
    lastRowRule: 'none'
    rowShape: 'the two-line {components.combination-row}, with line two re-cut'
    line2Columns: 'prune reason {spacing.col-combination-note} · removal date {spacing.col-tombstone-removed}'
    removalDateCopy: 'removed YYYY-MM-DD — a calendar date, never a clock reading'
  expand-affordance:
    typography: '{typography.expand-affordance}'
    color: '{colors.sepia}'
    toggleRule: '{spacing.hairline} dotted {colors.sepia}'
    listCopyClosed: '+ Read the remaining {N} Base Types'
    listCopyOpen: '— Show only the top 20'
  running-foot:
    borderTop: '{spacing.hairline} solid {colors.rule-hairline}'
    typography: '{typography.running-foot}'
    color: '{colors.ink-tertiary}'
  # The two failure screens (memlog 75). Same shape, different copy. Both replace
  # the whole page: no masthead, no list, no appendix, nothing stale served.
  refusal-screen:
    background: '{colors.paper}'
    paddingTop: '{spacing.gutter}'
    eyebrow: '{typography.eyebrow} in {colors.rust}, reading "THE PAGE WILL NOT RENDER THIS"'
    title: '{typography.masthead-title}'
    titleText: 'A published file does not match its schema.'
    body: '{typography.failure-body}'
    bodyColor: '{colors.ink-secondary}'
    bodyMaxWidth: '{spacing.dek-max-width}'
    mark: '{components.trust-mark-unresolvable} glyph and word beside the artifact name'
    names: 'which artifact, which schema version it declared, which the page expects'
    recovery: 'one sentence. The page renders again as soon as a valid set is published. The page serves nothing old in the meantime.'
  fetch-failure-screen:
    background: '{colors.paper}'
    paddingTop: '{spacing.gutter}'
    eyebrow: '{typography.eyebrow} in {colors.rust}, reading "THE PAGE COULD NOT LOAD ITS DATA"'
    title: '{typography.masthead-title}'
    titleText: 'One of the eight files did not arrive.'
    body: '{typography.failure-body}'
    bodyColor: '{colors.ink-secondary}'
    bodyMaxWidth: '{spacing.dek-max-width}'
    names: 'which artifact failed'
    recovery: '{components.expand-affordance} reading "+ Try again", plus one sentence saying the page shows nothing rather than a partial set (FR-33)'
---

## Brand & Style

This is a page, not an app. It is a field guide for one player, left open on a
second monitor for the length of a play session, and read at an angle from
across the desk while the game runs in front of him. Everything follows from
that: warm paper instead of a glowing panel, twenty rows of uniform height
instead of cards, and colour that means something only when something is wrong.

The register is reference-book. A masthead with an eyebrow, a title and a dek.
Hairlines between entries. An appendix at the foot. A key block that tells the
reader how to read the page. The brief said appearance is not a priority. The
answer here is not decoration but legibility. The tool earns its place by being
readable in one glance, and by never looking more confident than its data
deserves.

Two things it refuses to be. It is not a dashboard: no tiles, no gauges, no
status lights, and nothing animates to attract attention. It is not a
spreadsheet: the type is a book serif, the numerals are tabular, and the page
is set rather than gridded.

**Substrate.** The system is Mantine v9 (`@mantine/core` + `@mantine/hooks`
9.6.1) `[ASSUMPTION — memlog 8, inherited from CLAUDE.md and the architecture
spine's Stack component, not yet confirmed by the user]`. Mantine's component
behaviour, layout primitives and CSS-variable theming are inherited. Mantine's
*appearance* is not: the palette, the radius scale, the shadow scale and the
Inter-based type ramp are all replaced by the tokens above. When a Mantine
default and a token here disagree, the token wins.

**The frame is fixed.** `{spacing.frame-width}` wide, centred on anything wider,
with `{colors.surround}` to the sides. 1920px is the height the resting page is
designed to fill exactly — it is a `min-height`, not a cap, and the page grows
past it only when the player opens something. There are no breakpoints, no
responsive story, and no dark mode. Do not add any.

## Colors

Two registers of colour, and the difference between them is the whole point.

**Paper and ink carry no meaning.** `{colors.paper}` `#FDFBF3` is warm
near-white book paper — chosen against the glare of a dark game at night, and
unmistakably light mode. `{colors.paper-inset}` `#F5F1E4` sets a panel back
from the page: the threshold control, the Unrankable appendix, the uniform-prior
banner. `{colors.paper-deep}` `#F0EADA` goes one step further back and has
exactly two uses, both of them momentary or set-apart: the tombstone band, and
a row under the pointer. `{colors.paper-raw}` `#F7F3E6` is the faint tint on a
Raw Base row — never on its own, always with an italic name and the word
*RAW BASE* (FR-3 forbids colour-alone). `{colors.paper-raw-hover}` `#F2EDDC` is
that tint hovered: `paper-raw` stepped toward `paper-deep` by the same distance
`paper` steps to `paper-inset`, so a hovered Raw Base row still reads as a Raw
Base row instead of collapsing onto the ordinary hover tone.

Ink runs in three steps plus one. `{colors.ink}` `#211E17` for anything read,
`{colors.ink-secondary}` `#55503F` for anything read second,
`{colors.ink-tertiary}` `#8B8470` for labels, units and the quiet rank
numerals. `{colors.ink-chase-emphasis}` `#3E3A2C` exists for one job: chase
text on ranks 1–5 sits a shade darker than the rest, so the top band reads
first without being bigger.

**Structure.** `{colors.rule-hairline}` `#E0DAC6` between rows,
`{colors.rule-strong}` (`#211E17`, the ink itself) above a section and under
the column header, `{colors.edge}` `#D2CAB2` around panels and the frame.

**`{colors.sepia}` `#6B4A22` is structural and means nothing.** Masthead
eyebrow, threshold fill, the Raw Base tag, the expand affordance. It is warm
and it is decorative and it never marks a state. If sepia ever starts to mean
something, it dilutes the two semantic inks below.

**Two semantic inks. There are two, and a third is not available.**
Each ink always comes with a glyph *and* a word, so removing the colour removes
nothing. This is memlog 15 and 41. It is PRD NFR-10, reframed as legibility.
See Do's and Don'ts.

| Ink | Hex | Means | Mark |
|---|---|---|---|
| `{colors.ochre}` | `#8A5A12` | Provenance `uniform-prior` — someone invented this weight | ◇ *prior only* |
| `{colors.ochre}` | `#8A5A12` | Provenance `absent` from a `partial` pool — an upper bound, not an estimate | ? *unknown* |
| `{colors.rust}` | `#8E3B1E` | Staleness, *never attempted*, and `unresolvable` — the things a patch or a stalled sync did | ↻ / ✕ with the word |

Ochre carries two states and rust carries three. They are told apart by glyph
and word, not by hue: degraded-weight is one family and broken-or-old is
another, and that is the distinction the colour draws.

**There were three, and the count is a consequence rather than a drift**
`[decision — memlog 172]`. A third ink, `slate` `#2F4A73`, carried Provenance
`modelled-split` with the mark ◈ *split by model* — measured, then a model
spread it across a value interval. Weights contract `5.0.0` withdrew the
producer's decomposition, which was that value's only source, so the value
became unreachable and was **retired rather than merged** (PRD §3 *Provenance*,
FR-10; AD-10). Merging it into `prior only` would have said someone invented a
weight that was in fact measured. The ink went with the value it existed for,
and it is recorded here so nobody reads two inks as a palette that lost its
nerve.

**The freed slot is not reserved, and that is a decision** `[decision — memlog
173]`. Two live `[NOTE FOR UX]` items are blocked on wanting a colour — the
`pinned` Curation Status, and the curation fallback for a modifier with no short
form or no declared Accepted Tier. Neither may have the slate. A semantic ink on
this page means **something is wrong with what a figure rests on**: ochre says
the weight is degraded, rust says the data is broken or old. `pinned` is a
curation *status* and the fallback is a curation *gap*; neither says anything
about the figure, and admitting either would make the ink family mean "notice
this", which is the meaning a page with twenty rows cannot afford. Both notes
should reach for a non-colour cue instead — a weight, an italic, a glyph, a rule
— which the page's vocabulary already carries and which costs the angled glance
nothing. Holding the slot open against a future third epistemic state would also
have been a reservation nobody could spend: if consumer-side pro-rating is ever
adopted, a middle Provenance value returns in that same change (AD-10's revisit
condition) and takes a fresh decision with it.

**No third ink, no success colour.** There is deliberately no green. A healthy
row is marked by nothing at all (memlog 32). Adding a green *measured* badge
would put a colour on nineteen rows out of twenty and make the one bad row
harder to find, which is exactly the failure PRD FR-11 describes.

## Typography

A book serif for anything the player reads as content, a system sans for
anything that labels it. The split is not decorative: it means the eye can tell
a figure from a note about a figure without reading either.

- **Serif — `{typography.stack-serif.fontFamily}`.** The masthead title, the
  dek, Base Type names, EV figures, appendix rows, expansion titles and detail
  rows. Numerals are tabular everywhere a column of numbers exists
  (`font-variant-numeric: tabular-nums` on rank, EV and price).
- **Sans — `{typography.stack-sans.fontFamily}`.** Column headers, eyebrow,
  every trust mark and every word beside one, chase-combination text, the
  money-slot phrases, the key block, the running foot, listing counts and ages.

Both stacks are system-resident. The page downloads no font. The page is static
and must paint before it fetches anything.

**Rank emphasis is carried by weight, never by size** (memlog 31b). Every
ranked row is `{spacing.row-height}` tall and every Base Type name is
`{typography.row-base-type.fontSize}`, from rank 1 to rank 20. Ranks 1–5 take
`fontWeight: 700` on the name and the EV, plus a sepia rank numeral. Ranks 6–10
take a mid-ink numeral. The rest are quiet. Nothing in the top five is larger
than anything in the bottom five. *The v1 direction gave the top five a 36px
band and the user rejected it. This is a deliberate departure from it.*

**The mark ramp.** Degraded marks (ochre) sit at `600`. Broken and stale
marks (rust) sit at `700`, and *never attempted* adds italic — the one row with
no age at all is also the one mark set in italic, so it is distinct from a
merely old row without a second colour.

**A trust mark has no size of its own.** It carries colour, weight, glyph and
word, and it takes the type size of the line it sits in:
`{typography.row-mark}` in a ranked row, `{typography.appendix-row}` in the
Unrankable appendix, `{typography.key-body}` in the key block, and
`{typography.trust-strip}` in the resting strip's health line. That is one
vocabulary rendered at four line sizes, not four vocabularies — the mark is
recognised by its glyph and its word, which never change.

**Tracking.** Every uppercase label is tracked out — `0.13em` on the Raw Base
tag, `0.16em` on the threshold label and the tombstone band, `0.18em` on key
headings, `0.2em` on column headers, `0.22em` on the masthead eyebrow. Uppercase
appears only at these five sizes and never in a sentence.

**Every role declares a `lineHeight`, and that is load-bearing.** The reference
render omitted them and fell to the browser's ~1.2. Mantine does not do that.
`Text` resolves `theme.lineHeights.md` (1.55) and `Title` resolves its own
headings ramp. Either value would break the `{spacing.row-height}` row, the
1920px fit and `{spacing.frame-slack}` at once. So:

- **Every in-row role is `1.2`** — `row-base-type`, `row-ev`, `row-rank`,
  `row-mark`, `row-chase`, `money-phrase`, `detail-row`, `detail-meta`,
  `appendix-row`, and every tracked uppercase label. At 14px, the tallest
  in-row type, that is a ~17px line box inside a 28px row with
  `align-items: center` — about 10px of headroom, and the row holds.
- **Display roles are tight**. `masthead-title` `1.15`, `threshold-value`
  `1.05`, `panel-title` and `appendix-title` `1.2`.
- **Reading roles breathe**: `dek` and `panel-sub` `1.5`, `appendix-lead`
  `1.55`, `failure-body` `1.55`, `trust-strip` and `key-body` `1.85`.

**Mantine deltas that this section depends on.** `theme.lineHeights` and
`theme.headings` are replaced, not extended — a `Title` that keeps Mantine's
ramp will not match `masthead-title`. `theme.primaryColor` defaults to blue and
would tint carets and selections on a page with no blue in it. Point it at a
palette built from `{colors.sepia}` and `{colors.ink}`. Pass every font size as
a literal `px` value, never as a theme size key, because `--mantine-scale`'s
`rem` conversion rounds the 9.5 / 10.5 / 11.5 / 12.5 / 13.5px sizes this page
depends on. `Accordion` and `Collapse` ship chevrons, control padding and their
own hover background. Strip all three to reach "no button chrome".

## Layout & Spacing

Two mockups render this section at 1:1.
[`mockups/key-hero-resting.html`](mockups/key-hero-resting.html) is the whole
resting page: the frame, the six-column ranked list across its three emphasis
tiers, the Unrankable appendix, the key block and the running foot.
[`mockups/key-expanded-states.html`](mockups/key-expanded-states.html) shows what
opening something does to the layout — an expansion in place, the tombstone band,
and the sync report panel pushing the page down.

**This spine wins on conflict with any mockup.** A mockup is an illustration of
the spine at one moment. Where a mockup and this document disagree, the document
is right and the mockup is out of date.

**The frame is a constant, not a breakpoint.** `{spacing.frame-width}` wide,
`{spacing.frame-padding-x}` of side padding, and `{colors.surround}` filling
whatever viewport is wider. Target is a **1080x1920** portrait second monitor.
Nothing reflows, nothing stacks, nothing collapses.

**The frame is 1060px, not 1080px, and that is deliberate.** The target viewport
is 1080px wide, and the obvious frame width is therefore 1080 — which is exactly
the mistake. This page **scrolls the document** once any panel opens (memlog
64), and a classic Windows vertical scrollbar takes about 17px out of the
viewport when it appears. At 1080 the frame would clip its own right edge the
moment a player expanded anything, or force a horizontal scrollbar underneath
the list. The 1px `outline` below makes it 2px worse again, because an outline
paints outside the box. `{spacing.frame-width}` is therefore **1060px**. That
leaves ~3px against a 17px bar, and the outline's 2px fits inside that.

**The 20px came out of the gutters, never out of a column.**
`{spacing.frame-padding-x}` drops 34 → 24 and `{spacing.content-width}` stays
exactly 1012: `1060 − 48 = 1012`. Every column contract, all five verified
sums and the 27-character chase budget survive untouched. The alternative —
holding 1080 and narrowing the content to 992 — would have taken the 20px out of
the chase cells, dropping them to ~158px and the budget to about 26 characters,
when 27 had already forced coining `ES` to fit Energy Shield beside a partner
affix. **A gutter has no contract. A chase cell does.** That is the trade, and
it is why this number looks wrong and is not. The argument survived the move to
tiers unchanged: `T1 Energy Shield · T2 Chaos Res` is 31 characters, so `ES` is
still the only way that pairing fits `[memlog 142]`.

**The frame's box model, exactly.** `width: {spacing.frame-width}`,
`box-sizing: border-box`, `padding: 0 {spacing.frame-padding-x}` — a content box
of exactly `{spacing.content-width}`, since `1060 − 2 × 24 = 1012`. The
`{colors.edge}` edge is drawn as a
**1px `outline`, not a `border`**, because an outline paints outside the border
box and consumes no width. That is the single measurement that gives way. The
edge moves from `border` to `outline`, and every column keeps the width it was
promised. The reference render used a border and hid the resulting 2px overflow
with `overflow: hidden`, which silently clipped the third chase cell. That
clipping is a defect of the mock, not a design decision. Do not reproduce it.
An outline is not a shadow and does not break the flat-surface rule.

**The open-row marker bleeds into the padding**, and that is the second
measurement that gives way. A `{spacing.open-row-marker}` left border inside a
border-box row whose six cells already total `{spacing.content-width}` would
push a column out by 3px. That is the same class of arithmetic failure as the
frame border, and it takes the same kind of answer. The row stays **content-box at
`{spacing.content-width}`** and the marker is drawn as `border-left:
{spacing.open-row-marker} solid {colors.sepia}` with `margin-left:
-{spacing.open-row-marker}`, bleeding into the frame's
`{spacing.frame-padding-x}` of side padding. **3px of a 24px gutter** is
consumed — still comfortably inside it after the frame narrowed, with 21px of
paper left to the outline — and no column moves. The row's cells do not shift
when it opens. That is the whole point. An open row must not make the list jump
sideways.

**The ranked-row column budget is a contract** (memlog 40). Six widths, adding
to `{spacing.content-width}`:

| Column | Token | Width |
|---|---|---|
| rank | `{spacing.col-rank}` | 32px, right-aligned, `{spacing.pad-rank-right}` |
| Base Type | `{spacing.col-base-type}` | 222px, ellipsis on overflow, `{spacing.pad-base-type-right}` |
| EV | `{spacing.col-ev}` | 84px, right-aligned, tabular, `{spacing.pad-ev-right}` |
| Provenance | `{spacing.col-provenance}` | 88px — **empty on a healthy row** |
| Age | `{spacing.col-age}` | 94px — **empty on a healthy row** |
| Chase Combinations | `{spacing.col-chase}` | 492px = three fixed `{spacing.chase-cell}` cells, `{spacing.pad-chase-cell-right}` each |

*Provenance is 88px, and the 12px came out of the chase cells.* At 76px the
column could not render its own widest mark. The width had to come from
somewhere. It came from the chase cells, which drop from 168px to 164px each,
because **a chase cell may ellipsise and a trust mark may not**. The chase text
resolves one click down in the expansion. The mark has no click beneath it. That
is the same principle that shapes the combination row below.

*The mark that bought those 12px has since retired, and the width stays*
`[decision — memlog 174]`. The 88px was sized against `◈ split by model` at
`{typography.row-mark}` — about 85px of glyph, hair space and fourteen
characters at 10px/600 — and that mark went with Provenance `modelled-split`
(see Colors). The widest surviving mark in this column is `◇ prior only`, which
leaves the column with slack it no longer needs. **The 12px is not clawed back.**
Every column budget on this page is a verified sum (memlog 140/145), reopening
one to hand 12px to a cell that is blank on most rows would put all six sums and
the 27-character chase budget back through verification for no gain the reader
can see, and a column with headroom cannot clip. `{spacing.col-provenance}` is
88px and stays 88px.

The Provenance and Age columns are narrow on purpose. Under the
silent-when-fine rule they are blank most of the time, so the width they would
have held went to the Chase Combinations instead. Chase cells are fixed at
`{spacing.chase-cell}` and ellipsise. They do not flex, because a column that
changes width row to row cannot be scanned down. This document tokenises the
per-column padding instead of giving a range. Every one of these columns
ellipsises, so the padding decides how much text survives. It is not a taste
decision.

*The chase cell's budget in characters.* 164px less
`{spacing.pad-chase-cell-right}` is 154px of usable width. At
`{typography.row-chase.fontSize}` that is roughly **27 characters**. The
canonical short-form table (memlog 34) is written against that number. A short
form that still overruns it ellipsises, like any other cell, and the full text
is one click down in the expansion.

**A Combination reads as tier plus short form, never as a value**
`[decision — memlog 134]`. `T1 Cold Res · T1 Mana`, not
`+35% Cold Res · +180 Mana`. The player operates on tiers and does not carry the
value spreads in their head, so the tier is the comparison the page should be
making. This governs **both** surfaces — the chase cell here and the expansion's
`{components.combination-row}` below. An exact value band therefore appears
nowhere in the product, except in the fallback at the end of this section.

*The tier is the Accepted Tier, declared by the curator* `[decision — memlog
135]`. It is read from a declared field on the Tracked List, written beside the
Modifier Reference's band. It is never derived from the band, and never joined
to the Weights File's `tierLabel`. PRD memlog 13 records that choosing the tier
and choosing the band are **one curation act**, so the label is a fact somebody
wrote down. That is what makes it honest. `T1` names the tier the player chose
to chase. It is not a measured property of any item the search returned, and the
page never claims it is. The declared field is `acceptedTier`, on the Modifier
Reference beside its band (PRD §3 *Accepted Tier*, FR-22; AD-5), and it is
display-only.

*A declared label may name a mixture* `[decision — memlog 137]`. `T1–T2` is
legal, and costs three more characters. AD-28 establishes that for a modifier
whose text carries more than one `#` — 53 of 63 item classes — the value axis
does not partition the tier axis. A band near a boundary necessarily includes
the neighbouring tier's tail, so the curator may genuinely be accepting a range.
`WEIGHTS-FILE-SCHEMA.md` already names `"T7–T8"` as an acceptable spelling. The
page prints what the curator accepted, rather than rounding it to a single tier
the band cannot support.

**How a short form may be coined.** 27 characters for a pair of affixes is not
generous, and the Glossary supplies no short form for most modifier text.
`T1 Energy Shield` alone is sixteen characters and leaves eight for the
separator and its partner. Dropping the values bought about two characters
there, because the modifier **name** was always the long part. So the
hand-maintained table must still coin forms the Glossary never named. It needs a
rule rather than a precedent. The rule has five parts:

1. **A Glossary term is never abbreviated.** *Divine*, *Base Type*, *Item Level
   Floor*, *Provenance* and every other §3 term are written out wherever they
   appear. This rule governs modifier text only, which the Glossary does not
   cover.
2. **Borrow, never invent.** A coined short form must be the form the player
   already reads in the game or on the trade site. `ES` for Energy Shield
   qualifies, and this document ratifies it as the first entry coined under this
   rule. An abbreviation that exists only in this table does not qualify,
   because the player would have to learn it from the tool to read the tool.
3. **Unique across the whole table.** No two modifiers may share a short form.
   Density is worth nothing if two rows read the same.
4. **Written once, never varied.** The same modifier reads identically on every
   row, every league. That stability is the entire argument for the table
   (memlog 34), and a per-row shortening would destroy it.
5. **The tier prefix is never abbreviated or varied** `[decision — memlog 141]`.
   `T1`, never `1`, `t1` or `Tier 1`. A mixture takes an en dash: `T1–T2`. The
   tier is the comparison the row exists to make, so it is the one part of the
   cell that may never be shortened. This rule replaces the earlier one that
   protected numerals and units, which assumed the quantity was what the player
   compared. It is not, any more. That clause survives in the fallback below,
   where numerals are the whole point.

If a modifier's shortest legitimate form still overruns 27 characters when
paired, that entry is a **candidate for pruning**, not for a shorter coinage —
never cut a word to fit.

**The fallback carries the value band, and one treatment covers both gaps**
`[decision — memlog 138]`. A tracked modifier missing either piece — no entry in
the short-form table, or no declared Accepted Tier — falls back to the Trade
Catalogue stat name **plus the value band**, visually identifiable as a
fallback, so the gap is noticed and filled `[ASSUMPTION — memlog 35]`. One
treatment covers both, because both are the same failure: nobody finished
curating that entry. In the fallback, and only there, numerals and units keep
their full symbols — `+240`, `%`, `+35%` are never compressed. That makes the
fallback the one place in the product where a numeral from modifier text
survives, which is exactly what makes it recognisable at a glance.
`[NOTE FOR UX]` No visual treatment for that fallback exists, and it may not
borrow a semantic ink. A semantic ink says something is wrong with what a figure
rests on; an uncurated entry is a gap in the Tracked List and says nothing about
the figure (see Colors). The treatment wants a non-colour cue.

`[NOTE FOR UX]` `[memlog 143, re-derived]` **Two Combinations can still read
identically.** The note was first written on the `4.x` reading, in which FR-22
had the curator track an **interior cell** and one tier could hold several — a
mechanism `5.0.0` withdrew, since an entry is a tier again and FR-22 now has the
curator track a whole tier or a run of adjacent tiers. **The hazard survives the
mechanism that produced it**, because the printed tier is the curator's declared
`acceptedTier` and nothing requires two tracked bands of the same modifier on
the same Base Type to declare different ones. The value text used to tell them
apart. The tier does not. Memlog 118 rule 3 guarantees uniqueness across the
short-form **table**, and that guarantee does not reach this case. The specimen
data avoids it only because every band in it landed in a distinct tier. Nobody
has ruled on what the second one prints.

**What may ellipsise, and where.** Truncation is legitimate only where the text
has somewhere to go. Every cell on the ranked list — Base Type, chase cell —
sits above an expansion that holds the same content in full, so ellipsis there
costs a click and nothing else. **The expansion is the bottom of the page.**
Nothing sits beneath a combination row, so nothing in one may be cut. No
ellipsis, no truncation, no tooltip standing in for text that did not fit. That
principle governs every future decision about what may be cut and where. It is
why the combination row is two lines and the chase cell is one.

*The column header uses the same six fixed-width flex cells as
`{components.ranked-row}`, never inline-block spans. Inline-block spans drift
each label right of its column by the width of the source whitespace between
them.
`PROVENANCE` is the widest header label at roughly 78px and now sits inside
`{spacing.col-provenance}` with room to spare. A column header never
ellipsises.*

**The other two tabular surfaces take contracts too**, on the same argument.
A reader scans down a column on both, exactly as on the ranked list:

| Surface | Columns | Sums to |
|---|---|---|
| `{components.unrankable-appendix}` | `{spacing.col-appendix-base}` · `{spacing.col-appendix-mark}` · `{spacing.col-appendix-reason}` · `{spacing.col-appendix-note}` | 970px = 1012 − 2 border − 40 padding |
| `{components.combination-row}` line 1 | `{spacing.col-combination}` 460 · `{spacing.col-combination-state}` 250 · `{spacing.col-combination-figure}` 116 · `{spacing.col-combination-sample}` 116 · `{spacing.col-combination-trade-link}` 24 | 966px = 1012 − 2 border − 44 padding |
| `{components.combination-row}` line 2 | `{spacing.col-combination-note}` 560 · `{spacing.col-combination-age-observed}` 200 · `{spacing.col-combination-age-attempted}` 206 | 966px |
| `{components.tombstone-band}` row, line 2 | `{spacing.col-combination-note}` 560 · `{spacing.col-tombstone-removed}` 406 | 966px |

Nothing on any of these surfaces flexes. The last column is a fixed width, not
a remainder. Every combination-row cell takes
`{spacing.pad-combination-cell-right}`. The figure column is right-aligned
against a left-aligned sample count, so that padding is what holds the two
apart. It is as load-bearing as the ranked row's four.

**Density is the brief.** All twenty ranked rows, the Unrankable appendix, the
key block and the running foot fit inside `{spacing.frame-height}` with no
scrolling. Rows are `{spacing.row-height}`, uniform, separated by a single
hairline and nothing else — no zebra striping, no padding beyond the tokenised
per-column values. The final row of the appendix and the final row of the
tombstone band drop their bottom hairline. A list does not rule itself off from
the space below it.

**Vertical order down the page, fixed:** masthead (with the threshold panel
floated right at `{spacing.threshold-panel-width}`) → trust strip →
*`{components.sync-report-panel}` when open* → asking-price line → column
header → twenty ranked rows → expand affordance → Unrankable appendix (pushed
to the foot) → key block → running foot.

**The vertical budget, computed.** Not estimated from the mock — computed from
the committed block heights at the line-heights this document now declares. The
appendix carries `margin-top: auto`, so whatever is left over lands between the
last ranked row and the appendix:

| Block | px |
|---|---|
| `{components.masthead}` — 34 pad + eyebrow 14 + 8 + title 44 + 8 + 2-line dek 42 + 20 pad | 170 |
| `{components.trust-strip}` — 2 rules + 23 pad + 2 lines @ 11.5 × 1.85 | 68 |
| `{components.asking-price-line}` | 32 |
| `{components.column-header}` — 16 margin + label + 4 pad + rule | 32 |
| 20 × `{spacing.row-height}` | 560 |
| list `{components.expand-affordance}` | 33 |
| `{components.unrankable-appendix}` — borders, padding, title, 2-line lead, 7 rows @ 29 | 306 |
| `{components.key-block}` — 22 margin + rule + 11 pad + tallest column 73 | 107 |
| `{components.running-foot}` — 18 margin + rule + 10 pad + 2 lines + 20 margin | 82 |
| **committed** | **1390** |
| **`{spacing.frame-slack}`** = 1920 − 1390 | **528** |

Two things are charged against that slack by **data**, not by a click, so they
belong to the resting budget and not to the expansion budget:

- `{spacing.frame-reserve-banner}` — 74px for `{components.uniform-prior-banner}`
  when the data raises it (memlog 30).
- `{spacing.frame-reserve-health-line}` — 21px for the trust strip's third line
  when a health figure is bad (memlog 70).

Worst-case resting height is therefore 1390 + 74 + 21 = **1485px**, leaving
**433px**. `{spacing.sync-report-max-height}` is set at **400px** — an
independent cap chosen to sit inside that worst case, not a restatement of the
slack. The panel scrolls inside its own band past 400px.

**What expansion spends, in order.**

1. **`{components.sync-report-panel}` opens against the slack**, capped at
   `{spacing.sync-report-max-height}`. The regions below move down into the
   space the appendix gives back. Because 400 ≤ 433, the strip alone never makes
   the page scroll, in any data state.
2. **A Base Type expansion is uncapped.** It holds every tracked Combination
   plus its tombstones, and no cap on it would be honest (FR-8). When an
   expansion, or an expansion plus the sync report, exceeds the slack, **the
   page scrolls**. That is intended. The no-scroll rule binds the *default
   resting state* (memlog 17), not a state the player opened himself.

**Which box scrolls — precisely.** The frame is `min-height:
{spacing.frame-height}`, not `height`. It grows with its content and **the
document scrolls**. The frame element itself never takes `overflow-y: auto`.
Neither does any region inside it, except `{components.sync-report-panel}`,
which is the one capped band on the page. So the appendix, the key block and the
running foot travel with the page rather than staying pinned over a scrolling
list. The page is a page, and its printed order stays true when it grows longer.
`margin-top: auto` on the appendix produces slack only while the content is
shorter than 1920px. Past that it produces none, which is exactly right.

The rule stated plainly: **nothing the player has not clicked may push the page
past 1920px** — with the banner and the health line as the two named exceptions,
both budgeted above. Collapse everything and the page must fit again exactly as
it did. Never shrink a row, drop a column, truncate the appendix or hide the key
block to keep an expanded state inside the frame. Density is fixed and scrolling
is the release valve.

`[NOTE FOR UX]` FR-4's middle coverage band (50–80%) requires the Unrankable
group to become a first-class surface rather than a footer. The chosen
direction depicts the ≥80% footer treatment only. What the first-class
treatment looks like is unsettled, and coverage is re-measured on every weights
regeneration, so this will be needed.

`[NOTE FOR UX]` **FR-30's world is deliberately unspecified** (memlog 72). Until
a conforming Weights File exists, every crafted Base Type is Unrankable and the
page is a white-base price list with an appendix holding the entire crafted
Tracked List. Three rules collide in that state. The appendix is pinned to the
foot as a *footer*. Truncating it is forbidden. And nothing unclicked may push
the page past 1920px. The likeliest resolution is that the appendix becomes the
surface and the resting-state rule yields to it. The user accepted designing
this at implementation time rather than now. This note records it so no reader
mistakes it for an oversight. It is close kin to the 50–80% band above, and
settling one probably settles the other.

**Spacing scale.** The general scale (`{spacing.1}`–`{spacing.6}`, 4–24px) is
quantised at 4px from the mock's values. It is the fallback for any gap not
given an exact token, so nothing in it is dead. `{spacing.gutter}` (34px) is the
masthead's top padding and the failure screens'. It is **no longer the frame's
side padding**, which is `{spacing.frame-padding-x}` (24px) and moves
independently of it. The two were equal until the frame narrowed, and they are
not the same measurement. The exact values — row heights, the column budgets,
the per-column padding, the 1px hairline, the 5px banner marker, the 3px
open-row marker — are *not* quantised and must be reproduced literally.

## Elevation & Depth

**There are no shadows.** Not on panels, not on the expansion, not on hover.
This page uses none of Mantine's shadow scale. Set `shadow="none"` wherever a
Mantine component ships one by default.

Depth is tonal and it has exactly three steps back from the page:
`{colors.paper}` → `{colors.paper-inset}` → `{colors.paper-deep}`. A
`{spacing.hairline}` `{colors.rule-hairline}` or `{colors.edge}` border and a
tone step separate a panel from the page, never lift. The third step has two
uses only — the tombstone band, and a row under the pointer. The band also takes
a 2px `{colors.edge}` top rule, the heaviest rule on the page, because pruned
entries must read as set apart rather than merely greyed (FR-8's "visually
separated").

The one directional mark on the page is the uniform-prior banner's
`{spacing.banner-marker}` ochre left edge. It is a rule, not a glow.

## Shapes

Everything is square. `{rounded.none}` is the only radius, and
`{rounded.DEFAULT}` is set to `0px` so Mantine's default rounding cannot leak
in — set `defaultRadius: 0` in the theme and do not pass `radius` to a
component.

The logic is print. A hairline-ruled table with rounded cells reads as a web UI.
With square corners it reads as a set page, which is what this is. Panels, the
threshold control, the banner, the tombstone band and the frame itself all take
hard corners. Pills and chips do not appear. A trust mark is a coloured word
with a glyph, not a badge with a background.

## Components

Every component below appears in one of the two mockups.
[`mockups/key-hero-resting.html`](mockups/key-hero-resting.html) holds the
resting set: the masthead, the threshold figure as an input, the five-fact trust
strip, the ranked row in all three tiers, the Raw Base row, the Unrankable
appendix, the key block and the running foot. It also carries the loud
health-line strip as a labelled specimen, which the resting page does not show
when the data is clean.
[`mockups/key-expanded-states.html`](mockups/key-expanded-states.html) holds
everything that opens: a Base Type expansion with all four Price States, the
tombstone band closed and open, the one-row Raw Base expansion, and the sync
report panel.

**Masthead** (`masthead`) — the first block on the page: `{spacing.gutter}` of
top padding, `{spacing.5}` beneath, and three lines with `{spacing.2}` between
each. The eyebrow is sepia tracked uppercase naming the active league and the
Craft Recipe. The title is the *question the page answers*, set as a phrase —
never a product name and never a feature label. The dek is one sentence, capped
at `{spacing.dek-max-width}`, naming what the ordering is and that every figure
is in Divine. `{components.payout-threshold}` floats right inside the block at
`{spacing.threshold-panel-width}`, top-aligned with the eyebrow and cleared by
the trust strip below.

*The eyebrow's exact copy* is `League {activeLeague} · one perfect transmute +
one perfect augment` — the Craft Recipe printed as its **composition**, worded
exactly as the PRD §3 Glossary words it, in the eyebrow's tracked uppercase.
`[NOTE FOR UX]` **The Craft Recipe has no canonical display name.** The Glossary
defines it as "a named crafting-currency composition" and then names only the
composition, never the name. Nothing in `recipes.json`'s stated contract is
declared to the view as a display string. Printing the composition is accurate
and unambiguous while v1 has exactly one recipe (FR-26), and it will not survive
a second one. If `recipes.json` carries a display name, that name should win —
but nobody has confirmed that it does, so this stays a copy slot with a stated
source rather than an invented one.

**Ranked row** (`ranked-row`) — `{spacing.row-height}`, six fixed columns, one
`{colors.rule-hairline}` bottom rule, `white-space: nowrap` throughout. Three
emphasis tiers (`ranked-row-tier-1/2/3`) differing only in weight and
rank-numeral colour. Rank, EV and every figure are tabular.

*Money figures.* EV, price and threshold all display at **2 decimal places**,
rounded for display only — `core` persists 4dp and the page never re-rounds
anything it passes on. **The unit is not repeated per row**: the EV column
header reads `EV (Divine)` and the cell holds the figure alone. That is what
retires the `div` abbreviation — the Glossary declares *Divine* verbatim-only,
so the page either spells it or does not print it, and twenty repetitions of a
unit that never varies is noise in a column 84px wide. A *present* figure that
is non-zero but rounds to `0.00` at 2dp renders **`< 0.01`** in
`{typography.row-ev}`, tabular — it is a quantity, so it is not a money slot and
it does not read as nothing. The floor exists because FR-23's own argument is
that a small figure coarsened to zero silently inflates every EV downstream.

*Hover and open.* Under the pointer a row takes `{colors.paper-inset}`. On
pointer-down it takes `{colors.paper-deep}`. A row **whose panel is open** takes
a `{spacing.open-row-marker}` `{colors.sepia}` left rule and promotes its bottom
rule to `{colors.rule-strong}`, and keeps both while any other row is hovered.
Tone alone cannot mark the open row, because hover uses the same tone — the rule
is what makes the source of an open panel identifiable at all times.

**Raw Base row** (`raw-base-row`) — `{colors.paper-raw}` tint (hovering to
`{colors.paper-raw-hover}`), italic Base Type name, and a sepia `RAW BASE` tag
underlined with a 1px sepia rule. **The tag is a sibling of the name, not part
of it**: the name flexes and ellipsises, the tag is `flex: 0 0 auto` and never
truncates, so a long Base Type can never strip away one of the three redundant
cues. The item level lives in the row's note instead of in the tag, spelled —
*uncrafted at Item Level 82 — ranked at its own current asking price, not at a
craft outcome* — which replaces the three chase cells as one full-width italic
note in `{colors.ink-tertiary}`. Three cues — tint, italic, word — so no one of
them is load-bearing.

*Expanding a Raw Base* shows **one `{components.combination-row}`**, drawn in
[`mockups/key-expanded-states.html`](mockups/key-expanded-states.html), for the
degenerate Combination of no affixes, carrying the same Price State, listing
sample size and both labelled ages as any other entry, plus the note above
(memlog 71). A Raw Base is a Tracked Entry and it has a Combination. Giving it
an empty expansion would strand its exact ages, and the expansion is where the
FR-12 override promised to put them.

**Column header** (`column-header`) — sans, uppercase, tracked `0.2em`,
`{colors.ink-tertiary}`, sitting on a `{colors.rule-strong}` rule, laid out in
the same six flex cells as the row. The rank column's header is blank. The
others read `Base Type`, `EV (Divine)`, `Provenance`, `Age`, and `Chase
Combinations, by contribution to EV`.

*The fourth column is called **Provenance**, not "Weight".* "Weight" is a
synonym for a term the Glossary fixes, and it collides with *Modifier Weight* —
a back-end term this page must not print. Worse, it misleads: `◇ prior only`
under a `WEIGHT` header reads as a claim about how rarely a modifier rolls,
when the claim being made is about where the figure came from. The key block's
middle group is likewise *Provenance marks*.

**Trust mark** — a glyph, a hair space, and a word, in one of the two
semantic inks. It is inline text: no background, no border, no capsule. Five
marks exist and no sixth may be added without a decision:
`trust-mark-prior`, `-unknown`, `-stale`, `-never`, `-unresolvable`. A healthy
row renders **no mark element at all** — the cell is empty, not filled with a
placeholder.

*A Provenance mark is one label per Base Type, and it belongs to the ranked
row.* Provenance propagates **pool-wide** — a probability's inputs are every
entry in its scoped pool, numerator and denominator alike — so one invented tier
anywhere makes every probability on that Base Type carry the same label (PRD
FR-10, FR-11; AD-10). The mark therefore discriminates **between** Base Types
and never within one. That is the granularity the ranked list already has, since
a ranked row **is** a Base Type, which is why the Provenance column earns its
place. It also fixes where the mark may not go: every combination row inside one
expansion necessarily carries that same label, so a Provenance mark is never
repeated per combination row. Repeating it would put eight identical marks
inside one panel and discriminate nothing — the failure FR-11 exists to prevent,
one surface further down.

**Money slot** (`money-slot`) — the EV or price cell when there is no number. It holds a short
italic sans phrase naming *which* question is open, never a number-shaped
placeholder (memlog 43): *an open question* (`no-listings`), *no figure yet*
(`not-yet-synced`), *not valued* (`unresolvable`, in `{colors.rust}`),
*unknown* (Provenance `absent`, as an ochre trust mark). Never `0`, never
`0.00%`, never an em dash.

**Payout Threshold control** (`payout-threshold`) — a
`{spacing.threshold-panel-width}` inset panel holding a tracked label, the
figure, a readout and the range endpoints.

**The figure is the input** (memlog 73). There is no field, no box and no form
chrome: the 32px serif number *is* the editable element. Click it and type over
it. At rest it carries a `{spacing.hairline}` dotted `{colors.sepia}` underline
beneath the digits only — the same dotted-sepia vocabulary every other
clickable thing on the page uses, which is what makes it read as editable
rather than as a label. On hover that underline goes solid sepia. While editing
it goes solid `{colors.rule-strong}`, with the caret in `{colors.ink}` and the
selection in `{colors.paper-deep}`. The `Divine` suffix sits outside the
editable region, spelled, in `{typography.threshold-value-unit}` — it is not
selected when the figure is, and it cannot be typed over.

*Constraints* (memlog 74): min `0`, max `3`, step `0.05`, two decimals, clamped
on blur. A negative threshold is not enterable.

**The track survives, as a readout.** The 4px sepia-filled track, its
`11 × 14px` ink marker and the `0 Divine` / `3 Divine` endpoints stay, and they
are **not interactive** — the marker cannot be dragged and the track cannot be
clicked. They exist to answer "where does 0.50 sit in the range I have", which
is the one thing a bare number cannot show. *This settles the open question: the
readout is kept, and it is a readout.*

*This is a deliberate override of UJ-2, which narrates the player dragging the
threshold. The user ruled for exactness and for masthead width. FR-6's immediate
reorder still binds and is satisfied by re-ranking on input change.*

**Trust strip** — the strip has two states, and it is the only expandable thing
on the page besides a Base Type row (memlog 57–59, which supersede decision 26).

*At rest.* Two sans lines between a `{colors.rule-strong}` rule above and a
`{colors.rule-hairline}` rule below, with the field labels in `{colors.ink}`
`600` and the values in `{colors.ink-secondary}`. They carry **five plain
facts**, always, with no mark and no colour on any of them: the Weights File's
`producer.id`, `generatedAt` and `gamePatch` (FR-10) on the first line. The
second line carries the last-synced time and the **tracked-list edit date**
(FR-18).
`[ASSUMPTION — memlog 27]` on the first four.

*The five labels, verbatim.* On-screen wording is binding, so these are the
strings, not a description of them:

| Line | Lead | Fields |
|---|---|---|
| 1 | `Weights File` | `producer` · `generatedAt` · `gamePatch` |
| 2 | `Last synced` | `Tracked List last edited` |

Line one's three field names are printed as FR-10 and the §3 Glossary spell
them, which is why they read as field names rather than as prose — they
identify a file, and this strip is the one place on the page where that
spelling is licensed. Line two is plain English, using the Glossary's *Tracked
List* verbatim. Fields on a line are separated by the strip's `|` in
`{colors.ink-tertiary}`.

*Why the edit date is a plain fact and not a mark* (memlog 89). It is
**attribution, not a health signal** — the same class of thing as the producer
and the patch, a statement of what this page was built from and when anyone last
touched it. Silent-when-fine governs *health signals*. It has never governed the
strip's unconditional facts, which is exactly why the other four are always
shown. Printing the date plainly satisfies FR-18 as written — "the player does
not have to search for the date" — and it does so without a staleness threshold
that nobody could defend. There is no age at which the date turns red.

**Silent while fine, loud when wrong** (memlog 70, 88). Both states are drawn in
[`mockups/key-hero-resting.html`](mockups/key-hero-resting.html) — the quiet
strip in the page itself, the loud one as a labelled specimen beneath it. Silent-when-fine is the
whole of memlog 32 only when its other half comes with it, and the earlier
reading of this strip — silent, always — dropped that half. So: when a health
figure is *bad*, the strip raises a **third line** carrying a rust mark with its
glyph, its word **and its count**. There are exactly two triggers, and both mean
something actually broke:

| Trigger | Line reads |
|---|---|
| any `unresolvable` entries exist (FR-24) | `✕ 12 unresolvable` |
| a pinned-starvation record is present (FR-17, FR-25) | `✕ pinned entries starved this run` |

Both triggers share the one line. A healthy sync raises no third line at all —
no counts of nothing, no green tick, no "0 unresolvable" — but a broken one is
visible without a click, which is what FR-24 and FR-25 require in their own
words. The line costs `{spacing.frame-reserve-health-line}` and is budgeted in
Layout & Spacing. `[ASSUMPTION — memlog 59]` that the strip is otherwise silent
at rest.

*The affordance.* The whole strip is the click target — the player is mouse-only
(memlog 13) and there is no keyboard affordance to add. It is marked by
`{typography.expand-affordance}` in `{colors.sepia}`, right-aligned on the first
line, reading `+ the full sync report` closed and `— the full sync report` open,
with the cursor as pointer and a `{spacing.hairline}` dotted sepia underline on
hover. It reuses the `{components.expand-affordance}` vocabulary exactly: sepia
text, a sign, no button chrome, no fill, no border. Nothing else about the
resting strip changes to advertise that it opens.

*Expanded* (`sync-report-panel`), drawn open in
[`mockups/key-expanded-states.html`](mockups/key-expanded-states.html). The full
Sync Report opens **in place**, as a
`{colors.paper-inset}` band bounded by a `{colors.rule-hairline}` rule top and
bottom, sitting directly beneath the resting strip and above the asking-price
line, pushing the asking-price line, the column header, the list and the
appendix down inside the frame `[ASSUMPTION — memlog 59]`. It is not a modal,
not a drawer and not a second surface. **One heading per column, never per
group** — two of the three columns hold two groups, and such a column prints its
heading once and separates its two groups by `{spacing.2}` of vertical space,
with no second heading, no rule and no bullet. Column headings take
`{typography.key-heading}`. Figures take `{colors.ink}` with tabular numerals.
Everything else takes `{typography.key-body}` in `{colors.ink-secondary}`. The
tone step and the two hairlines are what separate it — no shadow, no radius, no
indent. It is prose-with-figures, not a table, so it declares no row height.

Its five figure groups are assigned to the three columns, in this order:

| Column | Heading | Carries |
|---|---|---|
| 1 | THE SYNC RUN | requests per source (FR-14) · entries not reached in the last sync pass (FR-25) |
| 2 | WHAT IS BROKEN | the unresolvable count (FR-24) · the pinned-starvation records (FR-17, FR-25) |
| 3 | WHAT THE WEIGHTS COVER | pool coverage as a fraction **with its denominator** (FR-4) |

The first column is what the run did, the second is what broke, the third is how
much of the Tracked List the weights can actually speak to.

*The tracked-list edit date is not repeated here.* It is a resting fact on the
strip two lines above (memlog 89), and a panel whose job is to hold what the
resting page cannot show has no business restating something already on screen.

*The phrase is "entries not reached in the last sync pass", not "in this
Chunk".* **Chunk** is a back-end term this page does not print, and this panel
is read by the player rather than by whoever is fixing a file.

*Why one region and not two.* FR-25 asks for three figures that together tell
the player his list is not doing what he thinks it is, and all three reach him
through this one strip: the edit date as a resting fact (FR-18), the
unresolvable count and the starvation record as the loud line when they are bad
(FR-24, FR-25), and the full detail behind the click. Keeping the detail with
the identity it qualifies adds no navigation to a product whose IA is one page
(memlog 20).

**Asking-price line** — one italic serif sentence in `{colors.sepia}` under the
trust strip, stating that every price is a current asking price from a live
instant-buyout listing and that nothing on the page is an observed sale. FR-13
makes this the only mitigation in the system for Risk R-1. It is not optional
chrome and it does not move below the fold.

**Uniform-prior banner** — inset panel, 5px ochre left edge, the lead line as
an ochre trust mark, the consequence beneath in
`{typography.banner-body}`, and a dismiss control in the top right in
`{typography.detail-meta}` `{colors.ink-tertiary}`. Raised on a data condition,
not always (memlog 30).

**Unrankable appendix** (`unrankable-appendix`) — inset panel pinned to the foot
of the frame, titled `Appendix: Unrankable — N Base Types` with the count in
`{colors.rust}`, a lead paragraph in `{typography.appendix-lead}` explaining why
an upper bound is not a number, then `{spacing.appendix-row-height}` rows in
`{typography.appendix-row}` across four fixed columns: Base Type in
`{spacing.col-appendix-base}` (with an italic branch note where a Raw Base
branch ranks separately), the ochre *unknown* mark in
`{spacing.col-appendix-mark}`, the reason verbatim from FR-4 — `pool partial`,
`base absent from weights file` — in `{spacing.col-appendix-reason}`, and a
quiet italic note in `{spacing.col-appendix-note}`. The last row drops its rule.

**Key block** (`key-block`) — three equal columns above the foot, under a
`{colors.rule-strong}` rule: *Silence means healthy*, *Provenance marks*, *Age
marks*. The first column is required (memlog 42): without it, an empty cell is
ambiguous rather than quiet. The other two list every mark that can appear,
with its meaning in a short sentence.

**Expansion panel** (`expansion-panel`) — a bordered `{colors.paper}` card at
the full `{spacing.content-width}`, never indented and never inset to a column.
It sits **flush under its row**: no margin above, the row keeps its sepia open
marker, and the row's own bottom hairline becomes the panel's top edge so there
is no double rule at the join. `{spacing.4}` of margin below it before the next
ranked row. Inside: Base Type in `{typography.panel-title}`, a sub-line naming
the active threshold and repeating the asking-price framing, then one
`{components.combination-row}` per Tracked Entry.

**Combination row** (`combination-row`) — **two lines** (memlog 101), each a set
of fixed columns summing to 966px, together `{spacing.combination-row-height}`
tall, under one `{colors.rule-hairline}` rule. All four Price States sit side by
side in
[`mockups/key-expanded-states.html`](mockups/key-expanded-states.html), which is
the fastest way to see how little the four treatments have in common.

- **Line one — the figure**, at `{spacing.detail-row-height}` in
  `{typography.detail-row}`: the Combination — **tier plus short form, never the
  value**, the same reading as the chase cell (memlog 134) — the Price State with
  its glyph
  (● priced, ○ no-listings, △ not-yet-synced, ✕ unresolvable in rust), the price
  or the money phrase, and the listing count the estimate rested on (FR-8).
- **Line two — the evidence**, at `{spacing.combination-row-line-2-height}` in
  `{typography.combination-line-2}`, `{colors.ink-tertiary}`: the note, then
  **both labelled ages in their own cells** — the observation age (*priced 11h
  ago*) and the last-attempted age (*tried 4h ago*), each saying which clock it
  reads. Below-threshold entries are marked by the note reading *below the
  threshold — adds nothing to EV*. They are not greyed out and not hidden.

Line two is always present, so the rows scan evenly down the expansion, and it
**wraps rather than truncating** — a long note grows the row by whole
`{spacing.combination-row-line-2-height}` lines, which is why
`{spacing.combination-row-height}` is a minimum and not a fixed height.

*That is why line two has its own type role.* `{typography.detail-meta}` sets
`lineHeight: 1.2`, which at 10.5px is 12.6px — so a wrapped note would grow the
row by 12.6px and `48 + 20n` would stop being true after the first long note.
`{typography.combination-line-2}` is `detail-meta` with an **absolute**
`lineHeight: 20px` instead, so the wrap quantum equals the declared token and
the row's height is always `{spacing.combination-row-height}` plus a whole
number of them. A builder never has to compute 12.6. Nothing in the current copy
wraps — the longest note is 68 characters in a 548px cell — so this is a latent
defect being closed before it fires, not a visible one.

*A tombstone's line two is cut differently*, because a tombstone does not carry
clocks. Its note cell holds the **prune reason** at
`{spacing.col-combination-note}`, and the two age cells are replaced by a single
`{spacing.col-tombstone-removed}` cell reading `removed YYYY-MM-DD` — 560 + 406
= 966, the same sum. The removal date must not sit in a cell whose whole
contract is *say which clock this is*: a removal date is a calendar fact about a
decision somebody made, not a reading of `observedAt` or `lastAttemptedAt`, and
putting it under an age label would make it look like one. Line one of a
tombstone is unchanged in shape — struck-through Combination, `† pruned` marker,
the phrase *not tracked* in the money slot, no sample.

*A Raw Base's single combination row* fills its line-two note cell with `no
affixes — this Base Type priced as it drops, at Item Level 82`, and carries both
age cells exactly like any other row. That is the whole reason memlog 71 gave it
an expansion: the ages had nowhere else to land.

*Why two lines here and one line everywhere else.* Maximum density (memlog 17)
governs the **resting page** — the 28px ranked row is untouched by this and
stays untouched. The expansion is already uncapped (memlog 64) and already
permitted to scroll, so a second line costs it nothing it had. The sharper
reason is the one stated in Layout & Spacing: a combination row has no further
click beneath it. One line could not hold a 38-to-68-character note in 146px,
nor both clocks in 124px — and the Raw Base expansion (memlog 71) exists
precisely to carry both clocks, so cutting them there would have defeated the
decision that created it.

*Line one's fifth cell* is `{components.trade-link}` — the ↗ glyph, alone,
right-aligned in `{spacing.col-combination-trade-link}`, in `{colors.ink-tertiary}`
going `{colors.sepia}` on hover. It renders where the entry carries a stored
`lastSearchId` **and** that search ran against the active league — a test on the
stored field rather than on Price State (PRD FR-33, FR-21; AD-9, AD-24). Most
`priced`, `no-listings` and `unresolvable` rows therefore carry it. It is blank
— not greyed, not disabled-looking, simply absent — for a row the syncer never
issued a search for, which is a `never-synced` row and also an entry found
`unresolvable` offline before any request, and for a row whose last search ran
in a previous league. It is never drawn in `{components.tombstone-band}`. The 24px it occupies is taken from
`{spacing.col-combination-figure}` (140 → 116), which had slack: a money-phrase
or a two-decimal Divine figure never approaches 116px minus its padding.

*The `✕` appears at two weights on purpose.* At `700` it is
`{components.trust-mark-unresolvable}`, a trust mark on a ranked row. At `600`
it is `{components.price-state-glyph}`'s `unresolvable`, labelling a Price State
inside an expansion. Two roles, two surfaces, one glyph — not a contradiction.

**Tombstone band** (`tombstone-band`) — behind a `▸ N pruned` toggle. Opened, it is a
`{colors.paper-deep}` band under a 2px `{colors.edge}` rule with its own
tracked uppercase heading. Both the closed toggle and the open band are in
[`mockups/key-expanded-states.html`](mockups/key-expanded-states.html). Its rows
take the two-line
`{components.combination-row}` shape in `{colors.ink-tertiary}`: line one is the
struck-through Combination, a `† pruned` marker and the phrase *not tracked* in
the money slot. **Line two is re-cut** to `{spacing.col-combination-note}` of
prune reason plus `{spacing.col-tombstone-removed}` of `removed YYYY-MM-DD`,
because a tombstone has no clocks to read and a removal date is a calendar fact
rather than an age. See the combination-row spec above for the arithmetic.

**Expand affordance** (`expand-affordance`) — sepia sans text with a `+`/`—` or
a `▸`/`▾`, on a dotted sepia underline where it is a toggle. No button chrome,
no fill, no border.

*The list affordance below row 20* reads `+ Read the remaining N Base Types`
closed and `— Show only the top 20` open, and it is reversible. Opening it grows
the ranked list **in place** to the full ranked length — it does not replace
rows 1–20 and it does not page. Ranks 21 and beyond all take
`{components.ranked-row-tier-3}`. The three emphasis tiers describe the top ten,
and nothing below it needs a fourth. The appendix, the key block and the foot
stay below the grown list in the same order. This growth is clicked, so it may
push the page into scrolling, which is allowed.

**Running foot** (`running-foot`) — one sans line in `{colors.ink-tertiary}`
above a hairline, stating that the page is read-only while playing, that exact
ages and the full Combination list sit one click down, and that pruning and
pinning happen in `data/tracked.json` followed by a commit.

**Refusal screen** (`refusal-screen`) — the page a schema-invalid artifact earns
(FR-33, NFR-8). It replaces the whole page: paper ground, nothing of the list,
nothing stale served. A rust eyebrow reading `THE PAGE WILL NOT RENDER THIS`, a
`{typography.masthead-title}` line saying plainly that a published file does not
match its schema, then `{typography.failure-body}` at
`{spacing.dek-max-width}` naming **which** artifact, which schema version it
declared and which the page expects, with the artifact named beside a
`{components.trust-mark-unresolvable}` glyph and word. It closes with one
sentence: the page renders again as soon as a valid set is published, and
nothing old is served in the meantime. No card, no icon, no illustration — the
failure is set like the rest of the page, because it is the same page telling
the truth about itself.

**Fetch failure screen** (`fetch-failure-screen`) — same shape, different fact:
one of the eight artifacts did not arrive. Rust eyebrow reading `THE PAGE COULD
NOT LOAD ITS DATA`, a title saying one of the eight files did not arrive, a body
naming which, and an `{components.expand-affordance}` reading `+ Try again`.
One sentence explains that the page shows nothing rather than a partial set,
because FR-33 requires a single consistent set and half a ranking is worse than
no ranking.

`[NOTE FOR UX]` Two component surfaces still have no visual treatment and
cannot be specified without inventing them:
1. **Skeleton rows** for the load state — memlog 50 fixes the behaviour
   (masthead and 20 row slots paint immediately, resolving in a single
   transition `[ASSUMPTION — memlog 51]`) but no fill tone, shimmer or
   placeholder shape was ever drawn. The obvious default, if nobody rules
   otherwise, is a flat `{colors.paper-inset}` bar per cell at the declared
   column widths with no shimmer — the vocabulary already forbids animation
   that attracts attention.
2. **The cross-file validation report** (FR-33, FR-29, FR-16) — the page still
   renders in that case, so this is additive rather than a failure screen.
   `{components.sync-report-panel}` is the obvious home, since it already
   carries every other operational figure, but nothing has ruled on it.

`[NOTE FOR UX]` `[ASSUMPTION — memlog 35]` A tracked modifier with no entry in
the canonical short-form table falls back to the Trade Catalogue stat name plus
the value band, and *must be visually identifiable as a fallback* so the missing
short form gets noticed and added. No treatment for that fallback exists in the
mock. It may not borrow a semantic ink — an ink says a figure's footing is
degraded or broken, and an uncurated entry says nothing about the figure (see
Colors) — so it wants a non-colour cue, but which one is unsettled.

`[ASSUMPTION — memlog 49]` In the honest-empty league-reset state the list
renders every tracked Base Type in canonical order, with **rank numerals
suppressed**, plus a line stating that the order is canonical and not ranked.
Without that suppression the page asserts a ranking it does not have.

*The EV column is not blank in that state.* Memlog 49's "empty rather than
zero" was aimed at the zero, and blank is the other thing the money slot
forbids. Every EV there is missing for exactly one reason — the observations
belong to another league — so every EV cell holds the `not-yet-synced` phrase
**no figure yet**, which is the vocabulary memlog 43 already built for this. The
rule holds without an exemption: a missing figure is always a phrase naming
which question is open, in the honest-empty state as everywhere else.

**One denomination, no currency icon — and one other icon, for one job.** Every
figure on the page is in Divine, and v1 renders the denomination as **text** —
there is no currency-icon token, no currency-icon component. The two catalogue
files carry different halves of the rendering job: `catalogue/stats.json` is
what makes a `statId` render as its human text rather than as a raw id, and
`catalogue/static.json` supplies the **denomination's own label**, which the
page prints rather than hardcoding a name the catalogue already owns (PRD FR-33,
AD-24, AD-25). An earlier version of this paragraph credited `static.json` with
the stat-text path; a live fetch on 2026-09-13 found that file carries currency
ids, labels and image paths and no stat text at all. The currency-**icon** half
of FR-33 has nothing to do in a product with a single denomination, and the
icons stay unread in a file the page already fetches.

`{components.trade-link}` is the one icon in the product, and it earns the
exception because it is not a state or a decoration but a **functional link
off the page** — the ↗ glyph joins the existing glyph vocabulary (one unicode
character, no SVG, no image, nothing downloaded) rather than becoming a
second visual language. It carries no semantic-ink colour and marks no state.
It is present or absent per row, the same as any other conditional cell. See
Components — Combination row, and Do's and Don'ts.

## Do's and Don'ts

**Silence means healthy.** This is the load-bearing rule of the whole page
(memlog 32). A row whose figure is `measured`, drawn from a `complete` pool and
priced inside the freshness cut-off carries no glyph, no word and no colour —
its Provenance and Age cells are empty. Fourteen of twenty rows in the reference
render are silent, which is why the six that are not can be read at an angle
from across the desk. The freshness cut-off is **48 hours** (memlog 47), chosen
against the ~15-hour partial refresh cycle so normal rotation never marks a
row. *A row younger than the cut-off shows no age at all. This began as an
override of FR-12's literal "every row carries an age wherever an age exists"
(memlog 46), and FR-12 now states the rule itself: where an age appears is a
freshness cut-off rather than a blanket rule, the cut-off is 48 hours, and the
obligation is discharged per row rather than per surface (PRD FR-12; AD-10). The
expansion carries FR-12's intent, because it labels both the observation age and
the last-attempted age for every row, and a stale row is never silent on either
surface.*

**And loud when wrong.** Silence is only half of memlog 32. The other half is
that a real problem must be visible without anyone going to look for it — which
is why the resting trust strip raises a rust line for an unresolvable count, a
starved pinned set. It is also why the strip's five plain facts are
unconditional: silent-when-fine governs health signals, never attribution.
Reading silent-when-fine as
*silent, always* is the failure mode of this rule, and it is the one to guard
against: a page that says nothing when the list is broken looks exactly like a
page that says nothing because the list is fine.

**Colour alone never carries a distinction.** Every semantic ink is always
paired with a glyph and a word. Every non-colour cue must survive the removal of
the colour. This is a **legibility** rule. It exists because of the angled
mid-session glance, not for accessibility. Accessibility is explicitly out of
scope for this product (memlog 13), and this document makes no contrast or
conformance claims.

| Do | Don't |
|---|---|
| Leave the Provenance and Age cells empty on a healthy row | Add a green *measured* badge, a tick mark, or any "all good" mark |
| Raise a rust mark, a word and a count in the trust strip when a health figure is bad | Read silent-when-fine as silent-always, and let a broken list render as a clean page |
| Call the fourth column **Provenance**, in the header and in the key block | Call it "Weight" — a synonym for one Glossary term and a collision with another |
| Spell *Divine* and *Item Level*, or state the unit once in a column header | Print `div` or `ILVL`, which the Glossary does not license |
| Pair every semantic ink with its glyph and its word | Distinguish anything by hue alone |
| Keep to the two semantic inks | Introduce a third colour, a success colour, or a severity ramp |
| Mark Provenance once, on the ranked row — one label per Base Type | Repeat a Provenance mark per combination row, where every row in the panel carries the same label |
| Reach for a non-colour cue for `pinned` and for the curation fallback | Spend the retired slate on something that is not a statement about a figure's footing |
| Use `{colors.sepia}` decoratively — eyebrow, threshold fill, affordances | Let sepia start meaning a state |
| Carry rank emphasis with weight and rank-numeral colour | Make a top-ranked row taller or its type larger |
| Hold every ranked row at `{spacing.row-height}` | Vary row height by rank, content or state |
| Reproduce all three column budgets exactly | Let any column flex, or let the chase cells resize per row |
| Declare a `lineHeight` on every type role | Omit one and let Mantine's 1.55 decide a vertical number this document computed |
| Fill an unknown money slot with a phrase naming the open question | Render `0`, `0.00%`, blank or `—` where a figure is missing |
| Show `< 0.01` for a real figure too small to print at 2dp | Let a non-zero quantity round to `0.00` |
| Say which clock an age reads — *priced 5d ago* vs *tried 9d ago* | Collapse the two ages into one unlabelled `3d` |
| Show `unresolvable` and `pruned` entries | Omit them because they are not worth anything |
| Keep three chase cells at `{spacing.chase-cell}` with canonical short forms (memlog 34) | Let modifier text wrap, or abbreviate ad hoc per row |
| Write a Combination as tier plus short form — `T1 Cold Res · T1 Mana` | Print the modifier value on either surface, outside the fallback |
| Take the tier from the curator's declared Accepted Tier | Derive it from the band, or read the Weights File's display-only `tierLabel` |
| Print `T1–T2` where the curator accepted a range | Round a mixture to a single tier the band cannot isolate (AD-28) |
| Ellipsise on the ranked list, where the expansion holds the full text | Cut, truncate or tooltip anything inside an expansion — there is no click beneath it |
| Give a combination row two lines so both clocks and the note fit whole | Relax the 28px ranked row — density still governs the resting page |
| Say *current asking price from a live instant-buyout listing* | Say "sells for", "worth", or anything implying an observed sale (FR-13) |
| Keep every corner square and every surface flat | Add a radius, a shadow, a gradient or a hover lift |
| Keep the frame at `{spacing.frame-width}` and centre it | Add a breakpoint, a mobile layout, or a dark palette |
| Leave the frame 20px narrower than the 1080px viewport, for the scrollbar | "Correct" `frame-width` back to 1080, or buy width back out of a column |
| Fit the default state inside 1920px with no scrolling | Trade density for whitespace |
| Let an expanded region push the frame into scrolling | Shrink rows, drop columns or hide the key block to keep an expanded state inside 1920px |
| Open the sync report and a Base Type in place, pushing what is below down | Put either in a modal, a drawer, a tooltip or a second route |
| Show `{components.trade-link}`'s ↗ where the entry carries a stored `lastSearchId` from a search in the **active league** — a test on data, never on Price State | Key the ↗ on Price State, or draw it greyed-out or disabled where there is no id — absent, not inert |
| Keep `{components.trade-link}` a single unicode glyph, no colour, no semantic ink | Add a second icon, an SVG asset, or let ↗ start meaning a state |
