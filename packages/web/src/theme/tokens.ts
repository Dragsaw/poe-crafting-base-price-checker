/** The Rarity Dark token set, transcribed from DESIGN.md's frontmatter; DESIGN.md wins. */

import type { CSSProperties } from 'react';

// --- colour ---------------------------------------------------------------

/** `{colors.*}`: neutrals, the rarity pair, one accent and three attention colours. */
export const colors = {
  ground: '#1A1A1D',
  surface: '#222226',
  'surface-raised': '#2C2C31',
  line: '#2E2E33',
  'line-strong': '#44444B',
  text: '#D9D9D9',
  'text-secondary': '#9A9A9A',
  'text-tertiary': '#8A8A8E',
  'rarity-magic': '#8888FF',
  'rarity-magic-dim': '#8C8CCF',
  'rarity-normal': '#C8C8C8',
  accent: '#BFA77A',
  'accent-soft': 'rgba(191,167,122,.14)',
  'trust-rough': '#E0913A',
  'trust-pending': '#9898A0',
  'trust-broken': '#F0756C',
} as const;

// --- shape and spacing ----------------------------------------------------

/** `{rounded.*}`: rows and panels are square; controls and floating layers are rounded. */
export const rounded = {
  none: '0px',
  control: '6px',
  segment: '4px',
  tooltip: '6px',
} as const;

/** `{spacing.*}`, as DESIGN.md writes them. */
export const spacing = {
  'content-max': '1120px',
  'content-min': '1000px',
  gutter: '24px',
  'header-height': '64px',
  'row-height': '38px',
  'line-height-expansion': '32px',
  'col-rank': '32px',
  'col-name': '220px',
  'col-ev': '96px',
  'mark-slot': '18px',
  'col-gap': '14px',
  'chase-gap': '18px',
  'expansion-indent': '46px',
  'expansion-trust-cell': '270px',
  'open-row-bar': '2px',
} as const;

/**
 * Component measurements in px that Stories 4.3 to 4.6 replace with `{spacing.*}`.
 * The ranked-row grid and its 28px rows stay until Story 4.3.
 */
export const layout = {
  contentWidth: 1012,
  gutter: 34,
  hairline: 1,
  rowHeight: 28,
  appendixRowHeight: 29,
  appendixPadTop: 16,
  appendixPadX: 20,
  appendixPadBottom: 10,
  appendixLeadMarginTop: 5,
  appendixLeadMarginBottom: 12,
  appendixLeadMaxWidth: 760,
  bannerMinHeight: 74,
  bannerMarker: 5,
  healthLineHeight: 21,
  absenceLineHeight: 21,
  listStatementHeight: 21,
  syncReportMaxHeight: 400,
  trustStripPadTop: 11,
  trustStripPadBottom: 12,
  trustSeparatorPadX: 9,
  syncReportPadTop: 14,
  syncReportPadX: 16,
  syncReportPadBottom: 12,
  syncReportColumnGap: 22,
  syncReportGroupGap: 8,
  failureBodyMaxWidth: 480,
  recipePanelWidth: 216,
  interimControlGap: 16,
  thresholdPanelWidth: 276,
  controlPanelPadY: 13,
  controlPanelPadX: 15,
  thresholdValueGap: 4,
  thresholdTrackGap: 10,
  thresholdRangeGap: 7,
  thresholdTrackHeight: 4,
  recipeOptionsGap: 9,
  recipeCostGap: 10,
  recipeCostFigureGap: 4,
  thresholdMarkerWidth: 11,
  thresholdMarkerHeight: 14,
  /** The marker's rise above the track's top edge: (14 − 4) / 2. */
  thresholdMarkerRise: 5,
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 24,
  openRowMarker: 3,
  /** The fixed box both unit glyphs centre in, so every unit name starts at one x. */
  unitGlyphBox: 14,
  chaseCell: 164,
  padChaseCellRight: 10,
  askingPadTop: 12,
  askingPadBottom: 3,
  columnHeaderMarginTop: 16,
  expandPadTop: 14,
  keyMarginTop: 22,
  keyPadTop: 11,
  keyColumnGap: 22,
  keyHeadingGap: 4,
  footMarginTop: 18,
  footPadTop: 10,
  footMarginBottom: 20,
  panelPadTop: 18,
  panelPadX: 22,
  panelPadBottom: 20,
  panelSubMarginTop: 4,
  panelSubMarginBottom: 13,
  padCombinationCellRight: 12,
  detailRowHeight: 28,
  /** Line two's wrap quantum; a wrapped note grows the row by whole steps. */
  combinationRowLine2Height: 20,
  /** A minimum: 28 + 20. */
  combinationRowHeight: 48,
} as const;

