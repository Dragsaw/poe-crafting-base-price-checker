---
title: PoE2 Crafting Base Price Checker — Design
name: Rarity Dark
description: >-
  One dark charcoal page for one player, on a second monitor beside a dark game.
  The game's rarity colours say what each row is, bronze marks what the player
  can operate, and every other colour appears only when a price needs attention.
status: final
revision: 19
created: 2026-09-13
updated: 2026-10-04
sources:
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md
  - docs/briefs/brief-poe-crafting-base-price-checker-2026-09-12/brief.md
  - docs/briefs/brief-poe-crafting-base-price-checker-2026-09-12/addendum.md
  - .memlog.md (rows 239-279 hold the visual redesign)
peer-contract: EXPERIENCE.md — behaviour, every on-screen string and every fixed
  value. This document owns the look. Its YAML is the visual spec; its prose
  gives only the reasons and relationships the YAML cannot carry.
mockups:
  - mockups/key-redesign-dark.html     # current: the dark redesign
  - mockups/key-hero-resting.html      # superseded: the retired paper direction
  - mockups/key-expanded-states.html   # superseded: the retired paper direction

colors:
  # --- neutrals: no warm cast, no meaning ---
  ground: '#1A1A1D'            # page background
  surface: '#222226'           # open row, expansion panel, row hover, a pressed row, inputs
  surface-raised: '#2C2C31'    # tooltips; a pressed button or segment until release
  line: '#2E2E33'              # between rows
  line-strong: '#44444B'       # header rule, column-header rule, control borders
  text: '#D9D9D9'              # primary text and figures
  text-secondary: '#9A9A9A'    # secondary text, reasons, labels, tiers
  text-tertiary: '#8A8A8E'     # rank 6+, column headers, quiet notes, the trade link at rest
  # --- identity: the game's rarity colours ---
  rarity-magic: '#8888FF'      # crafted Item Class names; mod text in an expansion
  rarity-magic-dim: '#8C8CCF'  # mod text in a ranked row's chase cells
  rarity-normal: '#C8C8C8'     # Raw Base names
  # --- interactive: the one accent ---
  accent: '#BFA77A'            # controls, open-row bar, show-more text, the open sign
  accent-soft: 'rgba(191,167,122,.14)'  # the active segment's fill; rgba so one value serves ground and surface
  # --- attention: each one always with a mark ---
  trust-rough: '#E0913A'       # ◐ rough, ≈ estimated odds, the problem count when nothing is broken
  trust-pending: '#9898A0'     # ○ pending
  trust-broken: '#F0756C'      # ✕ broken, the problem count when anything is broken, failure-screen eyebrows. Broken things only

typography:
  stack-sans:
    fontFamily: 'Inter, system-ui, "Segoe UI", sans-serif'
  # Text quoted verbatim out of a file. System-resident. It has no size of its own.
  stack-mono:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Cascadia Mono", monospace'

  # header bar
  title:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.15'
  eyebrow:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 11px
    fontWeight: '600'
    lineHeight: '1.15'
    letterSpacing: 0.08em
  control:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.2'
  control-figure:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 15px
    fontWeight: '600'
    lineHeight: '1.2'
  craft-cost:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.2'
  label:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.2'

  # the ranked list
  column-header:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 11px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.06em
  row-name:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 15px
    fontWeight: '500'           # 600 on ranks 1-5
    lineHeight: '1.2'
  row-figure:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 15px
    fontWeight: '400'           # 650 on ranks 1-5
    lineHeight: '1.2'
  row-rank:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 13px
    fontWeight: '400'           # 600 on ranks 1-5
    lineHeight: '1.2'
  chase:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 12.5px
    fontWeight: '400'
    lineHeight: '1.2'
  # inline: sized against its host and takes the host's line height
  tier:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 0.9em
    fontWeight: '600'
    letterSpacing: 0.01em

  # expansion, marks and notes
  line-text:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 13.5px
    fontWeight: '400'
    lineHeight: '1.2'
  trust:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 12.5px
    fontWeight: '400'
    lineHeight: '1.2'
  # the line a mark stands in where no text shares it: the row's mark slot, and ≈ before the EV
  mark:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.2'
  tooltip:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 12.5px
    fontWeight: '400'
    lineHeight: '1.45'
  note:
    fontFamily: '{typography.stack-sans.fontFamily}'
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'

rounded:
  none: '0px'        # rows, panels, the expansion, the appendix
  control: '6px'     # the recipe toggle frame, the threshold figure box, the sync button
  segment: '4px'     # one recipe segment inside the toggle
  tooltip: '6px'

spacing:
  content-max: '1120px'          # the frame's max width, gutters included
  content-min: '1000px'          # the frame's min width; narrower viewports scroll sideways
  gutter: '24px'                 # left and right of the frame
  header-height: '64px'          # sticky
  row-height: '38px'
  line-height-expansion: '32px'
  col-rank: '32px'
  col-name: '220px'
  col-ev: '96px'                 # figure plus mark-slot
  mark-slot: '18px'
  col-gap: '14px'
  chase-gap: '18px'
  expansion-indent: '46px'
  expansion-trust-cell: '270px'  # holds the longest reason clear of the trade link (memlog 261)
  open-row-bar: '2px'            # drawn inset, in accent

