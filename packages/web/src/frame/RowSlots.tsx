import type { JSX } from 'react';

import { ColumnHeader } from '../list/ColumnHeader';
import { cellStyle, ROW_COLUMNS } from '../list/row/grid';
import { colors, rankedRowGrid, spacing } from '../theme/tokens';

export const ROW_SLOT_COUNT = 20;

/** DESIGN.md `ranked-row.skeleton`: each cell a flat bar this tall. */
const BAR_HEIGHT = '10px';

/** The load state in the final four-column layout, flat bars and no shimmer (EXPERIENCE.md state 22). */
export function RowSlots(): JSX.Element {
  return (
    <div data-row-slots="">
      <ColumnHeader />
      {Array.from({ length: ROW_SLOT_COUNT }, (_, row) => (
        <div
          key={row}
          data-row-slot=""
          aria-hidden="true"
          style={{
            ...rankedRowGrid,
            height: spacing['row-height'],
            boxSizing: 'border-box',
            borderBottom: `1px solid ${colors.line}`,
          }}
        >
          {ROW_COLUMNS.map((column) => (
            <div key={column} data-cell={column} style={cellStyle(column)}>
              <div style={{ height: BAR_HEIGHT, background: colors.surface }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