/** A px number as a CSS length. */
export function px(value: number): string {
  return `${String(value)}px`;
}

/** The ranked-row column budget (memlog 40). Six widths, summing to `contentWidth`, exact. */
export const rankedRowColumns = [
  { name: 'rank', width: 32, padRight: 10 },
  { name: 'unit', width: 222, padRight: 8 },
  { name: 'ev', width: 84, padRight: 12 },
  { name: 'provenance', width: 88, padRight: 0 },
  { name: 'age', width: 94, padRight: 0 },
  { name: 'chase', width: 492, padRight: 10 },
] as const;

/** The other fixed column sums. Nothing on these surfaces flexes. */
export const columnSums = {
  interimControls: [216, 16, 276],
  combinationLine1: [460, 250, 116, 116, 24],
  combinationLine2: [560, 200, 206],
  tombstoneLine2: [560, 406],
  appendix: [292, 118, 250, 310],
} as const;

/** Combination row line one; the trade-link cell has no right padding. */
export const combinationLine1Columns = [
  { name: 'combination', width: 460, padRight: 12 },
  { name: 'state', width: 250, padRight: 12 },
  { name: 'figure', width: 116, padRight: 12 },
  { name: 'sample', width: 116, padRight: 12 },
  { name: 'trade-link', width: 24, padRight: 0 },
] as const;

/** Line two, the evidence: note, observed age and attempted age. */
export const combinationLine2Columns = [
  { name: 'note', width: 560, padRight: 12 },
  { name: 'observed', width: 200, padRight: 12 },
  { name: 'attempted', width: 206, padRight: 12 },
] as const;

// --- type -----------------------------------------------------------------

/** `{typography.stack-sans}` (Inter, bundled for NFR-7) and `{typography.stack-mono}`. */
export const stacks = {
  sans: 'Inter, system-ui, "Segoe UI", sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Cascadia Mono", monospace',
} as const;

export interface TypeRole {
  readonly fontFamily: string;
  /** A literal px string, never a theme key: rem conversion rounds the .5px sizes. */
  readonly fontSize: string;
  readonly fontWeight: '400' | '500' | '600';
  /** Absent only on `tier`, which takes its host's. Mantine's 1.55 default moves row heights. */
  readonly lineHeight?: string;
  readonly letterSpacing?: string;
}

function role(
  fontSize: string,
  fontWeight: TypeRole['fontWeight'],
  lineHeight: string,
  letterSpacing?: string,
): TypeRole & { readonly lineHeight: string } {
  const base = { fontFamily: stacks.sans, fontSize, fontWeight, lineHeight };
  return letterSpacing === undefined ? base : { ...base, letterSpacing };
}

/** `{typography.*}`: every role is in the sans stack. */
export const typeRoles = {
  title: role('18px', '600', '1.15'),
  eyebrow: role('11px', '600', '1.15', '0.08em'),
  control: role('13px', '400', '1.2'),
  'control-figure': role('15px', '600', '1.2'),
  'craft-cost': role('13px', '400', '1.2'),
  label: role('12px', '400', '1.2'),
  'column-header': role('11px', '600', '1.2', '0.06em'),
  'row-name': role('15px', '500', '1.2'),
  'row-figure': role('15px', '400', '1.2'),
  'row-rank': role('13px', '400', '1.2'),
  chase: role('12.5px', '400', '1.2'),
  tier: { fontFamily: stacks.sans, fontSize: '0.9em', fontWeight: '600', letterSpacing: '0.01em' },
  'line-text': role('13.5px', '400', '1.2'),
  trust: role('12.5px', '400', '1.2'),
  mark: role('13px', '400', '1.2'),
  tooltip: role('12.5px', '400', '1.45'),
  note: role('12px', '400', '1.4'),
} as const satisfies Record<string, TypeRole>;

export type TypeRoleName = keyof typeof typeRoles;

/** A role as inline style. */
export function typeStyle(name: TypeRoleName): CSSProperties {
  return { ...typeRoles[name] };
}

// --- glyphs ---------------------------------------------------------------

// Story 4.3 replaces these with drawn marks (DESIGN.md, Typography). `↗` is pinned to weight 400.
export const glyphs = {
  unitClass: '≡',
  unitRaw: '▪',
  priced: '●',
  noListings: '○',
  notYetSynced: '∆',
  unresolvable: '×',
  prior: '◊',
  unknown: '?',
  stale: '»',
  tradeLink: '↗',
  pruned: '†',
  pinned: '*',
  open: '+',
  close: '−',
} as const;

/** The one glyph resident at a single weight. */
export const REGULAR_ONLY_GLYPHS: readonly string[] = [glyphs.tradeLink];