components:
  header-bar:
    height: '{spacing.header-height}'
    position: 'sticky at the top of the viewport, above the list'
    background: '{colors.ground}'
    borderBottom: '1px solid {colors.line-strong}'
    layout: 'one flex row, items centred, 22px between groups, nothing wraps or shrinks: brand block (takes the free space) · {components.recipe-toggle} · {components.threshold-control} · {components.sync-button}'
    eyebrow: '{typography.eyebrow}, uppercase, {colors.text-secondary}. Never the accent (memlog 265)'
    title: '{typography.title} in {colors.text}'
    brandLineHeight: '1.15, eyebrow above title'
  recipe-toggle:
    label: '{typography.label} in {colors.text-secondary}, 10px before the toggle'
    frame: '{colors.surface} fill, 1px solid {colors.line-strong}, radius {rounded.control}, 2px padding'
    segment: '{typography.control} in {colors.text-secondary}, padding 4px 10px, radius {rounded.segment}, cursor pointer'
    segmentActive: '{colors.accent-soft} fill, {colors.accent} text, weight 600, cursor default'
    segmentHover: 'inactive segment only: text goes to {colors.text}'
    segmentPressed: 'inactive segment only: {colors.surface-raised} fill until release (memlog 265)'
    single: 'one published recipe: the label, then the option word as plain text in {typography.control} {colors.text}, with no frame and no segment (memlog 275)'
    none: 'no published recipe: label, toggle and Craft Cost are absent (memlog 275)'
    craftCost: '{typography.craft-cost} in {colors.text-secondary}, 10px after the toggle, tabular figures (memlog 258 N-16)'
    craftCostUncostable: 'the uncostable phrase in the same role and colour, never a number'
  threshold-control:
    label: '{typography.label} in {colors.text-secondary}, 10px before the figure. Its ≥ is an angle pointing right over one horizontal bar, drawn as {components.trust-mark} marks are'
    figureBox: '{colors.surface} fill, 1px solid {colors.line-strong}, radius {rounded.control}, padding 3px 8px, min-width 64px, right-aligned'
    figure: '{typography.control-figure} in {colors.text}, tabular figures. The figure is the typed input'
    unit: '{typography.label} in {colors.text-secondary}, inside the box after the figure, outside the editable region'
    figureHover: 'border goes to {colors.accent}; cursor text'
    figureEditing: 'border {colors.accent}, caret {colors.text}, selection {colors.accent-soft}'
    slider: '100px track, 4px tall, {colors.line-strong}, 2px radius; the filled part {colors.accent}; cursor pointer on the track'
    sliderThumb: '12px circle in {colors.accent} with a 3px {colors.ground} ring; cursor grab, grabbing while dragged'
    sliderEndpoints: 'none drawn'
  sync-button:
    typography: '{typography.label}'
    color: '{colors.text-secondary}'
    padding: '4px 8px'
    border: '1px solid transparent at rest, radius {rounded.control}'
    openSign: '▾, a small solid triangle pointing down, in {colors.accent}, 6px after the label, drawn as {components.trust-mark} marks are'
    hover: 'border {colors.line-strong}, text {colors.text}'
    open: 'keeps the hover border while the panel is open'
    pressed: '{colors.surface-raised} fill until release (memlog 265)'
    healthy: 'label and open sign only: no dot, no colour, no count (memlog 254)'
    problem: 'the problem count in place of the label, before the open sign, at weight 600: in {colors.trust-broken} led by the broken mark, or in {colors.trust-rough} led by the rough mark (which: EXPERIENCE.md, Loud when wrong). Never wider than the healthy label (memlog 270)'
  sync-report-panel:
    placement: 'in the page flow directly under {components.header-bar}, pushing the list down. Never an overlay, a dropdown, a modal or a drawer (memlog 258 N-7)'
    background: '{colors.surface}'
    borderBottom: '1px solid {colors.line-strong}'
    padding: '14px 16px 12px'
    maxHeight: '400px, then it scrolls inside itself'
    columns: '4 equal, one heading each; groups inside a column separated by 8px of space, with no second heading, rule or bullet. Order and content: EXPERIENCE.md, The sync report'
    heading: '{typography.column-header}, uppercase, {colors.text-tertiary}'
    body: '{typography.line-text} in {colors.text-secondary}'
    figure: '{colors.text}, tabular figures'
    brokenLine: 'leads with the broken mark in {colors.trust-broken}; the rest of the line in the body colour'
    unreliableLine: 'a starved-pin or stale-patch line leads with the rough mark in {colors.trust-rough}; the rest of the line in the body colour (memlog 265)'
    diagnosis: '{typography.stack-mono.fontFamily} at the body size, line height and colour'
    absenceLine: 'plain body text, no mark, no colour'
    missingFigure: 'a phrase in {colors.text-secondary}, no mark'
  column-header:
    height: '30px'
    typography: '{typography.column-header}, uppercase'
    color: '{colors.text-tertiary}'
    borderBottom: '1px solid {colors.line-strong}'
    layout: 'the same grid as {components.ranked-row}'
    rankLabel: 'right-aligned'
    evLabel: 'right-aligned, padding-right {spacing.mark-slot}; {colors.text-secondary} with a 1px dotted {colors.text-tertiary} underline and cursor help; it anchors {components.ev-tooltip}'
    neverEllipsises: 'true'
  ev-tooltip:
    anchor: 'the EV label in {components.column-header}; opens directly under the header'
    width: '330px'
    padding: '10px 12px'
    background: '{colors.surface-raised}'
    border: '1px solid {colors.line-strong}'
    radius: '{rounded.tooltip}'
    shadow: '0 8px 24px rgba(0,0,0,.6)'
    typography: '{typography.tooltip} in {colors.text}; sentence case, no letter-spacing'
    textAlign: 'left (memlog 275)'
    emphasis: 'the live threshold and the Craft Cost figure at weight 600'
    lastParagraph: '{colors.text-secondary}; each mark it decodes in its own colour'
  ranked-row:
    height: '{spacing.row-height}'
    grid: '{spacing.col-rank} · {spacing.col-name} · {spacing.col-ev} · chase 1fr, column gap {spacing.col-gap}, items centred, white-space nowrap'
    background: '{colors.ground}'
    borderBottom: '1px solid {colors.line}'
    cursor: 'pointer'
    hover: '{colors.surface}'
    pressed: '{colors.surface} until release, never {colors.surface-raised} (memlog 268)'
    open: '{colors.surface}, an inset {spacing.open-row-bar} {colors.accent} bar on the left edge, bottom border transparent so the row joins its panel'
    rank: '{typography.row-rank}, right-aligned, {colors.text-tertiary}'
    rankTopFive: '{colors.text} at weight 600'
    name: '{typography.row-name}, one line, ellipsis'
    nameCrafted: '{colors.rarity-magic}'
    nameRaw: '{colors.rarity-normal}, roman'
    nameTopFive: 'weight 600'
    figure: '{typography.row-figure} in {colors.text}, tabular, right-aligned, then {components.trust-mark} in {spacing.mark-slot}'
    figureTopFive: 'weight 650'
    figureNegative: '{colors.text-tertiary} (memlog 258 N-20); U+2212 minus'
    figureMissing: '— in {colors.text-tertiary}, weight 400'
    estimate: '{components.estimate-mark} before the figure'
    chaseCrafted: 'three or two {components.chase-cell} cells (Layout & Spacing, The chase column)'
    chaseRaw: 'one line across the chase area: {typography.chase} in {colors.text-secondary}; its lead words at weight 600 in {colors.rarity-normal}'
    skeleton: 'twenty slots of {spacing.row-height} in this grid, each cell a flat {colors.surface} bar 10px tall, as wide as its cell; no shimmer'
  trust-mark:
    drawing: 'inline SVG in a 1em box at the font size of its line, painted in currentColor set to its token; strokes as heavy as the stem of the line''s text; ◐ and ○ share one circle diameter and one ring stroke, and ✕ fills the same box (memlog 274)'
    rough: '◐, a ring with its left half filled solid, in {colors.trust-rough}'
    pending: '○, an empty ring, in {colors.trust-pending}'
    broken: '✕, two straight strokes crossing corner to corner at the centre, in {colors.trust-broken}'
    onRow: 'the mark alone in {typography.mark}, right-aligned in {spacing.mark-slot}, cursor help; it anchors {components.mark-tooltip}'
    onLine: 'mark, word and reason inline in {typography.trust}: the mark, a 6px gap, the word in the mark colour, then a middle dot and the reason in {colors.text-secondary}'
    current: 'no element. The slot stays reserved and empty'
  estimate-mark:
    shape: '≈, two short wavy strokes stacked one above the other, drawn as {components.trust-mark} marks are, in {typography.mark}'
    color: '{colors.trust-rough}'
    stroke: 'as heavy as a weight-500 stem at its size'
    placement: 'before the EV figure, 2px gap; and once at the head of an expansion context line'
  mark-tooltip:
    anchor: 'a {components.trust-mark} on a ranked row; opens to the right of the mark, top-aligned 6px above it'
    padding: '6px 9px'
    background: '{colors.surface-raised}'
    border: '1px solid {colors.line-strong}'
    radius: '{rounded.tooltip}'
    shadow: '0 6px 18px rgba(0,0,0,.5)'
    typography: '{typography.trust} in {colors.text-secondary}, one line, no wrap'
    textAlign: 'left (memlog 275)'
    word: 'weight 600 in the mark colour, then a middle dot and the reason'
  chase-cell:
    grid: 'three equal cells, or two (Layout & Spacing, The chase column), gap {spacing.chase-gap}, each one line with ellipsis'
    typography: '{typography.chase}'
    modText: '{colors.rarity-magic-dim}'
    tier: '{typography.tier} in {colors.text-secondary} (memlog 275)'
    joiner: 'the middle dot in {colors.text-tertiary}, 4px each side'
    fallback: 'the same cell in {typography.stack-mono.fontFamily} at the line size; colour unchanged'
    cutHover: 'the shell of {components.mark-tooltip} holding the full cell text in {typography.chase}: mod text {colors.rarity-magic}, tier and joiner {colors.text-secondary} (memlog 273, 279)'
  expansion-panel:
    join: 'flush under its open row, no gap, no rule between'
    background: '{colors.surface}'
    borderBottom: '1px solid {colors.line}'
    padding: '6px 0 14px {spacing.expansion-indent}'
    bar: 'the row''s inset {spacing.open-row-bar} {colors.accent} bar continues down the panel'
    title: 'none, and no sub-line (memlog 258 N-11)'
    contextLine: '{typography.note}, padding 4px 0 8px; the full name in the row''s name colour ({colors.rarity-magic} or {colors.rarity-normal}), then any cue sentence in {colors.text-tertiary} with ≈ in {colors.trust-rough}'
    content: 'context line, then {components.expansion-line} rows, then {components.show-more}'
  expansion-line:
    height: '{spacing.line-height-expansion}'
    grid: 'combination 1fr · price 90px · trust {spacing.expansion-trust-cell} · link 24px, column gap {spacing.col-gap}, padding-right 16px'
    borderTop: '1px solid {colors.line}'
    combination: '{typography.line-text} in {colors.rarity-magic}; tiers in {typography.tier} {colors.text-secondary}; joiner in {colors.text-tertiary}; one line, white-space nowrap'
    price: '{typography.line-text} at weight 500 in {colors.text}, right-aligned, tabular'
    trust: '{components.trust-mark} in its line form'
    link: '{components.trade-link}'
    priced: 'trust cell empty'
    rough: 'trust cell: the rough mark, word, reason'
    pending: 'price — in {colors.text-tertiary} at weight 400; trust cell: the pending mark, word, reason'
    broken: 'price — in {colors.text-tertiary} at weight 400; trust cell: the broken mark, word, reason'
    belowThreshold: 'combination, its tiers and its price in {colors.text-tertiary}, price at weight 400; trust cell holds the reason alone in {colors.text-secondary}, no mark (memlog 275)'
    pruned: 'combination struck through in {colors.text-tertiary}, led by its curation mark; price — in {colors.text-tertiary} at weight 400; trust cell empty; no trade link; a second line in {typography.note} {colors.text-tertiary} carries the prune reason across the line''s width (memlog 258 N-3)'
    pinnedMark: 'leads the combination cell, {colors.text-tertiary} at weight 600, at the line size'
    fallback: 'combination cell in {typography.stack-mono.fontFamily} at the line size; colour unchanged'
  show-more:
    typography: '{typography.trust}'
    color: '{colors.accent}'
    signs: 'a leading + when closed, − (U+2212) when open'
    paddingTop: '8px'
    cursor: 'pointer'
    chrome: 'none: no fill, no border, no button shape'
  trade-link:
    mark: '↗, a straight shaft rising to the upper right with an open arrowhead at its end, drawn as {components.trust-mark} marks are, at {typography.line-text}'
    rest: '{colors.text-tertiary}, centred in the 24px link cell'
    hover: '{colors.accent}'
    clickTarget: 'the mark only'
    absent: 'an empty cell, never a greyed mark'
  unrankable-appendix:
    placement: 'after the ranked list and its show-more, before {components.footer-legend}'
    borderTop: '1px solid {colors.line-strong}'
    title: '{typography.row-name} in {colors.text}; the count in {colors.text}, never an attention colour (memlog 258 N-9)'
    lead: '{typography.note} in {colors.text-secondary}'
    row: 'at least {spacing.line-height-expansion} tall, a wrapped note grows it; 1px {colors.line} between rows, last row without a rule'
    grid: 'item class {spacing.col-name} (after a blank {spacing.col-rank}) · reason {spacing.expansion-trust-cell} · note 1fr, gap {spacing.col-gap}'
    itemClass: '{typography.line-text} in {colors.rarity-magic}'
    reason: '{typography.line-text} in {colors.text-secondary}, no mark'
    note: '{typography.note} in {colors.text-tertiary}, padding 4px 0; the one cell that wraps, never cut'
    empty: 'the title alone'
  footer-legend:
    marginTop: '28px'
    borderTop: '1px solid {colors.line}'
    paddingTop: '14px'
    layout: 'one flex row that may wrap, 22px gaps; the last item pushed to the right edge'
    typography: '{typography.note} in {colors.text-secondary}'
    swatches: '■, a solid square, in {colors.rarity-magic} and in {colors.rarity-normal}, drawn as {components.trust-mark} marks are, each with its words'
    marks: 'each mark in its colour, its word in the mark colour at weight 600, the meaning in {colors.text-secondary}'
  list-statement:
    placement: 'one line between {components.header-bar} (or an open {components.sync-report-panel}) and {components.column-header}'
    typography: '{typography.label} in {colors.text-secondary}'
  failure-screen:
    replaces: 'the whole page: no header bar controls, no list'
    background: '{colors.ground}'
    frame: 'the page frame, padding-top 24px'
    eyebrow: '{typography.eyebrow}, uppercase, {colors.trust-broken}, led by the broken mark of {components.trust-mark}'
    title: '{typography.title} in {colors.text}'
    body: '{typography.line-text} in {colors.text-secondary}, at most 640px wide'
    retry: '{components.show-more}, under the body (fetch-failure variant only)'
