import type { CSSProperties, JSX } from 'react';

import { fixedCell } from '../shared/cell';
import { DENOMINATION } from '../shared/product';
import { colors, px, rankedRowColumns, layout, typeStyle } from '../theme/tokens';

type ColumnName = (typeof rankedRowColumns)[number]['name'];

// DESIGN.md `column-header`. The second label names both ranked units (FR-3);
// the fourth is `Provenance`, never `Weight`.
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

// Fixed flex cells, never inline-block spans. No artifact feeds its text: the skeleton paints it.
export function ColumnHeader(): JSX.Element {
  return (
    <div
      data-column-header=""
      style={{
        ...typeStyle('column-header'),
        display: 'flex',
        width: px(layout.contentWidth),
        boxSizing: 'border-box',
        marginTop: px(layout.columnHeaderMarginTop),
        paddingBottom: px(layout.s1),
        borderBottom: `${px(layout.hairline)} solid ${colors['line-strong']}`,
        color: colors['text-tertiary'],
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
