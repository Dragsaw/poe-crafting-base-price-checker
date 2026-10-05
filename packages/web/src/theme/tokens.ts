/** The Field Guide token set, transcribed from DESIGN.md's frontmatter; DESIGN.md wins. */

import type { CSSProperties } from 'react';

// --- colour ---------------------------------------------------------------

/** Paper tones, inks, rules, one sepia, two semantic inks; no green, as silence means healthy. */
export const colors = {
  surround: '#E8E3D4',
  paper: '#FDFBF3',
  'paper-inset': '#F5F1E4',
  'paper-deep': '#F0EADA',
  'paper-raw': '#F7F3E6',
  'paper-raw-hover': '#F2EDDC',
  ink: '#211E17',
  'ink-secondary': '#55503F',
  'ink-tertiary': '#8B8470',
  'ink-chase-emphasis': '#3E3A2C',
  'rule-hairline': '#E0DAC6',
  'rule-strong': '#211E17',
  edge: '#D2CAB2',
  sepia: '#6B4A22',
  ochre: '#8A5A12',
  rust: '#8E3B1E',
} as const;

export type ColorName = keyof typeof colors;

export const PAPER_TONES = [
  'paper',
  'paper-inset',
  'paper-deep',
  'paper-raw',
  'paper-raw-hover',
] as const satisfies readonly ColorName[];
export const INKS = [
  'ink',
  'ink-secondary',
  'ink-tertiary',
  'ink-chase-emphasis',
] as const satisfies readonly ColorName[];
export const RULES = ['rule-hairline', 'rule-strong', 'edge'] as const satisfies readonly ColorName[];
/** The only two colours that mean something. A third needs a DESIGN.md decision. */
export const SEMANTIC_INKS = ['ochre', 'rust'] as const satisfies readonly ColorName[];

// --- spacing --------------------------------------------------------------