---

## Brand & Style

This is one page for one player. It stays open on a second monitor for a whole
play session, beside a dark game. The player reads it at an angle, with the
pointer still in the game. The ground is dark charcoal, so the page sits beside
the game without glare. It is charcoal and not near-black, because a near-black
ground made the text burn (memlog 240).

The page speaks the game's language. A crafted Item Class prints in magic blue,
`{colors.rarity-magic}`. A Raw Base prints in normal grey,
`{colors.rarity-normal}`. The game and the trade site print magic and normal
items in the same way (memlog 241). That pair is the page's identity, and every
other colour serves it. The neutrals are greys with no warm cast. One bronze,
`{colors.accent}`, comes from the game's UI frame and marks what the player can
operate. Bronze stays apart from both rarity colours, so a control never reads as
an item.

**Silence means healthy** (EXPERIENCE.md, Epistemics). Colour other than identity
and bronze appears only when something needs attention. Thus most rows are quiet.
That quiet lets the player find a marked row from across the desk.

The page is not a dashboard. It has no tiles, no gauges and no status lights, and
nothing animates to draw the eye. It is not a spreadsheet either. It has no cell
borders, no zebra striping and no column chrome. A row is one line of names and
figures between two hairlines.

**Substrate.** Mantine v9 (`@mantine/core` + `@mantine/hooks` 9.6.1)
`[ASSUMPTION — memlog 8]`. Mantine supplies behaviour, layout primitives and the
CSS-variable mechanism. The page does not use its appearance. The tokens above
replace its palette, radii, shadows and type ramp, and a token wins over a Mantine
default. Point `theme.primaryColor` at a palette built from `{colors.accent}`.
Then carets, focus and selection use bronze. They never use Mantine's blue, which
would read as `{colors.rarity-magic}`.

