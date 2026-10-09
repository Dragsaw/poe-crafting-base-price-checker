import type { JSX } from 'react';

import { ColumnHeader } from '../list/ColumnHeader';
import { colors, px, rankedRowColumns, layout } from '../theme/tokens';

export const ROW_SLOT_COUNT = 20;

/** The height of each skeleton bar inside its 28px row. */
const BAR_HEIGHT = 10;

/** The load state in the final six-column layout (EXPERIENCE.md state 22; memlog 211). */
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
            display: 'flex',
            alignItems: 'center',
            width: px(layout.contentWidth),
            height: px(layout.rowHeight),
            boxSizing: 'border-box',
            borderBottom: `${px(layout.hairline)} solid ${colors.line}`,
          }}
        >
          {rankedRowColumns.map((column) => (
            <div
              key={column.name}
              data-cell={column.name}
              style={{
                flex: `0 0 ${px(column.width)}`,
                width: px(column.width),
                boxSizing: 'border-box',
                paddingRight: px(column.padRight),
              }}
            >
              <div style={{ height: px(BAR_HEIGHT), background: colors.surface }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