/** Every exact measurement, in px. The frame is a constant, not a breakpoint. */
export const spacing = {
  frameWidth: 1060,
  frameHeight: 1920,
  framePaddingX: 24,
  contentWidth: 1012,
  gutter: 34,
  hairline: 1,
  rowHeight: 28,
  appendixRowHeight: 29,
  /** `{components.unrankable-appendix}` padding and lead spacing; the rows span 970 (DESIGN.md). */
  appendixPadTop: 16,
  appendixPadX: 20,
  appendixPadBottom: 10,
  appendixLeadMarginTop: 5,
  appendixLeadMarginBottom: 12,
  appendixLeadMaxWidth: 760,
  /** 1920 − 1390 committed = 530 (UX memlog 210; it read 528 through revision 5). */
  frameSlack: 530,
  frameReserveBanner: 74,
  /** The ochre left edge of the uniform-prior banner (DESIGN.md `banner-marker`). */
  bannerMarker: 5,
  frameReserveHealthLine: 21,
  /** One per absent tolerable artifact, inside the trust strip (DESIGN.md memlog 213). */
  frameReserveAbsenceLine: 21,
  /** The list's one statement slot; states 23, 25 and 35 are exclusive. */
  frameReserveListStatement: 21,
  syncReportMaxHeight: 400,
  /** `{components.trust-strip}` padding and separator, so two lines rest at 68px (DESIGN.md). */
  trustStripPadTop: 11,
  trustStripPadBottom: 12,
  trustSeparatorPadX: 9,
  /** `{components.sync-report-panel}` padding, column gap and group gap (DESIGN.md). */
  syncReportPadTop: 14,
  syncReportPadX: 16,
  syncReportPadBottom: 12,
  syncReportColumnGap: 22,
  syncReportGroupGap: 8,
  dekMaxWidth: 480,
  recipePanelWidth: 216,
  mastheadControlGap: 16,
  thresholdPanelWidth: 276,
  /** `{components.payout-threshold}` and `craft-recipe` panel padding and gaps (DESIGN.md). */
  controlPanelPadY: 13,
  controlPanelPadX: 15,
  thresholdValueGap: 4,
  thresholdTrackGap: 10,
  thresholdRangeGap: 7,
  thresholdTrackHeight: 4,
  /** `{components.craft-recipe}` gaps; `margin-top: auto` holds the cost line at the foot. */
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
  /** The open row's sepia left rule; it bleeds into the gutter on a negative margin. */
  openRowMarker: 3,
  /** The fixed box both unit glyphs centre in, so every unit name starts at one x. */
  unitGlyphBox: 14,
  /** `{spacing.chase-cell}`: `col-chase` 492 holds three fixed cells of 164. */
  chaseCell: 164,
  /** `{spacing.pad-chase-cell-right}`, on every chase cell. */
  padChaseCellRight: 10,
  /** Resting chrome gaps from DESIGN.md's vertical budget; block heights depend on them. */
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
  /** `{components.expansion-panel}` padding and sub-line gaps; inner width 966 (DESIGN.md). */
  panelPadTop: 18,
  panelPadX: 22,
  panelPadBottom: 20,
  panelSubMarginTop: 4,
  panelSubMarginBottom: 13,
  /** `{components.combination-row}`: every cell but the trade-link cell pads 12px on the right. */
  padCombinationCellRight: 12,
  /** Line one of a combination row. */
  detailRowHeight: 28,
  /** Line two's wrap quantum: `combination-line-2` sets an absolute 20px lineHeight. */
  combinationRowLine2Height: 20,
  /** A MINIMUM, 28 + 20: a wrapped note grows the row by whole line-two steps. */
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

/** The other fixed column sums DESIGN.md verifies. Nothing on these surfaces flexes. */
export const columnSums = {
  mastheadControls: [216, 16, 276],
  combinationLine1: [460, 250, 116, 116, 24],
  combinationLine2: [560, 200, 206],
  tombstoneLine2: [560, 406],
  appendix: [292, 118, 250, 310],
} as const;

/** `{components.combination-row}` line one; the trade-link cell has no right padding. */
export const combinationLine1Columns = [
  { name: 'combination', width: 460, padRight: 12 },
  { name: 'state', width: 250, padRight: 12 },
  { name: 'figure', width: 116, padRight: 12 },
  { name: 'sample', width: 116, padRight: 12 },
  { name: 'trade-link', width: 24, padRight: 0 },
] as const;

/** Line two, the evidence: `col-combination-note`, `-age-observed` and `-age-attempted`. */
export const combinationLine2Columns = [
  { name: 'note', width: 560, padRight: 12 },
  { name: 'observed', width: 200, padRight: 12 },
  { name: 'attempted', width: 206, padRight: 12 },
] as const;

// --- type -----------------------------------------------------------------

/** Three system-resident stacks. The page downloads no font (NFR-7). */
export const stacks = {
  serif: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  sans: '-apple-system, "Segoe UI", system-ui, "Helvetica Neue", sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Cascadia Mono", monospace',
} as const;

export interface TypeRole {
  readonly fontFamily: string;
  /** A literal px string, never a theme key: rem conversion rounds the .5px sizes. */
  readonly fontSize: string;
  readonly fontWeight: '400' | '600' | '700';
  /** Every role declares one. Mantine's 1.55 default breaks the 28px row. */
  readonly lineHeight: string;
  readonly letterSpacing?: string;
}

function roleIn(stack: keyof typeof stacks) {
  return (
    fontSize: string,
    fontWeight: TypeRole['fontWeight'],
    lineHeight: string,
    letterSpacing?: string,
  ): TypeRole => {
    const base = { fontFamily: stacks[stack], fontSize, fontWeight, lineHeight };
    return letterSpacing === undefined ? base : { ...base, letterSpacing };
  };
}

const sans = roleIn('sans');
const serif = roleIn('serif');
const mono = roleIn('mono');

export const typeRoles = {
  eyebrow: sans('10px', '600', '1.4', '0.22em'),
  'masthead-title': serif('38px', '400', '1.15', '-0.012em'),
  dek: serif('14px', '400', '1.5'),
  'threshold-label': sans('9.5px', '600', '1.2', '0.16em'),
  'threshold-value': serif('32px', '400', '1.05'),
  'threshold-value-unit': serif('13px', '400', '1.2'),
  'threshold-range': sans('9.5px', '400', '1.2'),
  'recipe-label': sans('9.5px', '600', '1.2', '0.16em'),
  'recipe-option': serif('15px', '400', '1.25'),
  'recipe-cost-figure': serif('13px', '400', '1.2'),
  'recipe-cost': sans('9.5px', '400', '1.2'),
  'trust-strip': sans('11.5px', '400', '1.85'),
  'asking-note': serif('12.5px', '400', '1.4'),
  'column-header': sans('9.5px', '600', '1.2', '0.2em'),
  'row-rank': serif('12px', '400', '1.2'),
  'row-unit-name': serif('14px', '400', '1.2'),
  'row-unit-glyph': sans('11.5px', '400', '1.2'),
  'row-ev': serif('14px', '400', '1.2'),
  'row-mark': sans('10px', '600', '1.2'),
  'row-chase': sans('10.5px', '400', '1.2'),
  'money-phrase': sans('10.5px', '400', '1.2'),
  'appendix-title': serif('18px', '400', '1.2'),
  'appendix-lead': sans('11.5px', '400', '1.55'),
  'appendix-row': serif('13px', '400', '1.2'),
  'key-heading': sans('9.5px', '600', '1.2', '0.18em'),
  'key-body': sans('10.5px', '400', '1.85'),
  /** The sync report panel's verbatim register: `key-body`'s size, weight and line height in the mono stack. */
  'sync-report-verbatim': mono('10.5px', '400', '1.85'),
  'running-foot': sans('11px', '400', '1.5'),
  'panel-title': serif('20px', '400', '1.2'),
  'panel-sub': sans('11.5px', '400', '1.5'),
  'detail-row': serif('12.5px', '400', '1.2'),
  'detail-meta': sans('10.5px', '400', '1.2'),
  'combination-line-2': sans('10.5px', '400', '20px'),
  'tombstone-band-label': sans('9.5px', '600', '1.2', '0.16em'),
  'expand-affordance': sans('12.5px', '400', '1.5'),
  'banner-lead': serif('13.5px', '700', '1.35'),
  'banner-body': serif('12.5px', '400', '1.4'),
  'failure-body': serif('15px', '400', '1.55'),
} as const satisfies Record<string, TypeRole>;

export type TypeRoleName = keyof typeof typeRoles;

/** A role as inline style. */
export function typeStyle(name: TypeRoleName): CSSProperties {
  return { ...typeRoles[name] };
}

// --- glyphs ---------------------------------------------------------------

// Every mark is resident in Segoe UI Regular, Semibold and Bold (memlog 196) except `↗`, which is
// Regular only and so pinned to weight 400.
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

// --- the vertical budget --------------------------------------------------

export interface BudgetLine {
  readonly block: string;
  readonly px: number;
}

/** DESIGN.md's vertical budget; the appendix's `margin-top: auto` leaves `frameSlack` over. */
export const committedChrome: readonly BudgetLine[] = [
  { block: 'masthead', px: 170 },
  { block: 'trust strip', px: 68 },
  { block: 'asking-price line', px: 32 },
  { block: 'column header', px: 32 },
  { block: '20 ranked rows', px: 20 * spacing.rowHeight },
  { block: 'list expand affordance', px: 33 },
  { block: 'unrankable appendix', px: 306 },
  { block: 'key block', px: 107 },
  { block: 'running foot', px: 82 },
];

/** Chrome charged to the slack by data; each absence line gets its own budget line (memlog 213). */
export const reservedChrome: readonly BudgetLine[] = [
  { block: 'uniform-prior banner', px: spacing.frameReserveBanner },
  { block: 'health line', px: spacing.frameReserveHealthLine },
  { block: 'absence line: weights.json', px: spacing.frameReserveAbsenceLine },
  { block: 'absence line: recipes.json', px: spacing.frameReserveAbsenceLine },
  { block: 'absence line: sync-report.json', px: spacing.frameReserveAbsenceLine },
  { block: 'list statement', px: spacing.frameReserveListStatement },
];

/** Reserves that can co-occur: banner, a health or absence line, the list statement (DESIGN.md). */
export const coOccurringReserve: number =
  spacing.frameReserveBanner +
  Math.max(spacing.frameReserveHealthLine, spacing.frameReserveAbsenceLine) +
  spacing.frameReserveListStatement;

export function sumPx(lines: readonly BudgetLine[]): number {
  return lines.reduce((total, line) => total + line.px, 0);
}