**One theme.** The page has one dark theme. It has no light theme and does not
follow the OS colour scheme (memlog 240).

## Colors

Colour has three jobs on this page, and each colour has exactly one of them.

**Identity: the rarity pair** (memlog 241). These colours say what a row is. They
never say whether its figure is sound. `{colors.rarity-magic-dim}` prints mod text
in a ranked row one step quieter than the name beside it, so the name leads.

**Interactive: one accent.** `{colors.accent}` marks what the player can operate.
**It marks controls only** (memlog 265). It never marks a state of the data or a
label. For this reason the league eyebrow is `{colors.text-secondary}`.

**Attention: three colours, each always with a mark.**

| Colour | Marks | Also |
|---|---|---|
| `{colors.trust-rough}` | ◐ rough, ≈ estimated odds | the problem count when nothing counted is broken, and starved-pin and stale-patch lines in the sync report |
| `{colors.trust-pending}` | ○ pending | — |
| `{colors.trust-broken}` | ✕ broken | the problem count when anything counted is broken, and the failure-screen eyebrows |

One amber, `{colors.trust-rough}`, carries ◐ and ≈ (memlog 258 N-15). Shape and
side tell them apart: ≈ sits before the figure and ◐ after it.
`{colors.trust-broken}` marks broken things only. It never marks age, odds or a
missing price (memlog 253). EXPERIENCE.md (Epistemics) decides which data state
takes which mark. Colour is never alone (EXPERIENCE.md, Accessibility Floor). ◐, ○
and ✕ differ in silhouette, and ≈ differs from all three.

