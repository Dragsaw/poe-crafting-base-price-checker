import type { CSSProperties, JSX } from 'react';

import { fixedCell } from '../shared/cell';
import { DENOMINATION } from '../shared/product';
import { colors, px, rankedRowColumns, spacing, typeStyle } from '../theme/tokens';

type ColumnName = (typeof rankedRowColumns)[number]['name'];

/**
 * The six header labels (DESIGN.md `column-header`). The rank column is blank.
 * The second names both ranked units because the column holds both (FR-3);
 * the fourth is `Provenance`, never `Weight`; the EV header states the unit once.
 */
export const COLUMN_LABELS: Readonly<Record<ColumnName, string>> = {
  rank: '',
  unit: 'Item Class / Base Type',
  ev: `EV (${DENOMINATION})`,
  provenance: 'Provenance',
  age: 'Age',
  chase: 'Chase Combinations, by contribution to EV',
};

/** Columns whose content sits against the right edge: the numeral and the figure. */
const RIGHT_ALIGNED: ReadonlySet<ColumnName> = new Set(['rank', 'ev']);

/** One fixed-width flex cell of the six-column contract, shared by the header, the rows and the skeleton. */
export function cellStyle(column: (typeof rankedRowColumns)[number]): CSSProperties {
  return {
    ...fixedCell(column),
    textAlign: RIGHT_ALIGNED.has(column.name) ? 'right' : undefined,
  };
}

/**
 * Six fixed flex cells on a `rule-strong` rule, never inline-block spans, never
 * ellipsising. Its text depends on no artifact, so the skeleton paints it too.
 * Nothing sorts (UX-DR14).
 */
export function ColumnHeader(): JSX.Element {
  return (
    <div
      data-column-header=""
      style={{
        ...typeStyle('column-header'),
        display: 'flex',
        width: px(spacing.contentWidth),
        boxSizing: 'border-box',
        marginTop: px(spacing.columnHeaderMarginTop),
        paddingBottom: px(spacing.s1),
        borderBottom: `${px(spacing.hairline)} solid ${colors['rule-strong']}`,
        color: colors['ink-tertiary'],
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {rankedRowColumns.map((column) => (
        <div key={column.name} data-header-cell={column.name} style={cellStyle(column)}>
          {COLUMN_LABELS[column.name]}
        </div>
      ))}
    </div>
  );
}
