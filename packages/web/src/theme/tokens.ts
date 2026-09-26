/**
 * The Field Guide token set — one source, transcribed from the frontmatter of
 * `docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/DESIGN.md`.
 * Where this file and DESIGN.md disagree, DESIGN.md wins and this file is the
 * bug. Nothing here is inherited from Mantine: its palette, radius, shadow and
 * type ramp are replaced wholesale (see `theme.ts`).
 */

import type { CSSProperties } from 'react';

// --- colour ---------------------------------------------------------------

/**
 * Five paper tones, four inks, three rules, one decorative sepia and exactly
 * two semantic inks. There is no green and no success colour: silence means
 * healthy. `surround` fills the viewport outside the frame and is not a paper
 * tone.
 */
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
  frameSlack: 528,
  frameReserveBanner: 74,
  frameReserveHealthLine: 21,
  syncReportMaxHeight: 400,
  dekMaxWidth: 480,
  recipePanelWidth: 216,
  mastheadControlGap: 16,
  thresholdPanelWidth: 276,
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 24,
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

function role(
  stack: keyof typeof stacks,
  fontSize: string,
  fontWeight: TypeRole['fontWeight'],
  lineHeight: string,
  letterSpacing?: string,
): TypeRole {
  const base = { fontFamily: stacks[stack], fontSize, fontWeight, lineHeight };
  return letterSpacing === undefined ? base : { ...base, letterSpacing };
}

export const typeRoles = {
  eyebrow: role('sans', '10px', '600', '1.4', '0.22em'),
  'masthead-title': role('serif', '38px', '400', '1.15', '-0.012em'),
  dek: role('serif', '14px', '400', '1.5'),
  'threshold-label': role('sans', '9.5px', '600', '1.2', '0.16em'),
  'threshold-value': role('serif', '32px', '400', '1.05'),
  'threshold-value-unit': role('serif', '13px', '400', '1.2'),
  'threshold-range': role('sans', '9.5px', '400', '1.2'),
  'recipe-label': role('sans', '9.5px', '600', '1.2', '0.16em'),
  'recipe-option': role('serif', '15px', '400', '1.25'),
  'recipe-cost-figure': role('serif', '13px', '400', '1.2'),
  'recipe-cost': role('sans', '9.5px', '400', '1.2'),
  'trust-strip': role('sans', '11.5px', '400', '1.85'),
  'asking-note': role('serif', '12.5px', '400', '1.4'),
  'column-header': role('sans', '9.5px', '600', '1.2', '0.2em'),
  'row-rank': role('serif', '12px', '400', '1.2'),
  'row-unit-name': role('serif', '14px', '400', '1.2'),
  'row-unit-glyph': role('sans', '11.5px', '400', '1.2'),
  'row-ev': role('serif', '14px', '400', '1.2'),
  'row-mark': role('sans', '10px', '600', '1.2'),
  'row-chase': role('sans', '10.5px', '400', '1.2'),
  'money-phrase': role('sans', '10.5px', '400', '1.2'),
  'appendix-title': role('serif', '18px', '400', '1.2'),
  'appendix-lead': role('sans', '11.5px', '400', '1.55'),
  'appendix-row': role('serif', '13px', '400', '1.2'),
  'key-heading': role('sans', '9.5px', '600', '1.2', '0.18em'),
  'key-body': role('sans', '10.5px', '400', '1.85'),
  'running-foot': role('sans', '11px', '400', '1.5'),
  'panel-title': role('serif', '20px', '400', '1.2'),
  'panel-sub': role('sans', '11.5px', '400', '1.5'),
  'detail-row': role('serif', '12.5px', '400', '1.2'),
  'detail-meta': role('sans', '10.5px', '400', '1.2'),
  'combination-line-2': role('sans', '10.5px', '400', '20px'),
  'tombstone-band-label': role('sans', '9.5px', '600', '1.2', '0.16em'),
  'expand-affordance': role('sans', '12.5px', '400', '1.5'),
  'banner-lead': role('serif', '13.5px', '700', '1.35'),
  'banner-body': role('serif', '12.5px', '400', '1.4'),
  'failure-body': role('serif', '15px', '400', '1.55'),
} as const satisfies Record<string, TypeRole>;

export type TypeRoleName = keyof typeof typeRoles;

/** A role as inline style. */
export function typeStyle(name: TypeRoleName): CSSProperties {
  return { ...typeRoles[name] };
}

// --- glyphs ---------------------------------------------------------------

/**
 * The glyph vocabulary. Every mark is resident in Segoe UI Regular, Semibold
 * and Bold — a hard rule (memlog 196) — except `↗`, which is resident in
 * Regular only and is therefore pinned to weight 400.
 */
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

/**
 * DESIGN.md's vertical budget, computed from committed block heights. The
 * appendix carries `margin-top: auto`, so what is left over is `frameSlack`.
 */
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

/**
 * Chrome charged against the slack by data, not by a click. Each absence line
 * takes a budget line of its own at the health line's 21px (Story 2.1
 * decision 2026-09-26) — new resting chrome is admissible only that way.
 */
export const reservedChrome: readonly BudgetLine[] = [
  { block: 'uniform-prior banner', px: spacing.frameReserveBanner },
  { block: 'health line', px: spacing.frameReserveHealthLine },
  { block: 'absence line: weights.json', px: spacing.frameReserveHealthLine },
  { block: 'absence line: recipes.json', px: spacing.frameReserveHealthLine },
  { block: 'absence line: sync-report.json', px: spacing.frameReserveHealthLine },
];

export function sumPx(lines: readonly BudgetLine[]): number {
  return lines.reduce((total, line) => total + line.px, 0);
}