**Neutrals carry no meaning.** Depth runs `{colors.ground}` → `{colors.surface}` →
`{colors.surface-raised}` (Elevation & Depth). Text has three steps.
`{colors.text}` is for what the player reads first. `{colors.text-secondary}` is
for labels, reasons and tiers. `{colors.text-tertiary}` is for what the player
reads last.

**Measured contrast.** EXPERIENCE.md sets the floor (Accessibility Floor): 4.5:1
for text on every surface it sits on. The figures below use WCAG relative
luminance:

| Colour | on ground | on surface | on surface-raised |
|---|---|---|---|
| `{colors.text}` | 12.30 | 11.23 | 9.84 |
| `{colors.text-secondary}` | 6.17 | 5.63 | 4.94 |
| `{colors.text-tertiary}` | 5.05 | 4.61 | 4.04 |
| `{colors.rarity-magic}` | 5.80 | 5.29 | 4.64 |
| `{colors.rarity-magic-dim}` | 5.60 | 5.11 | 4.48 |
| `{colors.rarity-normal}` | 10.38 | 9.47 | 8.30 |
| `{colors.accent}` | 7.46 | 6.81 | 5.97 |
| `{colors.trust-rough}` | 6.85 | 6.25 | 5.48 |
| `{colors.trust-pending}` | 6.06 | 5.54 | 4.85 |
| `{colors.trust-broken}` | 6.17 | 5.64 | 4.94 |

The active segment's `{colors.accent}` text on `{colors.accent-soft}` measures 5.80
over the ground and 5.24 over the surface. Two pairs fall under the floor:
`{colors.text-tertiary}` and `{colors.rarity-magic-dim}` on
`{colors.surface-raised}`. Neither colour goes on that step. Neither appears inside
a tooltip (memlog 265), and a pressed ranked row takes `{colors.surface}`, not the
raised step (memlog 268). Measure each new colour or new pairing against the floor
before it ships.

## Typography

One family: **Inter**, bundled with the static site and served from it
(memlog 242). PRD NFR-7 forbids a server, not a bundled font. Every figure that
aligns in a column uses tabular numerals (`font-feature-settings: "tnum"`). The
page uses the weights 400, 500, 600 and 650. The bundle ships the variable face or
each of those weights. The page sets no italic.

| Role | Use |
|---|---|
| `{typography.title}` | header title, failure-screen title |
| `{typography.eyebrow}` | the league name, failure-screen eyebrow |
| `{typography.control}` | recipe segments, a single recipe's word |
| `{typography.control-figure}` | threshold figure |
| `{typography.craft-cost}` | Craft Cost beside the recipe |
| `{typography.label}` | control labels, the sync button, the threshold unit, the list statement |
| `{typography.column-header}` | column headers, sync-report headings |
| `{typography.row-name}` | Item Class and Base Type names, the appendix title |
| `{typography.row-figure}` | EV |
| `{typography.row-rank}` | rank numerals |
| `{typography.chase}` | chase cells, the sell-as-is line |
| `{typography.tier}` | the tier inside any combination |
| `{typography.line-text}` | expansion lines, sync-report body, appendix rows, failure body |
| `{typography.trust}` | mark, word and reason on a line, and show-more |
| `{typography.mark}` | a mark that stands alone: the row's mark slot, ≈ |
| `{typography.tooltip}` | the EV tooltip |
| `{typography.note}` | context lines, the appendix lead and notes, the footer |

**Rank emphasis uses weight and the numeral's colour, never size**
(memlog 31b, 258 N-20). Thus a top-ranked row is never taller than the rest.

**Weight separates the tier from the mod** (memlog 241, 275). The mod text keeps
its rarity colour. The tier is `{colors.text-secondary}` at 600. Its weight
separates it, and its tone keeps it from outshining the mod it qualifies. On a
below-threshold line the tier dims with the rest of the line. The middle dot that
joins two affixes echoes the in-game mod line. EXPERIENCE.md (Domain Vocabulary)
owns how a combination is written.

