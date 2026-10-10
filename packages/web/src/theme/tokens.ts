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

/** DESIGN.md `ranked-row.grid`, shared by the column header, the rows and the skeleton. */
export const rankedRowGrid = {
  display: 'grid',
  gridTemplateColumns: `${spacing['col-rank']} ${spacing['col-name']} ${spacing['col-ev']} minmax(0, 1fr)`,
  columnGap: spacing['col-gap'],
  alignItems: 'center',
} as const satisfies CSSProperties;

/** The drop shadows of the two floating layers (DESIGN.md `mark-tooltip`, `ev-tooltip`). */
export const floatingShadows = {
  'mark-tooltip': '0 6px 18px rgba(0,0,0,.5)',
  'ev-tooltip': '0 8px 24px rgba(0,0,0,.6)',
} as const;

/** The column header's height (DESIGN.md `column-header`). */
export const COLUMN_HEADER_HEIGHT = '30px';

/** Component measurements in px that Stories 4.5 and 4.6 replace with `{spacing.*}`. */
export const layout = {
  /** The appendix's fixed width until Story 4.6. */
  contentWidth: 1012,
  gutter: 34,
  hairline: 1,
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
  syncReportHeadingGap: 4,
  failureBodyMaxWidth: 480,
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 24,
  /** The fixed box both unit glyphs centre in, so every unit name starts at one x. */
  unitGlyphBox: 14,
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
} as const;

/** A px number as a CSS length. */
export function px(value: number): string {
  return `${String(value)}px`;
}

/** The other fixed column sums. Nothing on these surfaces flexes. */
export const columnSums = {
  appendix: [292, 118, 250, 310],
} as const;

/** The px values DESIGN.md `recipe-toggle`, `threshold-control` and `sync-button` write inline. */
export const headerControls = {
  /** A control label sits this far before its control, and Craft Cost this far after the toggle. */
  labelGap: 10,
  framePadding: 2,
  segmentPadY: 4,
  segmentPadX: 10,
  figurePadY: 3,
  figurePadX: 8,
  figureMinWidth: 64,
  sliderWidth: 100,
  sliderHeight: 4,
  sliderRadius: 2,
  thumbSize: 12,
  thumbRing: 3,
  syncPadY: 4,
  syncPadX: 8,
  openSignGap: 6,
} as const;

/** The px widths DESIGN.md `expansion-line.grid` writes inline rather than as `{spacing.*}`. */
export const expansionLineWidths = { price: '90px', link: '24px', paddingRight: '16px' } as const;

/** DESIGN.md `expansion-line`: combination 1fr · price · trust · link, one line high. */
export const expansionLineGrid = {
  display: 'grid',
  gridTemplateColumns: `1fr ${expansionLineWidths.price} ${spacing['expansion-trust-cell']} ${expansionLineWidths.link}`,
  columnGap: spacing['col-gap'],
  alignItems: 'center',
  paddingRight: expansionLineWidths.paddingRight,
  height: spacing['line-height-expansion'],
  boxSizing: 'border-box',
} as const satisfies CSSProperties;

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

// Story 4.6 retires the paper marks among these (DESIGN.md, Typography: marks are drawn).
export const glyphs = {
  unitClass: '≡',
  unitRaw: '▪',
  unresolvable: '×',
  prior: '◊',
  unknown: '?',
  stale: '»',
  open: '+',
  close: '−',
} as const;