**The verbatim register** (memlog 208). `{typography.stack-mono.fontFamily}` sets
text that the page quotes out of a file, and nothing else. That text is the
fallback for a modifier with no short form or no declared Accepted Tier, and the
cross-file diagnosis in the sync report. Entry names, short forms and every other
string the page wrote stay in Inter (memlog 275). The register has no size,
weight, line height or colour of its own. It takes those of its line, so no row
height moves. It is system-resident and not bundled. It is a cue, not an attention
colour, because quoted text says nothing about whether a figure is sound.

**Marks are drawn, not typed** (memlog 274). ◐ ○ ✕ ≈ ▾ ↗ ■ and the ≥ of the
threshold label are inline SVG. Draw each one as `{components.trust-mark}` says:
a 1em box at the font size of the mark's line, painted in its token, the same on
every machine. Each component above names its mark's silhouette in words:

- ◐ ○ ✕ on `{components.trust-mark}`
- ≈ on `{components.estimate-mark}`
- ▾ on `{components.sync-button}`
- ↗ on `{components.trade-link}`
- ■ on `{components.footer-legend}`
- ≥ on `{components.threshold-control}`

A mark character in this document or in EXPERIENCE.md's copy is shorthand for its
drawing. Text stays text: − † * · — and – are Inter characters. At build, verify
that the bundled Inter holds each of them at every weight it renders at. Report
any that it does not hold.

**Every role declares a `lineHeight`**, except `{typography.tier}`. That inline
role is sized in em and takes its host's line height. Mantine's `Text` resolves
1.55 when no line height is given, and that value would change every row and line
height on the page. Replace `theme.lineHeights` and `theme.headings`. Pass font
sizes as literal px, so the rem conversion cannot round the 12.5 and 13.5px sizes.

## Layout & Spacing

[`mockups/key-redesign-dark.html`](mockups/key-redesign-dark.html) draws these
parts: the header bar, the ranked list with an open expansion, both tooltips, the
problem state of the sync button, rough and pending rows, the sync report panel,
the list-statement slot and the footer legend. Its dashed *State examples* box is
annotation, not product UI. The mockup sets the layout of the sync report and the
list statement (memlog 269), not their text. On-screen text comes from
EXPERIENCE.md's copy deck, and the mockup's sample lines do not ship. **Where a
mockup and a spine disagree, the spine wins.**

**The frame.** The page is one centred column between `{spacing.content-min}` and
`{spacing.content-max}`, with `{spacing.gutter}` inside each edge
(`box-sizing: border-box`). A narrower viewport scrolls sideways. The target
screen is a 1080×1920 portrait second monitor. With a vertical scrollbar, its
frame is about 1063px, and the content inside the gutters is about 1015px
(memlog 258 N-22). The page has no fixed height. The document scrolls, and the
footer comes after the content (memlog 243). `{components.header-bar}` is sticky.
`{components.sync-report-panel}` is the only region that scrolls inside itself.

**One width-dependent rule** (memlog 273): the number of chase cells, below.
Nothing else on the page changes with width.

**Order down the page:** header bar → sync report panel, when open → list
statement, when one applies → column header → ranked rows → list show-more →
Unrankable appendix → footer legend.

**The ranked-row grid.** Four columns, `{spacing.col-gap}` apart:

| Column | Width | Holds |
|---|---|---|
| rank | `{spacing.col-rank}` | numeral, right-aligned |
| name | `{spacing.col-name}` | Item Class or Base Type, cut with an ellipsis when too long |
| EV | `{spacing.col-ev}` | ≈ when it applies, the figure right-aligned, then `{spacing.mark-slot}` |
| best combinations | the remainder | three or two `{components.chase-cell}` cells, or one sell-as-is line |

The row always reserves the mark slot, so every figure ends at the same x.

**The chase column** (memlog 273). The chase column is the frame's inner width
less 390px (`{spacing.col-rank}`, `{spacing.col-name}`, `{spacing.col-ev}` and
three `{spacing.col-gap}`). It holds three cells when each of the three is at
least the measured cell budget *B* (*Measure at build*). Otherwise it holds two
cells, each wider. Three cells take two `{spacing.chase-gap}`, and two cells take
one.

| Frame | Inner width | Chase column | Three cells, each | Two cells, each |
|---|---|---|---|---|
| `{spacing.content-min}`, 1000px | 952px | 562px | 175px | 272px |
| target, about 1063px | about 1015px | about 625px | about 196px | about 303px |
| `{spacing.content-max}`, 1120px | 1072px | 682px | 215px | 332px |

Three cells show while (chase column − 36px) ÷ 3 ≥ *B*. That is, they show from a
frame width of 3*B* + 474px. EXPERIENCE.md (Responsive & Platform) owns what the
switch does.

**Measure at build.** Report an overrun. Never cut text to make it fit
(memlog 268).

- The chase-cell budget *B*: the width of EXPERIENCE.md's short-form budget
  (Domain Vocabulary, *Combinations and short forms*) at `{typography.chase}` in
  Inter. *B* sets the switch above.
- The longest Item Class label, `Body Armours (Str/Dex/Int)`, at 15px and 600,
  against `{spacing.col-name}`.
- The longest hybrid combination led by `* pinned`, against an expansion line's
  combination cell at `{spacing.content-min}` (about 464px).
- The longest reason (EXPERIENCE.md, *Price trust*) against
  `{spacing.expansion-trust-cell}`.
- The header bar against its width budget, below.
- Each mark's drawing against its line: ◐ and ○ at one diameter.

**The header's width budget** (memlog 270, 277, 279). At `{spacing.content-min}`
the bar has 952px inside its gutters. It never wraps or shrinks. These figures
come from the browser at 1000px (memlog 277):

| Header content | Bar |
|---|---|
| `Synced 23h ago` | 928.5px |
| `✕ 999 problems` at 600, the longest problem form | 930.3px |
| `Synced 59 min ago`, the retired minutes form | 945.1px |
| `Synced 59 min ago` with a `10.00 div / craft` cost, the retired minutes form | 953.6px, the only overflow |

The minutes age prints as `Synced 59m ago` (memlog 279). That form is about 15px
shorter than `Synced 59 min ago`, so it removes the only overflow. With a
`10.00 div / craft` cost, the bar needs about 939px against 952px. The problem
state replaces the age and does not add to it, so it is never wider than the
healthy state. Re-measure the bar at build against these forms.

**The expansion-line grid** gives the longest reason room to clear the trade link
(memlog 261). At `{spacing.content-min}` the combination cell is about 464px.

**What may be cut:** EXPERIENCE.md (Domain Vocabulary) owns this. A cut looks like
a trailing ellipsis, and nothing else.

**Density.** Ranked rows and expansion lines are uniform. One `{colors.line}`
hairline separates each one from the next. There is no zebra striping. The last
row of a list has no rule below it. Only a pruned line's reason line adds height.

**An open row does not move the grid.** The open-row bar is an inset box-shadow
inside the row. It takes no width, so no column moves when a row opens.

## Elevation & Depth

Depth is tonal, in three steps: `{colors.ground}` → `{colors.surface}` →
`{colors.surface-raised}`. A row that is hovered, pressed or open steps up to the
surface. An expansion is the surface, joined flush to its row. Only a tooltip
rests on the raised step. A pressed sync button or recipe segment takes the raised
step until release (memlog 265).

**Shadows are for floating layers only.** The tooltips carry a soft drop shadow,
because they float over the rows and need an edge against them. Nothing else has a
shadow, and hover never lifts anything.

The open-row bar is a rule, not a shadow, even where an inset box-shadow draws it.
It is the page's one directional mark. It tells the player which row an open panel
belongs to.

## Shapes

Rows, panels, the expansion, the sync report and the appendix are square
(`{rounded.none}`). The page reads as a set list of rows, and a rounded row would
read as a card.

Controls and floating layers are rounded. Thus what the player can operate, and
what floats, reads as a different kind of thing from the content. Set Mantine's
`defaultRadius` to 0. Pass a radius to those components only.

A mark is a drawn shape, not a badge. No pill, chip or capsule appears anywhere.

## Components

The YAML above is the spec of each component. This section gives only what the
YAML cannot carry: the reasons, and how the parts relate. EXPERIENCE.md owns
behaviour, copy and when each case occurs, under the same component name.

### The interaction looks

There are four looks, plus the ranked row, and each look means one thing
(memlog 248, 258 N-12). EXPERIENCE.md, Interaction Primitives, owns the meanings.
The YAML specifies the looks on these parts:

- the EV label of `{components.column-header}`: dotted underline, help cursor
- `{components.sync-button}`: accent open sign, outline on hover
- `{components.show-more}`: accent text
- the active segment of `{components.recipe-toggle}` and the slider of
  `{components.threshold-control}`: accent fill
- `{components.ranked-row}`: hover tone, then the open-row bar

A mark takes the help cursor alone, with no underline under it.

### Header bar

The brand block takes the free space and pushes the controls right. Nothing wraps
or shrinks, because the width budget (Layout & Spacing) assumes a bar that never
reflows. Attribution and the sync time are not in the bar. They are in the sync
report (memlog 243).

### Recipe toggle

With one recipe, the word prints as plain text with no frame, because there is
nothing to choose (memlog 275). **Craft Cost** sits beside the recipe and nowhere
else. It is a property of the recipe, not of a row: `core` subtracts the same
figure from every crafted EV (AD-17). An uncostable recipe prints a phrase in that
slot and never a number. A zero would look free and inflate every crafted EV.

### Threshold control

The unit sits inside the figure box but outside the editable text. Thus the player
never selects it with the figure and cannot type over it. A value clamped on blur
shows the clamped figure, with no separate error look. The thumb's
`{colors.ground}` ring separates it from the filled track. The mockup does not draw
the hover and editing states. The YAML specifies them.

### Sync button

The button keeps its hover border while its panel is open. Thus the player can
always identify the opener of an open panel. The problem state replaces the age and
does not add to it. This keeps the header inside its width budget (memlog 270).

### Sync report panel

An absence line has no mark and no colour, because its file is absent-tolerable
(AD-24). The absence is a declared state, not a break (memlog 213). A missing
figure is a phrase and never `0` (memlog 212). Starved-pin and stale-patch lines
take the rough mark, not the broken one. They are unreliable, not broken
(memlog 265).

### Column header

The EV label has `{spacing.mark-slot}` of padding on its right, so it sits over the
figures and not over the marks.

### EV tooltip

It is the one place that decodes every mark beside the figures it qualifies
(memlog 247). It is left-aligned and in sentence case, with no letter-spacing. This
holds although it hangs from a right-aligned, uppercase header label (memlog 275).

### Ranked row

Tone alone cannot mark the open row, because hover uses the same tone. The inset
bar identifies the open row while the pointer is on another row. A pressed row
stays on the surface, so its tertiary and dim text keeps the floor (memlog 268). A
negative EV is dimmed, not hidden, because it is still a real figure
(memlog 258 N-20). On a Raw Base row, the sell-as-is line in the chase area is the
non-colour cue that tells it from a crafted class (memlog 258 N-13). The skeleton
paints this grid in flat bars with no shimmer (memlog 211). EXPERIENCE.md, state
22, says when.

### Trust mark and mark tooltip

On a row the mark stands alone. Thus the verdict is visible without the pointer,
and only its reason waits for a hover (memlog 247). A current price renders no
element. The slot stays reserved, so the figures never shift.

### Estimate mark

≈ sits before the figure and the trust mark sits after it, so one amber can serve
both (memlog 258 N-15).

### Chase cell

A fallback entry changes face only. A cut cell shows its full text in the mark
tooltip's shell, the shared tooltip look (memlog 279). There the mod text is
`{colors.rarity-magic}`, and the tier and joiner are `{colors.text-secondary}`.
These colours replace the row's colours, because the row's dim mod text and
tertiary joiner fall under the floor on the raised step.

### Expansion panel and expansion line

The panel has no title and no sub-line, because the sticky header always shows the
threshold and the recipe (memlog 258 N-11). A below-threshold line is dimmed, tiers
included, and not hidden (memlog 258 N-3, 275). The strike, the dagger and the tone
identify a pruned line. A pruned line carries no removal date (memlog 234).

**Pinned** (memlog 199). The pinned mark leads the combination cell at 600, because
it is a lookup key. A player who reads about starved pinned entries in the sync
report scans open panels for it. A curation status says nothing about a figure, so
it takes no attention colour and no accent.

### Show more

One look serves every show-more and act on the page (memlog 258 N-12).

### Trade link

*Its restraint is functional* (memlog 202). This is the page's only outbound link.
PRD SM-1 counts sessions in which the trade site stays shut. A prominent link would
invite the habit whose absence SM-1 measures. Do not promote it: no button, no
label, no wider cell, no larger click target.

### Unrankable appendix

It follows the list because it answers a question that comes after the list: what
did the ranking leave out? Its count never takes an attention colour, and its rows
carry no mark. The reason says why (memlog 258 N-9).

### Footer legend

It comes after the content and is never pinned (memlog 243). EXPERIENCE.md's copy
deck owns its items and their order.

### List statement

One quiet line above the column header. EXPERIENCE.md owns when it shows and what
it says.

### Failure screen

It replaces the whole page and shows nothing old. Thus it has no card, no icon and
no illustration: only the frame, an eyebrow, a title and the body. Its two variants
share one shape, and the fetch-failure variant adds the retry action. EXPERIENCE.md,
states 26 and 28, owns the causes and the copy.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Leave the mark slot empty, but reserved, on a healthy row | Add a green tick, a success colour, a status dot or any "all good" mark |
| Raise the problem count on the sync button while a problem holds | Let a broken list render as a clean page |
| Use the rarity pair for identity: magic for a crafted Item Class, normal for a Raw Base | Use a rarity colour on a control, a mark or a state |
| Keep `{colors.accent}` for what the player operates | Let bronze mark a data state or a label, or put it near a name where it reads as an item |
| Keep `{colors.trust-broken}` for broken things | Use red for age, estimated odds, a missing price or the appendix count |
| Pair every attention colour with its mark | Tell two states apart by hue alone |
| Put ◐ ○ ✕ after the figure and ≈ before it | Move ≈ into the mark slot, or treat estimated odds as a price verdict |
| Draw every mark as inline SVG at its line's size | Type a mark as a character and let it fall back to another face |
| Show the mark on the row and its reason in a hover tooltip | Hide the verdict itself behind the pointer |
| Spell out mark, word and reason on an expansion line | Leave an expansion line with a mark only |
| Use the four interaction looks for their four meanings | Give a hover explanation and a click-to-open the same look |
| Open the sync report and a ranked row in place, pushing the page down | Put either in an overlay, a dropdown, a modal or a drawer |
| Keep tooltips for explanation only, left-aligned | Put an action, a link or a control in a tooltip |
| Carry rank emphasis with weight and the rank numeral's colour | Make a top-ranked row taller or its type larger |
| Hold every ranked row at `{spacing.row-height}` and every expansion line at `{spacing.line-height-expansion}`. A pruned line's reason line is the one addition. An appendix row is the one exception: a wrapped note grows it past `{spacing.line-height-expansion}` | Vary row height by rank, content or state |
| Reserve `{spacing.mark-slot}` on every row | Let figures shift when a mark appears |
| Print `—` for a missing price only beside a mark | Print `0`, `0.00` or a blank where a figure is missing, or a `—` with no mark to explain it |
| Print the uncostable phrase in the Craft Cost slot | Cost an uncostable recipe at zero |
| Print Craft Cost once, beside the recipe | Repeat it on every row |
| Dim a negative EV and a below-threshold line, tiers included | Hide either one, or leave its tiers bright |
| Cut a name or a chase cell on the ranked row with an ellipsis | Cut anything inside an expansion line |
| Set the fallback and the cross-file diagnosis in the verbatim register | Give verbatim text a colour, a mark or a size of its own, or let mono spread to text the page wrote |
| Lead a pinned combination with its pinned mark at 600 | Quiet it to 400 or move it to the end of the cell |
| Leave the link cell empty where no trade link renders | Draw the link greyed |
| Keep ↗ a single mark, quiet at rest | Add a button, a label, a second icon or a wider click target |
| Round controls and tooltips. Keep rows and panels square | Round a row or a panel, or add a chip, a pill or a badge background |
| Give shadows to the tooltips only | Shadow a panel, a row or a control, or lift anything on hover |
| Declare a `lineHeight` on every type role but the inline tier | Let Mantine's 1.55 decide a row height |
| Keep one dark theme, centred between `{spacing.content-min}` and `{spacing.content-max}` | Add a light theme, an OS switch, or a width rule other than the chase-cell count |
| Let the page grow and the document scroll | Fix the page to a height, or shrink rows to fit a screen |
| Write copy, labels, behaviour and fixed values in EXPERIENCE.md and cite them here | Restate EXPERIENCE.md's copy, behaviour or thresholds in this document |
